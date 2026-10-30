# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy==2.5.4", "scipy==1.18.1"]
# ///
"""Design analysis for the next R01 round 2 pass, from E385's rows and the
mixed-effects fit (round2-glmm.py).

Usage (from the repository root):
    uv run --script context/evidence/data/r01-pilot-runs/round2-design.py \
        context/evidence/data/r01-pilot-runs/analysis-round2-v2-dev-r3.json \
        context/evidence/data/r01-pilot-runs/glmm-round2-v2-dev-r3.json \
        context/evidence/data/r01-pilot-runs/design-round2-v2-dev-r3.json

Three parts:
1. Discordance per cohort x family x level for the planned comparisons
   (C4 vs C3 FIELDS; bar|beat vs each other performed arm; C4 FIELDS vs each
   baseline on performed families). A pair is one
   repeat of one instance in both formats; it is discordant when exactly one
   format passes. Only discordant pairs carry paired evidence.
2. Repeat stability: within-instance agreement per cohort x arm x family, and
   how often a single repeat would have changed a cluster's C3/C4 verdict.
4. The next pass's per-cohort levels under a stated rule, and the projected
   power of its retained cells.
3. Power at equal cost, simulated from each cohort's fitted source model:
   4 instances x 3 repeats against 12 x 1 and 9 x 1 + 3 repeated (12 runs per
   format per cell in each design). Two cluster tests: the sign test (E385's
   reporting basis) and an exact sign-flip test that also uses how many repeats
   differ, so the 4 x 3 design is not handicapped by the test.
"""

import json
import sys
from collections import defaultdict

import numpy as np
from scipy.stats import binomtest

PERFORMED_OTHERS = ["baseline-json", "baseline-fields", "pp-midi-json", "c3-fields", "c4-fields"]
SOURCE_FAMILIES = ["derived-read", "group-retime", "regroup", "member-move", "preserve-exact"]
READ_FAMILIES = {"derived-read"}
BASELINES = ["baseline-json", "baseline-fields", "pp-midi-json"]


def sign_flip_p(diffs):
    """Exact two-sided sign-flip (randomization) test of the summed cluster
    differences. It uses how many repeats differ, unlike the sign test; with
    one repeat per instance it equals the sign test (exact McNemar)."""
    nz = [abs(int(d)) for d in diffs if d]
    if not nz:
        return 1.0
    total = sum(nz)
    dist = np.zeros(2 * total + 1)
    dist[total] = 1.0
    for a in nz:
        nxt = np.zeros_like(dist)
        nxt[a:] += 0.5 * dist[:-a]
        nxt[:-a] += 0.5 * dist[a:]
        dist = nxt
    obs = abs(int(sum(diffs)))
    return float(dist[np.abs(np.arange(-total, total + 1)) >= obs].sum())


def index(rows):
    t = {}
    for r in rows:
        if r["role"] != "primary":
            continue
        t[(r["cohort"], r["family"], r["level"], r["instance"], r["repetition"], r["arm"])] = int(r["firstAttemptPass"])
    return t


def cells(rows):
    return sorted({(r["cohort"], r["family"], r["level"]) for r in rows if r["role"] == "primary"})


def discordance(t, cohort, family, level, a, b):
    """Counts for arm a against arm b: pairs and clusters."""
    pairs = {"aOnly": 0, "bOnly": 0, "both": 0, "neither": 0}
    clusters = {"aBetter": 0, "bBetter": 0, "tied": 0}
    instances = sorted({k[3] for k in t if k[:3] == (cohort, family, level)})
    for i in instances:
        diff = 0
        for rep in sorted({k[4] for k in t if k[:4] == (cohort, family, level, i)}):
            pa, pb = t.get((cohort, family, level, i, rep, a)), t.get((cohort, family, level, i, rep, b))
            if pa is None or pb is None:
                continue
            key = "both" if pa and pb else "aOnly" if pa else "bOnly" if pb else "neither"
            pairs[key] += 1
            diff += pa - pb
        clusters["aBetter" if diff > 0 else "bBetter" if diff < 0 else "tied"] += 1
    n = sum(pairs.values())
    return {
        "a": a,
        "b": b,
        "pairs": pairs,
        "pairDiscordance": (pairs["aOnly"] + pairs["bOnly"]) / n if n else None,
        "clusters": clusters,
        "passRate": {a: (pairs["both"] + pairs["aOnly"]) / n if n else None, b: (pairs["both"] + pairs["bOnly"]) / n if n else None},
    }


def part1(rows, t):
    out = []
    for cohort, family, level in cells(rows):
        arms = {k[5] for k in t if k[:3] == (cohort, family, level)}
        comps = []
        if {"c3-fields", "c4-fields"} <= arms:
            comps.append(discordance(t, cohort, family, level, "c4-fields", "c3-fields"))
        if "pp-barbeat" in arms:
            for other in PERFORMED_OTHERS:
                comps.append(discordance(t, cohort, family, level, other, "pp-barbeat"))
            for base in BASELINES:
                comps.append(discordance(t, cohort, family, level, "c4-fields", base))
        out.append({"cohort": cohort, "family": family, "level": level, "comparisons": comps})
    return out


def part2(rows, t):
    agree = defaultdict(lambda: [0, 0])  # (cohort, arm, family) -> [unanimous instances, instances]
    for cohort, family, level in cells(rows):
        for arm in {k[5] for k in t if k[:3] == (cohort, family, level)}:
            for i in sorted({k[3] for k in t if k[:3] == (cohort, family, level)}):
                vals = [v for k, v in t.items() if k[:4] == (cohort, family, level, i) and k[5] == arm]
                if len(vals) < 2:
                    continue
                agree[(cohort, arm, family)][1] += 1
                agree[(cohort, arm, family)][0] += int(len(set(vals)) == 1)
    agreement = [
        {"cohort": c, "arm": a, "family": f, "unanimousInstances": u, "instances": n, "share": u / n}
        for (c, a, f), (u, n) in sorted(agree.items())
    ]

    flips = defaultdict(lambda: {"singleRepeats": 0, "same": 0, "tiedFromDecided": 0, "decidedFromTie": 0, "reversed": 0})
    for cohort, family, level in cells(rows):
        arms = {k[5] for k in t if k[:3] == (cohort, family, level)}
        if not {"c3-fields", "c4-fields"} <= arms:
            continue
        for i in sorted({k[3] for k in t if k[:3] == (cohort, family, level)}):
            reps = sorted({k[4] for k in t if k[:4] == (cohort, family, level, i)})
            d = [t[(cohort, family, level, i, r, "c4-fields")] - t[(cohort, family, level, i, r, "c3-fields")] for r in reps]
            cluster = np.sign(sum(d))
            for x in d:
                s = np.sign(x)
                f = flips[(cohort, family)]
                f["singleRepeats"] += 1
                if s == cluster:
                    f["same"] += 1
                elif s == 0:
                    f["tiedFromDecided"] += 1
                elif cluster == 0:
                    f["decidedFromTie"] += 1
                else:
                    f["reversed"] += 1
    flip_rows = [{"cohort": c, "family": f, **v} for (c, f), v in sorted(flips.items())]
    return {"agreement": agreement, "singleRepeatVerdicts": flip_rows}


def simulate_power(fit, cell_intercepts, n_sims, designs, rng, tests):
    """Simulate C3/C4 FIELDS outcomes from the fitted source model and apply
    cluster sign tests (exact two-sided binomial over non-tied clusters)."""
    p = fit["fixed"]
    b_write = p["fmt:c4-fields"]
    b_read = b_write + p.get("fmt:c4-fields:read", 0.0)
    su, sv = fit["instanceSD"], fit["instanceFormatSD"]
    results = {}
    for name, design in designs.items():
        hits = {k: 0 for k in tests}
        flip_hits = {k: 0 for k in tests}
        for _ in range(n_sims):
            diffs = {k: [] for k in tests}
            for (family, level), a in cell_intercepts.items():
                beta = b_read if family in READ_FAMILIES else b_write
                for reps in design:
                    u = rng.normal(0, su)
                    v3, v4 = rng.normal(0, sv, 2)
                    p3 = 1 / (1 + np.exp(-(a + u + v3)))
                    p4 = 1 / (1 + np.exp(-(a + beta + u + v4)))
                    d = int((rng.random(reps) < p4).sum() - (rng.random(reps) < p3).sum())
                    for k, members in tests.items():
                        if members is None or family in members:
                            diffs[k].append(d)
            for k, ds in diffs.items():
                pos, neg = sum(1 for d in ds if d > 0), sum(1 for d in ds if d < 0)
                if pos + neg and binomtest(pos, pos + neg).pvalue < 0.05:
                    hits[k] += 1
                if sign_flip_p(ds) < 0.05:
                    flip_hits[k] += 1
        results[name] = {"signTest": {k: v / n_sims for k, v in hits.items()}, "signFlip": {k: v / n_sims for k, v in flip_hits.items()}}
    return results


def part3(glmm, n_sims=2000, seed=20261030):
    rng = np.random.default_rng(seed)
    designs = {
        "4 instances x 3 repeats": [3] * 4,
        "12 instances x 1 repeat": [1] * 12,
        "9 instances x 1 + 3 repeated (x2)": [1] * 6 + [2] * 3,
    }
    tests = {"pooled": None, "reads": READ_FAMILIES, "writes": set(SOURCE_FAMILIES) - READ_FAMILIES}
    out = {}
    for cohort, c in glmm["cohorts"].items():
        fit = c["source"]
        intercepts = {}
        for name, v in fit["fixed"].items():
            if name.startswith("cell:"):
                family, level = name[5:].split("@")
                intercepts[(family, int(level))] = v
        out[cohort] = {
            "fittedEffects": {"c4WritesLogOdds": fit["fixed"]["fmt:c4-fields"], "c4ReadsLogOdds": fit["fixed"]["fmt:c4-fields"] + fit["fixed"]["fmt:c4-fields:read"]},
            "cells": "E385 source cells (fitted intercepts)",
            "power": simulate_power(fit, intercepts, n_sims, designs, rng, tests),
        }
    return {"sims": n_sims, "seed": seed, "tests": {"signTest": "cluster sign test, two-sided exact binomial, alpha 0.05", "signFlip": "exact sign-flip test of summed cluster differences, two-sided, alpha 0.05"}, "designs": {k: v for k, v in designs.items()}, "cohorts": out}


# Part 4: the per-cohort level list for the next pass (R01-D18).
SETTLED_P = 0.001  # a comparison with profile p below this in every cohort is settled
MIN_DISCORDANT = 4  # of 12 pairs in E385
NEXT_LEVEL = {"derived-read": 1.5, "group-retime": 1.5, "regroup": 1.5, "member-move": 1.5}
FRESH_MATERIAL = {"range-edit": {128}}  # real windows with fresh low-overlap instances (works 4-6)


def settled(glmm):
    """Performed contrasts that are settled in every cohort; C3/C4 is never settled here."""
    out = set()
    labels = {c["contrast"] for co in glmm["cohorts"].values() for c in co["performed"]["contrasts"]}
    for label in labels:
        ps = [c["profileP"] for co in glmm["cohorts"].values() for c in co["performed"]["contrasts"] if c["contrast"] == label]
        if all(p < SETTLED_P for p in ps):
            a, b = label.split(" vs ")
            out.add(frozenset((a, b)))
    return out


def part4(discordance, glmm):
    done = settled(glmm)
    cohorts = {}
    for c in discordance:
        open_comps = [x for x in c["comparisons"] if frozenset((x["a"], x["b"])) not in done]
        best = max(open_comps, key=lambda x: x["pairs"]["aOnly"] + x["pairs"]["bOnly"], default=None)
        n = best["pairs"]["aOnly"] + best["pairs"]["bOnly"] if best else 0
        entry = cohorts.setdefault(c["cohort"], {"retained": [], "dropped": [], "added": [], "materialLimited": []})
        record = {"family": c["family"], "level": c["level"], "maxOpenDiscordant": n, "comparison": f"{best['a']} vs {best['b']}" if best else None}
        if n < MIN_DISCORDANT:
            entry["dropped"].append(record)
        elif c["family"] in FRESH_MATERIAL and c["level"] not in FRESH_MATERIAL[c["family"]]:
            entry["materialLimited"].append(record)
        else:
            entry["retained"].append(record)
    for cohort, entry in cohorts.items():
        for family, factor in NEXT_LEVEL.items():
            kept = [r["level"] for r in entry["retained"] if r["family"] == family]
            if not kept:
                continue
            top = max(kept)
            rates = [x["passRate"] for c in discordance if (c["cohort"], c["family"], c["level"]) == (cohort, family, top)
                     for x in c["comparisons"] if x["a"] == "c4-fields" and x["b"] == "c3-fields"][0]
            if max(rates.values()) > 0.5:
                entry["added"].append({"family": family, "level": int(top * factor), "reason": f"an arm passes {max(rates.values()):.2f} at {top}"})
    return {
        "rule": {
            "settled": f"performed contrasts with profile p < {SETTLED_P} in every cohort",
            "settledPairs": sorted(sorted(p) for p in done),
            "retain": f"a cohort x family x level with at least {MIN_DISCORDANT} of 12 discordant pairs in some open planned comparison",
            "add": "one level 1.5x above a retained family's top level where an arm still passes more than half there",
            "material": "performed levels need fresh low-overlap windows (only 128-note range-edit has them)",
        },
        "cohorts": cohorts,
    }


def project(glmm, plan, n_sims=2000, seed=20261031):
    """Power of the retained E385 cells at 12 fresh instances x 1 repeat (new levels excluded)."""
    rng = np.random.default_rng(seed)
    tests = {"pooled": None, "reads": READ_FAMILIES, "writes": set(SOURCE_FAMILIES) - READ_FAMILIES}
    out = {}
    for cohort, c in glmm["cohorts"].items():
        fit = c["source"]
        keep = {(r["family"], r["level"]) for r in plan["cohorts"][cohort]["retained"] if r["family"] in SOURCE_FAMILIES}
        intercepts = {}
        for name, v in fit["fixed"].items():
            if name.startswith("cell:"):
                family, level = name[5:].split("@")
                if (family, int(level)) in keep:
                    intercepts[(family, int(level))] = v
        out[cohort] = simulate_power(fit, intercepts, n_sims, {"retained cells, 12 x 1": [1] * 12}, rng, tests)
    return out


def main():
    src, glmm_path, dst = sys.argv[1:4]
    data = json.load(open(src))
    rows = data["rows"]
    t = index(rows)
    glmm = json.load(open(glmm_path))
    out = {
        "schema": "r01-round2-design-v1",
        "source": src.split("/")[-1],
        "glmm": glmm_path.split("/")[-1],
        "discordance": part1(rows, t),
        "repeats": part2(rows, t),
        "power": part3(glmm),
    }
    out["nextPass"] = part4(out["discordance"], glmm)
    out["nextPass"]["projectedPower"] = project(glmm, out["nextPass"])
    json.dump(out, open(dst, "w"), indent=1)
    print(f"wrote {dst}", file=sys.stderr)


if __name__ == "__main__":
    main()
