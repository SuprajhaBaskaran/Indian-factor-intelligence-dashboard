# Nifty 500 Data Audit

Audit date: 2026-10-05

## Decision

Do not switch the production model from Nifty 200 to Nifty 500 yet.

Nifty 500 is the right expansion target for more variety, but the current local data is only partially ready. It is acceptable for a discovery/watchlist layer after more price backfill, but not for a model/backtest universe until point-in-time Nifty 500 membership snapshots exist.

## Current Audit Result

Source file: `data_input/ind_nifty500list.csv`

Generated report: `public/data/nifty500_data_audit.json`

Summary:

- Official current Nifty 500 EQ rows in downloaded CSV: 495
- Current app production universe: Nifty 200
- Current model month: 2026-10
- Current selected model basket symbols found in Nifty 500: 59
- Incremental Nifty 500 symbols outside the current selected basket: 436
- Stock metadata coverage: 243 / 495
- Monthly price coverage: 246 / 495
- Monthly price coverage keyed by symbol: 243
- Monthly price coverage keyed by ISIN: 3
- Usable or strong monthly price coverage: 209 / 495
- Factor basket history coverage: 243 / 495
- Model target history coverage: 218 / 495
- Fundamentals rows currently available: 200

## Readiness

- Current discovery/watchlist: partial
- Model universe expansion: blocked
- Backtest: blocked

Reason:

The current Nifty 500 constituent file is available, but unbiased model expansion needs historical Nifty 500 membership snapshots. Using today's Nifty 500 list for historical backtests would introduce survivorship bias.

## Required Before Enabling Nifty 500 Model

1. Collect historical Nifty 500 membership snapshots.
2. Backfill monthly prices for missing current Nifty 500 constituents.
3. Backfill fundamentals and sector metadata for all current Nifty 500 symbols.
4. Resolve symbol/ISIN mapping consistently.
5. Re-run factor generation and backtests with point-in-time membership.
6. Add a UI universe selector only after the backtest report is clean.

## Recommended Product Path

Use a staged expansion:

1. Keep Nifty 200 as the live recommendation universe.
2. Add Nifty 500 as an audited discovery universe after price/metadata backfill.
3. Promote Nifty 500 to model universe only after historical membership and backtest validity pass.
