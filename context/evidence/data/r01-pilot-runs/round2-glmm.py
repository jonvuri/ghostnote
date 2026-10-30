# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy==2.5.4", "scipy==1.18.1", "statsmodels==0.15.0", "pandas==3.1.0"]
# ///
"""Mixed-effects logistic model for R01 round 2 first-attempt passes.

Usage (from the repository root):
    uv run --script context/evidence/data/r01-pilot-runs/round2-glmm.py \
        context/evidence/data/r01-pilot-runs/analysis-round2-v2-dev-r3.json \
        context/evidence/data/r01-pilot-runs/glmm-round2-v2-dev-r3.json

Model, per cohort (written down for pre-registration in the round 2 brief):

    logit P(pass) = a[family, level] + format terms + u[instance] + v[instance, format]
    u ~ N(0, su^2), v ~ N(0, sv^2)

`instance` is the (family, level, instance) cluster. `v` makes the repeats of
one instance in one format correlated, which is the clustering E385's
correction identified. A model with only `u` would treat those repeats as
independent and overstate the evidence again. `v` is estimated only when some
instance x format cell has repeats; with one run per cell it is not identified
(E387) and is pinned near zero.

Two fits per cohort:
- source: C3 FIELDS against C4 FIELDS on the source families, with a C4 term,
  and a pre-stated C4 x read term (reads = derived-read; writes = every other
  source family). Writes are the reference group.
- performed: all six primary arms on the performed families, format main
  effects, baseline JSON as the reference.

Estimation is penalized maximum likelihood (posterior mode): format terms
N(0, 2.5^2), cell intercepts N(0, 5^2), and a Gamma(2, 0) penalty on each
random-effect SD, which keeps the SD off the zero boundary (Chung et al. 2013,
as in R's blme). The marginal likelihood integrates both random effects with
nested Gauss-Hermite quadrature. Intervals are 95% profile intervals of the
penalized objective; Wald intervals are reported beside them.
"""

import json
import sys
from dataclasses import dataclass

import numpy as np
from scipy.optimize import brentq, minimize
from scipy.special import logsumexp

SOURCE_FAMILIES = ["derived-read", "group-retime", "regroup", "member-move", "preserve-exact"]
READ_FAMILIES = {"derived-read"}
PERFORMED_FAMILIES = ["range-edit", "preserve-performed", "selective-delete"]
PERFORMED_ARMS = ["baseline-json", "baseline-fields", "pp-midi-json", "pp-barbeat", "c3-fields", "c4-fields"]

FORMAT_PRIOR_SD = 2.5
CELL_PRIOR_SD = 5.0
QUAD_NODES = 30


@dataclass
class Design:
    y: np.ndarray
    X: np.ndarray  # fixed-effect design, rows x p
    names: list
    prior_sd: np.ndarray  # per fixed column
    cf_of_row: np.ndarray  # (cluster, format) index per row
    cluster_of_cf: np.ndarray  # cluster index per (cluster, format)
    n_cf: int
    n_cluster: int


def build_design(rows, families, arms, reference, read_term, format_prior_sd=FORMAT_PRIOR_SD):
    rows = [r for r in rows if r["family"] in families and r["arm"] in arms]
    cells = sorted({(r["family"], r["level"]) for r in rows}, key=lambda c: (families.index(c[0]), c[1]))
    others = [a for a in arms if a != reference]
    names = [f"cell:{f}@{l}" for f, l in cells] + [f"fmt:{a}" for a in others]
    if read_term:
        names += [f"fmt:{a}:read" for a in others]
    X = np.zeros((len(rows), len(names)))
    clusters, cfs = {}, {}
    cf_of_row = np.zeros(len(rows), dtype=int)
    for i, r in enumerate(rows):
        X[i, cells.index((r["family"], r["level"]))] = 1
        if r["arm"] != reference:
            j = len(cells) + others.index(r["arm"])
            X[i, j] = 1
            if read_term and r["family"] in READ_FAMILIES:
                X[i, j + len(others)] = 1
        ck = (r["family"], r["level"], r["instance"])
        clusters.setdefault(ck, len(clusters))
        cfk = (ck, r["arm"])
        cfs.setdefault(cfk, len(cfs))
        cf_of_row[i] = cfs[cfk]
    cluster_of_cf = np.zeros(len(cfs), dtype=int)
    for (ck, _), j in cfs.items():
        cluster_of_cf[j] = clusters[ck]
    prior = np.array([CELL_PRIOR_SD if n.startswith("cell:") else format_prior_sd for n in names])
    y = np.array([1.0 if r["firstAttemptPass"] else 0.0 for r in rows])
    return Design(y, X, names, prior, cf_of_row, cluster_of_cf, len(cfs), len(clusters)), rows


PINNED_LOG_SD = np.log(1e-4)


def has_repeats(d: Design):
    """True when some instance x format cell holds more than one run."""
    return np.bincount(d.cf_of_row, minlength=d.n_cf).max() > 1


class Model:
    def __init__(self, d: Design, nodes=QUAD_NODES, pin_v=None):
        self.d = d
        # The instance x format term is identified only through repeats. With
        # one run per instance and format it is confounded with Bernoulli
        # noise, so it is pinned near zero (E387); u then carries the clustering.
        self.pin_v = (not has_repeats(d)) if pin_v is None else pin_v
        x, w = np.polynomial.hermite_e.hermegauss(nodes)
        self.x, self.logw = x, np.log(w / w.sum())
        # Row -> (cluster, format) and (cluster, format) -> cluster summation matrices.
        self.S_cf = np.zeros((d.n_cf, len(d.y)))
        self.S_cf[d.cf_of_row, np.arange(len(d.y))] = 1
        self.S_cl = np.zeros((d.n_cluster, d.n_cf))
        self.S_cl[d.cluster_of_cf, np.arange(d.n_cf)] = 1
        self.p = d.X.shape[1]

    def loglik(self, theta):
        beta, log_su, log_sv = theta[: self.p], theta[self.p], theta[self.p + 1]
        if self.pin_v:
            log_sv = PINNED_LOG_SD
        su, sv = np.exp(log_su), np.exp(log_sv)
        eta = self.d.X @ beta
        x = self.x
        # eta[row, k (u node), m (v node)]
        e = eta[:, None, None] + su * x[None, :, None] + sv * x[None, None, :]
        y = self.d.y[:, None, None]
        ll = -np.logaddexp(0, np.where(y > 0, -e, e))
        n, K, M = ll.shape
        ll_cf = (self.S_cf @ ll.reshape(n, K * M)).reshape(self.d.n_cf, K, M)
        inner = logsumexp(ll_cf + self.logw[None, None, :], axis=2)  # cf x K
        ll_cl = self.S_cl @ inner  # cluster x K
        return logsumexp(ll_cl + self.logw[None, :], axis=1).sum()

    def penalty(self, theta):
        beta, log_s = theta[: self.p], theta[self.p :]
        # Gamma(2, 0) on each SD contributes log(s) to the log posterior; the
        # mode is taken on the SD scale, so no Jacobian term is added.
        if self.pin_v:
            log_s = log_s[:1]
        return 0.5 * np.sum((beta / self.d.prior_sd) ** 2) - np.sum(log_s)

    def objective(self, theta):
        return -self.loglik(theta) + self.penalty(theta)

    def fit(self, theta0=None, fixed=None):
        """Minimize the penalized objective. `fixed` = (contrast c, value t)."""
        if theta0 is None:
            theta0 = np.zeros(self.p + 2)
            theta0[self.p :] = np.log(0.5)
        if fixed is None:
            res = minimize(self.objective, theta0, method="L-BFGS-B")
            return res.x, res.fun
        c, t = fixed
        j = int(np.argmax(np.abs(c)))
        keep = np.arange(len(theta0)) != j

        def full(z):
            th = np.empty(len(theta0))
            th[keep] = z
            th[j] = (t - c[keep] @ z) / c[j]
            return th

        res = minimize(lambda z: self.objective(full(z)), theta0[keep], method="L-BFGS-B")
        return full(res.x), res.fun

    def hessian(self, theta, h=1e-4):
        """Hessian of the objective; with a pinned SD its row and column are unit."""
        n = len(theta)
        H = np.zeros((n, n))
        f0 = self.objective(theta)
        for i in range(n):
            for j in range(i, n):
                ei, ej = np.zeros(n), np.zeros(n)
                ei[i], ej[j] = h, h
                if i == j:
                    v = (self.objective(theta + ei) - 2 * f0 + self.objective(theta - ei)) / h**2
                else:
                    v = (
                        self.objective(theta + ei + ej)
                        - self.objective(theta + ei - ej)
                        - self.objective(theta - ei + ej)
                        + self.objective(theta - ei - ej)
                    ) / (4 * h**2)
                H[i, j] = H[j, i] = v
        if self.pin_v:
            k = self.p + 1
            H[k, :] = H[:, k] = 0
            H[k, k] = 1
        return H


def contrast(model, theta_hat, f_hat, cov, c, label, profile=True):
    est = float(c @ theta_hat)
    se = float(np.sqrt(c @ cov @ c))
    out = {
        "contrast": label,
        "logOdds": est,
        "oddsRatio": float(np.exp(est)),
        "wald95": [float(np.exp(est - 1.96 * se)), float(np.exp(est + 1.96 * se))],
        "waldP": float(2 * (1 - _norm_cdf(abs(est) / se))),
    }
    if profile:
        crit = 3.841458820694124  # chi-square(1) 95%

        def dev(t):
            _, f = model.fit(theta_hat, fixed=(c, t))
            return 2 * (f - f_hat) - crit

        lo = hi = None
        step = max(se, 0.25)
        for side in (-1, 1):
            a, b = est, est + side * 1.5 * step
            for _ in range(12):
                if dev(b) > 0:
                    break
                a, b = b, b + side * 1.5 * step
            else:
                b = None
            if b is not None:
                root = brentq(dev, min(a, b), max(a, b), xtol=1e-3)
                if side < 0:
                    lo = root
                else:
                    hi = root
        out["profile95"] = [
            float(np.exp(lo)) if lo is not None else None,
            float(np.exp(hi)) if hi is not None else None,
        ]
        _, f0 = model.fit(theta_hat, fixed=(c, 0.0))
        lr = max(0.0, 2 * (f0 - f_hat))
        out["profileP"] = float(_chi2_sf1(lr))
    return out


def _norm_cdf(z):
    from scipy.stats import norm

    return norm.cdf(z)


def _chi2_sf1(x):
    from scipy.stats import chi2

    return chi2.sf(x, 1)


def unit(names, *pairs):
    c = np.zeros(len(names) + 2)
    for name, coef in pairs:
        c[names.index(name)] += coef
    return c


def fit_source(rows, cohort, read_term=True, format_prior_sd=FORMAT_PRIOR_SD, nodes=QUAD_NODES, profile=True):
    d, used = build_design(
        [r for r in rows if r["cohort"] == cohort],
        SOURCE_FAMILIES,
        ["c3-fields", "c4-fields"],
        "c3-fields",
        read_term,
        format_prior_sd,
    )
    m = Model(d, nodes)
    theta, f = m.fit()
    cov = np.linalg.inv(m.hessian(theta))
    n = d.names
    contrasts = []
    if read_term:
        contrasts.append(contrast(m, theta, f, cov, unit(n, ("fmt:c4-fields", 1)), "C4 vs C3 FIELDS, writes", profile))
        contrasts.append(
            contrast(m, theta, f, cov, unit(n, ("fmt:c4-fields", 1), ("fmt:c4-fields:read", 1)), "C4 vs C3 FIELDS, reads", profile)
        )
        contrasts.append(contrast(m, theta, f, cov, unit(n, ("fmt:c4-fields:read", 1)), "read x C4 interaction (reads / writes)", profile))
    else:
        contrasts.append(contrast(m, theta, f, cov, unit(n, ("fmt:c4-fields", 1)), "C4 vs C3 FIELDS, all source families", profile))
    return summarize(m, theta, f, used, contrasts)


def fit_performed(rows, cohort, format_prior_sd=FORMAT_PRIOR_SD, nodes=QUAD_NODES, profile=True):
    d, used = build_design(
        [r for r in rows if r["cohort"] == cohort],
        PERFORMED_FAMILIES,
        PERFORMED_ARMS,
        "baseline-json",
        False,
        format_prior_sd,
    )
    m = Model(d, nodes)
    theta, f = m.fit()
    cov = np.linalg.inv(m.hessian(theta))
    n = d.names

    def arm(a, coef):
        return [] if a == "baseline-json" else [(f"fmt:{a}", coef)]

    contrasts = []
    for other in PERFORMED_ARMS:
        if other == "pp-barbeat":
            continue
        c = unit(n, *(arm(other, 1) + arm("pp-barbeat", -1)))
        contrasts.append(contrast(m, theta, f, cov, c, f"{other} vs pp-barbeat", profile))
    for other in ["c3-fields", "baseline-json", "baseline-fields", "pp-midi-json"]:
        c = unit(n, *(arm("c4-fields", 1) + arm(other, -1)))
        contrasts.append(contrast(m, theta, f, cov, c, f"c4-fields vs {other}", profile))
    return summarize(m, theta, f, used, contrasts)


def summarize(m, theta, f, used, contrasts):
    p = m.p
    return {
        "rows": len(used),
        "clusters": m.d.n_cluster,
        "clusterFormatCells": m.d.n_cf,
        "penalizedObjective": float(f),
        "logLik": float(m.loglik(theta)),
        "instanceSD": float(np.exp(theta[p])),
        "instanceFormatSD": None if m.pin_v else float(np.exp(theta[p + 1])),
        "instanceFormatTerm": "pinned (one run per instance and format)" if m.pin_v else "estimated",
        "fixed": {name: float(v) for name, v in zip(m.d.names, theta[:p])},
        "contrasts": contrasts,
    }


def statsmodels_check(rows, cohort):
    """Variational Bayes fit of the source model with the same random effects."""
    import pandas as pd
    from statsmodels.genmod.bayes_mixed_glm import BinomialBayesMixedGLM

    df = pd.DataFrame([r for r in rows if r["cohort"] == cohort and r["family"] in SOURCE_FAMILIES and r["arm"] in ("c3-fields", "c4-fields")])
    df["y"] = df["firstAttemptPass"].astype(int)
    df["cell"] = df["family"] + "@" + df["level"].astype(str)
    df["c4"] = (df["arm"] == "c4-fields").astype(int)
    df["c4read"] = df["c4"] * df["family"].isin(READ_FAMILIES).astype(int)
    df["inst"] = df["cell"] + "#" + df["instance"].astype(str)
    df["instfmt"] = df["inst"] + "/" + df["arm"]
    model = BinomialBayesMixedGLM.from_formula(
        "y ~ 0 + C(cell) + c4 + c4read", {"inst": "0 + C(inst)", "instfmt": "0 + C(instfmt)"}, df, vcp_p=1, fe_p=FORMAT_PRIOR_SD
    )
    r = model.fit_vb()
    names = model.exog_names
    i4, ir = names.index("c4"), names.index("c4read")
    return {
        "method": "statsmodels BinomialBayesMixedGLM.fit_vb (posterior means)",
        "c4Writes": float(r.fe_mean[i4]),
        "c4Reads": float(r.fe_mean[i4] + r.fe_mean[ir]),
        "readInteraction": float(r.fe_mean[ir]),
        "instanceSD": float(np.exp(r.vcp_mean[0])),
        "instanceFormatSD": float(np.exp(r.vcp_mean[1])),
    }


def main():
    src, dst = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    rows = [r for r in data["rows"] if r["role"] == "primary"]
    cohorts = sorted({r["cohort"] for r in rows})
    out = {
        "schema": "r01-round2-glmm-v1",
        "source": src.split("/")[-1],
        "package": data["package"],
        "model": {
            "formula": "pass ~ cell(family, level) + format [+ format:read] + (1 | instance) + (1 | instance:format)",
            "readFamilies": sorted(READ_FAMILIES),
            "sourceFamilies": SOURCE_FAMILIES,
            "performedFamilies": PERFORMED_FAMILIES,
            "performedReference": "baseline-json",
            "priors": {"format": f"N(0, {FORMAT_PRIOR_SD}^2)", "cell": f"N(0, {CELL_PRIOR_SD}^2)", "randomSD": "Gamma(2, 0) mode penalty"},
            "quadratureNodes": QUAD_NODES,
            "intervals": "95% profile of the penalized objective; Wald beside",
        },
        "cohorts": {},
    }
    for cohort in cohorts:
        print(f"fitting {cohort}", file=sys.stderr)
        performed = any(r["cohort"] == cohort and r["family"] in PERFORMED_FAMILIES for r in rows)
        out["cohorts"][cohort] = {
            "source": fit_source(rows, cohort),
            "sourcePooled": fit_source(rows, cohort, read_term=False),
            # Package v3 runs no performed family for Haiku (R01-D18).
            "performed": fit_performed(rows, cohort) if performed else None,
            "sensitivity": {
                "sourceFormatPriorSD10": fit_source(rows, cohort, format_prior_sd=10.0, profile=False)["contrasts"],
                "source50Nodes": fit_source(rows, cohort, nodes=50, profile=False)["contrasts"],
                "sourceNoInstanceFormatTerm": _no_v(rows, cohort),
                "statsmodelsVB": statsmodels_check(rows, cohort),
            },
        }
    json.dump(out, open(dst, "w"), indent=1)
    print(f"wrote {dst}", file=sys.stderr)


def _no_v(rows, cohort):
    """Same source model with the instance x format term pinned near zero, to show
    how much that term changes the evidence."""
    d, _ = build_design([r for r in rows if r["cohort"] == cohort], SOURCE_FAMILIES, ["c3-fields", "c4-fields"], "c3-fields", True)
    m = Model(d, pin_v=True)
    theta, f = m.fit()
    cov = np.linalg.inv(m.hessian(theta))
    n = d.names
    return [
        contrast(m, theta, f, cov, unit(n, ("fmt:c4-fields", 1)), "C4 vs C3 FIELDS, writes", False),
        contrast(m, theta, f, cov, unit(n, ("fmt:c4-fields", 1), ("fmt:c4-fields:read", 1)), "C4 vs C3 FIELDS, reads", False),
    ]


if __name__ == "__main__":
    main()
