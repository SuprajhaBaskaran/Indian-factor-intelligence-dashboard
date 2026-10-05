"""Backfill dashboard price JSON for current Nifty 500 search coverage.

This does not expand the recommendation model. It only exports verified NSE
monthly price observations from the existing bhavcopy parquet so the Stocks
page can chart current Nifty 500 names instead of showing missing price data.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pandas as pd
import pyarrow.dataset as ds


PROJECT_DIR = Path(__file__).resolve().parents[1]
NIFTY500_CSV = PROJECT_DIR / "data_input" / "ind_nifty500list.csv"
PARQUET_PATH = PROJECT_DIR / "historical_data" / "nse_cm_bhavcopy_daily.parquet"
STOCK_PRICES_JSON = PROJECT_DIR / "public" / "data" / "stock_prices.json"
AUDIT_JSON = PROJECT_DIR / "public" / "data" / "nifty500_data_audit.json"


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper().replace("-", "")


def load_nifty500_symbols() -> dict[str, str]:
    with NIFTY500_CSV.open(newline="", encoding="utf-8-sig") as stream:
        return {
            row["Symbol"].strip().upper(): normalize_symbol(row["Symbol"])
            for row in csv.DictReader(stream)
            if row.get("Symbol") and (row.get("Series") or "EQ").strip() == "EQ"
        }


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload, *, compact: bool = False) -> None:
    if compact:
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(payload, ensure_ascii=False, indent=2)
    path.write_text(f"{text}\n", encoding="utf-8")


def build_monthly_prices(raw_to_app_symbol: dict[str, str], existing_keys: set[tuple[str, str]]) -> list[dict]:
    dataset = ds.dataset(PARQUET_PATH, format="parquet")
    table = dataset.to_table(
        columns=["date", "symbol", "series", "open", "high", "low", "close", "traded_quantity"],
        filter=(ds.field("series") == "EQ") & ds.field("symbol").isin(sorted(raw_to_app_symbol)),
    )
    daily = table.to_pandas()
    if daily.empty:
        return []
    daily["symbol"] = daily["symbol"].astype(str).str.upper()
    daily["date"] = pd.to_datetime(daily["date"])
    daily["month"] = daily["date"].dt.strftime("%Y-%m")
    daily = daily.sort_values(["symbol", "date"], kind="stable")
    month_end = daily.groupby(["symbol", "month"], sort=False).tail(1).copy()
    volume = daily.groupby(["symbol", "month"], sort=False)["traded_quantity"].sum()
    sessions = sorted(daily["date"].dt.strftime("%Y-%m-%d").unique())

    def next_session(day: str) -> str | None:
        for session in sessions:
            if session > day:
                return session
        return None

    rows: list[dict] = []
    for row in month_end.itertuples(index=False):
        app_symbol = raw_to_app_symbol.get(str(row.symbol), str(row.symbol).replace("-", ""))
        key = (str(row.month), app_symbol)
        if key in existing_keys:
            continue
        close = float(row.close)
        signal_date = row.date.strftime("%Y-%m-%d")
        rows.append({
            "month": str(row.month),
            "symbol": app_symbol,
            "open": close,
            "high": close,
            "low": close,
            "close": close,
            "adjusted_close": close,
            "volume": int(volume.loc[(row.symbol, row.month)]),
            "signal_date": signal_date,
            "information_cutoff": f"{signal_date}T15:30:00+05:30",
            "execution_date": next_session(signal_date),
        })
    return rows


def coverage_band(count: int) -> str:
    if count <= 0:
        return "missing"
    if count < 12:
        return "thin"
    if count < 60:
        return "usable"
    return "strong"


def refresh_audit_from_prices(audit: dict, prices: list[dict]) -> dict:
    by_symbol: dict[str, list[dict]] = {}
    for price in prices:
        by_symbol.setdefault(str(price["symbol"]).upper(), []).append(price)

    symbol_price_coverage = 0
    strong_coverage = 0
    usable_or_strong = 0
    for row in audit["rows"]:
        symbol = str(row["symbol"]).upper()
        history = sorted(by_symbol.get(symbol, []), key=lambda item: item["month"])
        count = len(history)
        row["hasMonthlyPrice"] = count > 0
        row["priceIdentifier"] = "symbol" if count else None
        row["priceMonthCount"] = count
        row["firstPriceMonth"] = history[0]["month"] if history else None
        row["lastPriceMonth"] = history[-1]["month"] if history else None
        row["latestClose"] = history[-1]["adjusted_close"] if history else None
        row["priceCoverageBand"] = coverage_band(count)
        if count:
            symbol_price_coverage += 1
        if row["priceCoverageBand"] == "strong":
            strong_coverage += 1
        if row["priceCoverageBand"] in {"usable", "strong"}:
            usable_or_strong += 1

    summary = audit["summary"]
    summary["auditDate"] = pd.Timestamp.utcnow().isoformat()
    summary["monthlyPriceCoverage"] = symbol_price_coverage
    summary["symbolKeyedMonthlyPriceCoverage"] = symbol_price_coverage
    summary["isinKeyedMonthlyPriceCoverage"] = 0
    summary["strongPriceCoverage"] = strong_coverage
    summary["usableOrStrongPriceCoverage"] = usable_or_strong
    summary["readiness"]["currentDiscovery"] = "ready" if symbol_price_coverage == summary["officialConstituentRows"] else "partial"
    if symbol_price_coverage == summary["officialConstituentRows"]:
        summary["readiness"]["reason"] = (
            "Current Nifty 500 symbols now have exported monthly price coverage for stock search and charts. "
            "Model expansion still needs historical membership, fundamentals, and backtests."
        )
    missing_by_sector: dict[str, list[str]] = {}
    for row in audit["rows"]:
        if not row["hasMonthlyPrice"]:
            missing_by_sector.setdefault(row["industry"], []).append(row["symbol"])
    audit["missingSamples"] = {sector: symbols[:10] for sector, symbols in sorted(missing_by_sector.items())}
    return audit


def main() -> None:
    symbols = load_nifty500_symbols()
    prices = load_json(STOCK_PRICES_JSON)
    existing_keys = {(str(row["month"]), str(row["symbol"]).upper()) for row in prices}
    new_rows = build_monthly_prices(symbols, existing_keys)
    prices.extend(new_rows)
    prices.sort(key=lambda row: (row["month"], row["symbol"]))
    write_json(STOCK_PRICES_JSON, prices, compact=True)
    audit = refresh_audit_from_prices(load_json(AUDIT_JSON), prices)
    write_json(AUDIT_JSON, audit)
    print(json.dumps({
        "nifty500_symbols": len(symbols),
        "added_price_rows": len(new_rows),
        "covered_after": audit["summary"]["monthlyPriceCoverage"],
        "missing_after": audit["summary"]["officialConstituentRows"] - audit["summary"]["monthlyPriceCoverage"],
    }, indent=2))


if __name__ == "__main__":
    main()
