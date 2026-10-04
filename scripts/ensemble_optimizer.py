"""Bayesian-tuned weighted ensemble for the factor allocation layer.

The dashboard already has a walk-forward GMM regime model. This companion
module does not replace it. It evaluates a small family of allocation signals
against historical factor returns, then uses a Bayesian-style surrogate search
to choose both:

* the weights assigned to each model family, and
* the optimiser hyperparameters used by the allocation agent.

The output is intentionally a plain JSON artifact so the frontend can explain
the method without rerunning the research code in the browser.
"""

from __future__ import annotations

import datetime as _dt
import json
import math
import os
from pathlib import Path
from typing import Any

import numpy as np

try:  # scikit-learn is already used by the research pipeline.
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import ConstantKernel, Matern, WhiteKernel
except Exception:  # pragma: no cover - fallback path for minimal environments
    GaussianProcessRegressor = None
    ConstantKernel = Matern = WhiteKernel = None


FACTOR_KEYS = ("momentum", "value", "quality", "low_volatility")
FACTOR_LABELS = ("Momentum", "Value", "Quality", "Low Volatility")
MODEL_KEYS = ("gmm_regime", "hmm_persistence", "jump_risk", "bayesian_recent")


def _month(row: dict[str, Any]) -> str:
    return str(row.get("month", ""))[:7]


def _float(value: Any, default: float = 0.0) -> float:
    try:
        x = float(value)
        return x if math.isfinite(x) else default
    except (TypeError, ValueError):
        return default


def news_stress_score(news: dict[str, Any] | None) -> float:
    if not news:
        return 0.0
    sentiment = _float(news.get("news_sentiment", news.get("sentiment_score")), 0.0)
    negative = max(0.0, min(1.0, _float(news.get("negative_news_ratio", news.get("negative_ratio")), 0.0)))
    events = max(0.0, _float(news.get("risk_event_count"), 0.0))
    confidence = max(0.0, min(1.0, _float(news.get("news_confidence"), 0.0)))
    raw = 0.45 * negative + 0.35 * min(1.0, events / 50.0) + 0.20 * max(0.0, -sentiment)
    return round(max(0.0, min(1.0, raw * max(confidence, 0.35))), 4)


def _make_lookups(
    diagnostics: list[dict[str, Any]],
    regimes: list[dict[str, Any]],
    news_features: list[dict[str, Any]] | None,
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    return (
        {_month(d): d for d in diagnostics},
        {_month(r): r for r in regimes},
        {_month(n): n for n in (news_features or [])},
    )


def _candidate_weights(rng: np.random.Generator, count: int = 36) -> list[dict[str, float]]:
    anchors = [
        (0.35, 0.30, 0.20, 0.15),
        (0.25, 0.25, 0.25, 0.25),
        (0.45, 0.20, 0.20, 0.15),
        (0.20, 0.35, 0.25, 0.20),
        (0.25, 0.20, 0.35, 0.20),
        (0.20, 0.20, 0.20, 0.40),
    ]
    out = [dict(zip(MODEL_KEYS, w)) for w in anchors]
    for _ in range(max(0, count - len(out))):
        raw = rng.dirichlet(np.array([2.2, 1.8, 1.7, 1.6]))
        out.append(dict(zip(MODEL_KEYS, [round(float(x), 4) for x in raw])))
    return out


def _param_candidates(rng: np.random.Generator) -> list[dict[str, Any]]:
    base = []
    for er_window in (18, 24, 36):
        for er_halflife in (6.0, 12.0, 18.0):
            for turnover_penalty in (0.01, 0.02, 0.04):
                base.append(
                    {
                        "er_window": er_window,
                        "er_halflife": er_halflife,
                        "turnover_penalty": turnover_penalty,
                        "concentration_penalty": float(rng.choice([0.03, 0.05, 0.08])),
                        "news_multiplier": float(rng.choice([0.75, 1.0, 1.25, 1.5])),
                    }
                )
    rng.shuffle(base)
    return base


def _regime_tilt(
    regime: dict[str, Any],
    base_er: np.ndarray,
    news_stress: float,
    model_weights: dict[str, float],
) -> np.ndarray:
    label = str(regime.get("regime_label") or "Sideways / Neutral")
    confidence = max(0.0, min(1.0, _float(regime.get("regime_confidence"), 0.5)))
    transition = max(0.0, min(1.0, _float(regime.get("transition_risk"), 0.5)))

    gmm_profile = {
        "Bull / Expansion": np.array([0.014, 0.006, 0.004, -0.006]),
        "Recovery": np.array([0.009, 0.010, 0.006, -0.004]),
        "Sideways / Neutral": np.array([-0.002, 0.004, 0.008, 0.006]),
        "Bear / Stress": np.array([-0.014, -0.007, 0.010, 0.014]),
        "High Volatility / Risk-Off": np.array([-0.016, -0.010, 0.012, 0.016]),
    }.get(label, np.zeros(4))

    # HMM-style persistence: a stable state lets the current factor trend keep
    # more influence; a likely transition shifts toward quality/low volatility.
    persistence = 1.0 - transition
    recent_direction = np.tanh(base_er * 30.0) * 0.006
    hmm_profile = persistence * recent_direction + transition * np.array([-0.006, -0.003, 0.005, 0.008])

    # Jump-risk sleeve: abrupt regime/news stress suppresses cyclical risk.
    jump = max(transition, news_stress)
    jump_profile = jump * np.array([-0.012, -0.008, 0.009, 0.013])

    # Bayesian recent-reliability sleeve: shrink noisy forecasts toward zero
    # while keeping the sign of stronger recent evidence.
    bayes_profile = np.tanh(base_er * 18.0) * 0.008

    return (
        model_weights.get("gmm_regime", 0.0) * confidence * gmm_profile
        + model_weights.get("hmm_persistence", 0.0) * hmm_profile
        + model_weights.get("jump_risk", 0.0) * jump_profile
        + model_weights.get("bayesian_recent", 0.0) * bayes_profile
    )


def adjusted_expected_returns(
    base_er: np.ndarray,
    regime: dict[str, Any],
    news: dict[str, Any] | None,
    model_weights: dict[str, float],
    news_multiplier: float = 1.0,
) -> np.ndarray:
    ns = news_stress_score(news)
    er = base_er + _regime_tilt(regime, base_er, ns, model_weights)
    if ns > 0:
        er = er + news_multiplier * ns * np.array([-0.035, -0.020, 0.012, 0.018])
    return er


def _covariance(diag: dict[str, Any] | None) -> np.ndarray:
    if diag and diag.get("covariance_matrix"):
        cm = diag["covariance_matrix"]
        try:
            cand = np.array([[cm[fi][fj] for fj in FACTOR_KEYS] for fi in FACTOR_KEYS], dtype=float)
            if np.all(np.isfinite(cand)):
                return cand
        except (KeyError, TypeError, ValueError):
            pass
    return np.eye(4) * (0.04**2)


def _select_weights(
    er: np.ndarray,
    cov: np.ndarray,
    prev_weights: np.ndarray,
    redundancy: float,
    turnover_penalty: float,
    concentration_penalty: float,
) -> np.ndarray:
    best_w = np.array([0.25, 0.25, 0.25, 0.25])
    best_util = -1e9
    for w0 in np.arange(0, 0.55, 0.05):
        for w1 in np.arange(0, 0.55, 0.05):
            for w2 in np.arange(0, 0.55, 0.05):
                w3 = 1 - w0 - w1 - w2
                if w3 < -0.001 or w3 > 0.501:
                    continue
                w = np.array([w0, w1, w2, w3])
                if w.sum() <= 0:
                    continue
                wn = w / w.sum()
                mu = float(np.dot(wn, er))
                sd = math.sqrt(max(1e-12, float(wn @ cov @ wn)))
                turnover = float(np.sum(np.abs(wn - prev_weights)))
                concentration = float(np.sum(wn * wn))
                util = (
                    mu / sd
                    - turnover_penalty * turnover
                    - concentration_penalty * (redundancy + 0.25) * concentration
                )
                if util > best_util:
                    best_util = util
                    best_w = wn.copy()
    return best_w / best_w.sum()


def _trailing_er(history: list[dict[str, Any]], halflife: float) -> np.ndarray:
    ages = np.arange(len(history) - 1, -1, -1, dtype=float)
    decay = 0.5 ** (ages / max(1.0, halflife))
    decay = decay / decay.sum()
    return np.array(
        [
            float(np.dot(decay, [_float(h.get(k + "_return"), 0.0) for h in history]))
            for k in FACTOR_KEYS
        ]
    )


def _evaluate_candidate(
    candidate: dict[str, Any],
    factor_returns: list[dict[str, Any]],
    diag_lookup: dict[str, dict[str, Any]],
    regime_lookup: dict[str, dict[str, Any]],
    news_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    er_window = int(candidate["er_window"])
    halflife = float(candidate["er_halflife"])
    turnover_penalty = float(candidate["turnover_penalty"])
    concentration_penalty = float(candidate["concentration_penalty"])
    news_multiplier = float(candidate["news_multiplier"])
    model_weights = candidate["model_weights"]

    prev = np.array([0.25, 0.25, 0.25, 0.25])
    realised_returns: list[float] = []
    turnovers: list[float] = []
    concentrations: list[float] = []
    monthly_weights: list[np.ndarray] = []

    for idx, fr in enumerate(factor_returns):
        history = factor_returns[max(0, idx - er_window) : idx]
        if len(history) < 12:
            continue
        month = _month(fr)
        base_er = _trailing_er(history, halflife)
        er = adjusted_expected_returns(
            base_er,
            regime_lookup.get(month, {}),
            news_lookup.get(month, {}),
            model_weights,
            news_multiplier,
        )
        diag = diag_lookup.get(month, {})
        redundancy = _float(diag.get("redundancy_score"), 0.0)
        weights = _select_weights(
            er,
            _covariance(diag),
            prev,
            redundancy,
            turnover_penalty,
            concentration_penalty,
        )
        realised = np.array([_float(fr.get(k + "_return"), 0.0) for k in FACTOR_KEYS])
        realised_returns.append(float(np.dot(weights, realised)))
        turnovers.append(float(np.sum(np.abs(weights - prev))))
        concentrations.append(float(np.sum(weights * weights)))
        monthly_weights.append(weights)
        prev = weights

    if not realised_returns:
        return {"score": -999.0, "sharpe": 0.0, "max_drawdown": 0.0, "hit_rate": 0.0}

    rets = np.array(realised_returns, dtype=float)
    avg = float(np.mean(rets))
    vol = float(np.std(rets, ddof=1)) if len(rets) > 1 else 0.0
    sharpe = avg / vol * math.sqrt(12.0) if vol > 1e-9 else 0.0
    equity = np.cumprod(1.0 + rets)
    peaks = np.maximum.accumulate(equity)
    drawdowns = equity / np.maximum(peaks, 1e-9) - 1.0
    max_drawdown = float(np.min(drawdowns))
    hit_rate = float(np.mean(rets > 0))
    avg_turnover = float(np.mean(turnovers))
    avg_concentration = float(np.mean(concentrations))
    score = sharpe - 0.75 * abs(max_drawdown) - 0.20 * avg_turnover - 0.10 * avg_concentration + 0.05 * hit_rate

    return {
        "score": round(score, 6),
        "sharpe": round(sharpe, 6),
        "max_drawdown": round(max_drawdown, 6),
        "hit_rate": round(hit_rate, 6),
        "avg_turnover": round(avg_turnover, 6),
        "avg_concentration": round(avg_concentration, 6),
        "sample_months": len(rets),
        "cumulative_return": round(float(equity[-1] - 1.0), 6),
    }


def _encode(candidate: dict[str, Any]) -> list[float]:
    mw = candidate["model_weights"]
    return [
        float(candidate["er_window"]) / 36.0,
        float(candidate["er_halflife"]) / 18.0,
        float(candidate["turnover_penalty"]) / 0.04,
        float(candidate["concentration_penalty"]) / 0.08,
        float(candidate["news_multiplier"]) / 1.5,
        *[float(mw[k]) for k in MODEL_KEYS],
    ]


def _candidate_key(candidate: dict[str, Any]) -> str:
    mw = candidate["model_weights"]
    return "|".join(
        [
            str(candidate["er_window"]),
            str(candidate["er_halflife"]),
            str(candidate["turnover_penalty"]),
            str(candidate["concentration_penalty"]),
            str(candidate["news_multiplier"]),
            *[f"{mw[k]:.4f}" for k in MODEL_KEYS],
        ]
    )


def _model_family_baselines(
    factor_returns: list[dict[str, Any]],
    diag_lookup: dict[str, dict[str, Any]],
    regime_lookup: dict[str, dict[str, Any]],
    news_lookup: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = []
    for key in MODEL_KEYS:
        candidate = {
            "er_window": 24,
            "er_halflife": 12.0,
            "turnover_penalty": 0.02,
            "concentration_penalty": 0.05,
            "news_multiplier": 1.0,
            "model_weights": {k: (1.0 if k == key else 0.0) for k in MODEL_KEYS},
        }
        metrics = _evaluate_candidate(candidate, factor_returns, diag_lookup, regime_lookup, news_lookup)
        rows.append({"model": key, **metrics})
    return sorted(rows, key=lambda x: x["score"], reverse=True)


def optimize_allocation_ensemble(
    factor_returns: list[dict[str, Any]],
    diagnostics: list[dict[str, Any]],
    regimes: list[dict[str, Any]],
    news_features: list[dict[str, Any]] | None = None,
    seed: int = 42,
) -> dict[str, Any]:
    rng = np.random.default_rng(seed)
    diag_lookup, regime_lookup, news_lookup = _make_lookups(diagnostics, regimes, news_features)
    weight_candidates = _candidate_weights(rng)
    param_candidates = _param_candidates(rng)

    candidates: list[dict[str, Any]] = []
    for params in param_candidates[:28]:
        for weights in weight_candidates[:10]:
            candidates.append({**params, "model_weights": weights})

    evaluated: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {}

    def eval_one(candidate: dict[str, Any]) -> None:
        key = _candidate_key(candidate)
        if key in evaluated:
            return
        metrics = _evaluate_candidate(candidate, factor_returns, diag_lookup, regime_lookup, news_lookup)
        evaluated[key] = (candidate, metrics)

    for candidate in candidates[:40]:
        eval_one(candidate)

    if GaussianProcessRegressor is not None and len(evaluated) >= 8:
        pool = []
        for params in param_candidates:
            for weights in _candidate_weights(rng, 20):
                pool.append({**params, "model_weights": weights})
        rng.shuffle(pool)
        pool = pool[:220]

        for _ in range(12):
            xs = np.array([_encode(c) for c, _m in evaluated.values()], dtype=float)
            ys = np.array([m["score"] for _c, m in evaluated.values()], dtype=float)
            kernel = ConstantKernel(1.0, constant_value_bounds="fixed") * Matern(nu=2.5) + WhiteKernel(noise_level=1e-5)
            gp = GaussianProcessRegressor(kernel=kernel, normalize_y=True, random_state=seed)
            gp.fit(xs, ys)
            unevaluated = [c for c in pool if _candidate_key(c) not in evaluated]
            if not unevaluated:
                break
            px = np.array([_encode(c) for c in unevaluated], dtype=float)
            mu, sigma = gp.predict(px, return_std=True)
            pick = int(np.argmax(mu + 0.6 * sigma))
            eval_one(unevaluated[pick])
    else:
        for candidate in candidates[40:76]:
            eval_one(candidate)

    ranked = sorted(evaluated.values(), key=lambda item: item[1]["score"], reverse=True)
    best_candidate, best_metrics = ranked[0]
    baselines = _model_family_baselines(factor_returns, diag_lookup, regime_lookup, news_lookup)
    winner = baselines[0] if baselines else {}
    latest_month = _month(factor_returns[-1]) if factor_returns else None

    leaderboard = []
    for rank, (candidate, metrics) in enumerate(ranked[:8], start=1):
        leaderboard.append(
            {
                "rank": rank,
                "score": metrics["score"],
                "sharpe": metrics["sharpe"],
                "max_drawdown": metrics["max_drawdown"],
                "hit_rate": metrics["hit_rate"],
                "er_window": candidate["er_window"],
                "er_halflife": candidate["er_halflife"],
                "turnover_penalty": candidate["turnover_penalty"],
                "concentration_penalty": candidate["concentration_penalty"],
                "news_multiplier": candidate["news_multiplier"],
                "model_weights": candidate["model_weights"],
            }
        )

    return {
        "generated_at": _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "method": "Bayesian-tuned weighted ensemble",
        "selection_mode": "weighted_ensemble",
        "latest_month": latest_month,
        "candidate_count": len(evaluated),
        "objective": {
            "score": "walk-forward Sharpe minus drawdown, turnover, and concentration penalties plus a small hit-rate reward",
            "why_weighted_ensemble": "Keeps more information than a winner-take-all model and adapts the contribution of each model family using out-of-sample walk-forward evidence.",
        },
        "selected_parameters": {
            "er_window": best_candidate["er_window"],
            "er_halflife": best_candidate["er_halflife"],
            "turnover_penalty": best_candidate["turnover_penalty"],
            "concentration_penalty": best_candidate["concentration_penalty"],
            "news_multiplier": best_candidate["news_multiplier"],
        },
        "selected_model_weights": {
            key: round(float(best_candidate["model_weights"][key]), 4)
            for key in MODEL_KEYS
        },
        "selected_metrics": best_metrics,
        "winner_baseline": winner,
        "model_family_baselines": baselines,
        "leaderboard": leaderboard,
        "component_definitions": {
            "gmm_regime": "Existing walk-forward GMM market-regime model.",
            "hmm_persistence": "HMM-style state persistence signal that rewards stable regimes and reduces risk when transitions rise.",
            "jump_risk": "Jump-risk signal that reacts to abrupt transition risk and news stress.",
            "bayesian_recent": "Bayesian-style recent reliability sleeve that shrinks noisy factor forecasts toward zero.",
        },
    }


def _load_json(data_dir: Path, name: str) -> Any:
    with (data_dir / f"{name}.json").open(encoding="utf-8") as fh:
        return json.load(fh)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    data_dir = root / "public" / "data"
    report = optimize_allocation_ensemble(
        _load_json(data_dir, "factor_returns"),
        _load_json(data_dir, "factor_diagnostics"),
        _load_json(data_dir, "regime_predictions"),
        _load_json(data_dir, "news_features") if (data_dir / "news_features.json").exists() else None,
    )
    out = data_dir / "ensemble_optimizer.json"
    with out.open("w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print(f"Wrote {os.path.relpath(out, root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
