# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy==2.5.4", "scipy==1.18.1", "statsmodels==0.15.0", "pandas==3.1.0"]
# ///
"""Family-level C4 effects for the R01 round 2 format-dependent families (R01-D21).

Usage (from the repository root):
    uv run --script context/evidence/data/r01-pilot-runs/round2-glmm-families.py \
        context/evidence/data/r01-pilot-runs/analysis-round2-v6-dev.json \
        context/evidence/data/r01-pilot-runs/glmm-round2-v6-dev.json

Per model, C3 against C4 FIELDS, first-attempt pass. The estimator, priors,
quadrature and profile intervals are round2-glmm.py's (E386/E387); with one
run per instance and format, the instance x format term is pinned (E387).

    pooled:     logit P = cell(family, level) + c4 + u(instance)
    by family:  logit P = cell(family, level) + c4[family] + u(instance)

All four families are writes, so no read term applies. Exact two-sided sign
tests on discordant pairs are reported per family, overall, and on the levels
chosen for each model (R01-D21), beside the model.
"""

import importlib.util
import json
import sys
from math import comb
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location("glmm", Path(__file__).with_name("round2-glmm.py"))
glmm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(glmm)

FAMILIES = ["query-edit", "overlap-edit", "large-edit", "interp-maintain"]
ARMS = ["c3-fields", "c4-fields"]
LEVELS = {
    "luna": {"query-edit": [8, 16], "overlap-edit": [4, 6], "large-edit": [128, 256], "interp-maintain": [2, 4]},
    "haiku": {"query-edit": [64, 96], "overlap-edit": [24], "large-edit": [], "interp-maintain": [32]},
}


def design(rows, by_family):
    rows = [r for r in rows if r["family"] in FAMILIES and r["arm"] in ARMS]
    cells = sorted({(r["family"], r["level"]) for r in rows}, key=lambda c: (FAMILIES.index(c[0]), c[1]))
    fams = [f for f in FAMILIES if any(r["family"] == f for r in rows)]
    fmt = [f"fmt:c4-fields:{f}" for f in fams] if by_family else ["fmt:c4-fields"]
    names = [f"cell:{f}@{l}" for f, l in cells] + fmt
    X = np.zeros((len(rows), len(names)))
    clusters, cfs = {}, {}
    cf_of_row = np.zeros(len(rows), dtype=int)
    for i, r in enumerate(rows):
        X[i, cells.index((r["family"], r["level"]))] = 1
        if r["arm"] == "c4-fields":
            X[i, len(cells) + (fams.index(r["family"]) if by_family else 0)] = 1
        ck = (r["family"], r["level"], r["instance"])
        clusters.setdefault(ck, len(clusters))
        cfs.setdefault((ck, r["arm"]), len(cfs))
        cf_of_row[i] = cfs[(ck, r["arm"])]
    cluster_of_cf = np.zeros(len(cfs), dtype=int)
    for (ck, _), j in cfs.items():
        cluster_of_cf[j] = clusters[ck]
    prior = np.array([glmm.CELL_PRIOR_SD if n.startswith("cell:") else glmm.FORMAT_PRIOR_SD for n in names])
    y = np.array([1.0 if r["firstAttemptPass"] else 0.0 for r in rows])
    return glmm.Design(y, X, names, prior, cf_of_row, cluster_of_cf, len(cfs), len(clusters)), fams


def fit(rows, by_family):
    d, fams = design(rows, by_family)
    m = glmm.Model(d)
    theta, f = m.fit()
    cov = np.linalg.inv(m.hessian(theta))
    if by_family:
        contrasts = [glmm.contrast(m, theta, f, cov, glmm.unit(d.names, (f"fmt:c4-fields:{fam}", 1)), f"C4 vs C3 FIELDS, {fam}") for fam in fams]
    else:
        contrasts = [glmm.contrast(m, theta, f, cov, glmm.unit(d.names, ("fmt:c4-fields", 1)), "C4 vs C3 FIELDS, all families")]
    return {"instanceSD": float(np.exp(theta[m.p])), "instanceFormatPinned": bool(m.pin_v), "rows": len(d.y), "contrasts": contrasts}


def sign_test(rows, keep=lambda r: True):
    pairs = {}
    for r in rows:
        if r["family"] in FAMILIES and r["arm"] in ARMS and keep(r):
            pairs.setdefault((r["family"], r["level"], r["instance"]), {})[r["arm"]] = r["firstAttemptPass"]
    full = [p for p in pairs.values() if len(p) == 2]
    c3 = sum(1 for p in full if p["c3-fields"] and not p["c4-fields"])
    c4 = sum(1 for p in full if p["c4-fields"] and not p["c3-fields"])
    n, k = c3 + c4, min(c3, c4)
    p = min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2**n) if n else 1.0
    return {"pairs": len(full), "bothPass": sum(1 for x in full if all(x.values())), "bothFail": sum(1 for x in full if not any(x.values())),
            "c3Only": c3, "c4Only": c4, "signP": p}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    rows = [r for r in data["rows"] if r["role"] == "primary"]
    out = {"schema": "r01-round2-glmm-families-v1", "source": src.split("/")[-1], "package": data["package"],
           "model": {"pooled": "pass ~ cell(family, level) + c4 + (1 | instance)", "byFamily": "pass ~ cell(family, level) + c4:family + (1 | instance)",
                     "estimator": "round2-glmm.py (penalized ML, profile intervals); instance x format pinned without repeats"},
           "cohorts": {}}
    for cohort in sorted({r["cohort"] for r in rows}):
        print(f"fitting {cohort}", file=sys.stderr)
        cr = [r for r in rows if r["cohort"] == cohort]
        out["cohorts"][cohort] = {
            "pooled": fit(cr, False),
            "byFamily": fit(cr, True),
            "signTests": {
                "all": sign_test(cr),
                **{fam: sign_test(cr, lambda r, fam=fam: r["family"] == fam) for fam in FAMILIES},
                **{f"{who}Levels": sign_test(cr, lambda r, lv=lv: r["level"] in lv.get(r["family"], [])) for who, lv in LEVELS.items()},
            },
        }
    json.dump(out, open(dst, "w"), indent=1)
    print(f"wrote {dst}", file=sys.stderr)


if __name__ == "__main__":
    main()
