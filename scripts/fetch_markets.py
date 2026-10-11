#!/usr/bin/env python3
"""
Refreshes quartz/static/market-data.json (Market Desk tiles, curve,
headlines, calendar) and quartz/static/market-history.json (rolling
per-instrument history plus the Treasury curve since 1990, used by the
sparklines and the Workshop yield curve explorer).

Every tile carries its own as_of date because sources publish on
different schedules. A failed or out-of-bounds fetch never overwrites a
good value: the tile keeps its last good data, is marked stale, and the
error is printed (as a GitHub Actions warning when run there).

Optional environment (repo secrets in CI):
    FRED_API_KEY:  without it, falls back to FRED's public CSV endpoint
    ECOS_API_KEY:  without it, uses ECOS's rate-limited "sample" key

Run manually with:
    python3 scripts/fetch_markets.py
"""

from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent))
import market_sources as src  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "quartz" / "static" / "market-data.json"
HISTORY_PATH = ROOT / "quartz" / "static" / "market-history.json"

SPARK_LEN = 60
HISTORY_LEN = 400  # sessions of per-instrument history kept
CURVE_START_YEAR = 1990
HEADLINE_COUNT = 10
CALENDAR_COUNT = 7

ERRORS: list[str] = []


def warn(msg: str) -> None:
    ERRORS.append(msg)
    prefix = "::warning::" if os.environ.get("GITHUB_ACTIONS") else "WARN "
    print(f"{prefix}{msg}", file=sys.stderr)


# ------------------------------------------------------------------
# Tile definitions
# ------------------------------------------------------------------
@dataclass
class Tile:
    key: str
    label: str
    group: str
    unit: str  # "pct" (yield), "bp" (spread), "level", "fx"
    lo: float
    hi: float
    source: str
    source_url: str
    tier: int = 1
    note: str | None = None
    lag_bd: int = 1  # business days the source normally trails the session
    decimals: int = 2
    fetch: Callable[[], src.Series] | None = None  # None => derived from the curve
    series: src.Series = field(default_factory=list)


def _tsy(label: str, key: str, tenor: str, lo: float, hi: float) -> Tile:
    return Tile(key, label, "rates", "pct", lo, hi, "U.S. Treasury", src.TSY_PAGE, note=f"Par yield, {tenor}")


ECB_NOTE = "14:10 CET fix, info only, not a NY close"
# Tier 2 tiles also get an "Unofficial" badge on the page.
YAHOO_SOURCE = "Yahoo Finance"

TILES: list[Tile] = [
    # Rates (derived from the curve below)
    _tsy("3M", "UST3M", "3 month", 0, 15),
    _tsy("2Y", "UST2Y", "2 year", 0, 15),
    _tsy("3Y", "UST3Y", "3 year", 0, 15),
    _tsy("5Y", "UST5Y", "5 year", 0, 15),
    _tsy("10Y", "UST10Y", "10 year", 0, 15),
    _tsy("30Y", "UST30Y", "30 year", 0, 15),
    Tile("S2S10", "2s10s", "rates", "bp", -300, 400, "U.S. Treasury", src.TSY_PAGE,
         note="10Y minus 2Y par yield", decimals=0),
    Tile("S3M10Y", "3m10y", "rates", "bp", -400, 500, "U.S. Treasury", src.TSY_PAGE,
         note="10Y minus 3M par yield", decimals=0),
    # US equities: index levels with attribution (FRED marks these "Copyrighted:
    # Pre-Approval Required"; shown with full attribution by the owner's choice)
    Tile("SPX", "S&P 500", "us_index", "level", 500, 30000, "S&P DJI via FRED", src.fred_page("SP500"),
         note="© S&P Dow Jones Indices LLC", fetch=lambda: src.fred_series("SP500")),
    Tile("CCMP", "Nasdaq Composite", "us_index", "level", 1000, 100000, "Nasdaq via FRED", src.fred_page("NASDAQCOM"),
         note="© Nasdaq, Inc.", fetch=lambda: src.fred_series("NASDAQCOM")),
    Tile("INDU", "Dow Jones Industrial Avg", "us_index", "level", 5000, 200000, "S&P DJI via FRED",
         src.fred_page("DJIA"), note="© S&P Dow Jones Indices LLC", fetch=lambda: src.fred_series("DJIA")),
    Tile("RTY", "Russell 2000", "us_index", "level", 300, 10000, YAHOO_SOURCE, src.yahoo_page("^RUT"), tier=2,
         note="FTSE Russell index", fetch=lambda: src.yahoo_series("^RUT")),
    # Volatility (shown in the US equities panel)
    Tile("VIX", "VIX", "us_index", "level", 5, 150, "Cboe via FRED", src.fred_page("VIXCLS"),
         note="© Cboe Exchange, Inc.", fetch=lambda: src.fred_series("VIXCLS")),
    # Asia
    Tile("KOSPI", "KOSPI", "asia", "level", 500, 20000, "Bank of Korea ECOS", src.ECOS_PAGE,
         fetch=lambda: src.ecos_daily("802Y001", "0001000")),
    Tile("N225", "Nikkei 225", "asia", "level", 5000, 200000, YAHOO_SOURCE, src.yahoo_page("^N225"), tier=2,
         fetch=lambda: src.yahoo_series("^N225")),
    Tile("HSI", "Hang Seng", "asia", "level", 5000, 100000, YAHOO_SOURCE, src.yahoo_page("^HSI"), tier=2,
         fetch=lambda: src.yahoo_series("^HSI")),
    # FX
    Tile("EURUSD", "EUR/USD", "fx", "fx", 0.5, 2.0, "ECB", src.ECB_PAGE, note=ECB_NOTE, decimals=4),
    Tile("USDJPY", "USD/JPY", "fx", "fx", 50, 400, "ECB", src.ECB_PAGE, note=ECB_NOTE),
    Tile("USDKRW", "USD/KRW", "fx", "fx", 800, 2500, "Bank of Korea ECOS", src.ECOS_PAGE,
         note="BoK base rate, Seoul", fetch=lambda: src.ecos_daily("731Y001", "0000001")),
    Tile("DXY", "DXY", "fx", "fx", 50, 200, YAHOO_SOURCE, src.yahoo_page("DX-Y.NYB"), tier=2,
         note="ICE U.S. Dollar Index", fetch=lambda: src.yahoo_series("DX-Y.NYB")),
    # Commodities
    Tile("GOLD", "Gold", "commodities", "level", 200, 20000, YAHOO_SOURCE, src.yahoo_page("GC=F"), tier=2,
         note="COMEX front-month futures, not spot", fetch=lambda: src.yahoo_series("GC=F")),
    Tile("WTI", "WTI crude", "commodities", "level", 5, 400, "EIA via FRED", src.fred_page("DCOILWTICO"),
         note="Cushing spot, $/bbl", lag_bd=5, fetch=lambda: src.fred_series("DCOILWTICO")),
    Tile("BRENT", "Brent crude", "commodities", "level", 5, 400, "EIA via FRED", src.fred_page("DCOILBRENTEU"),
         note="Europe spot, $/bbl", lag_bd=5,
         fetch=lambda: src.fred_series("DCOILBRENTEU")),
]


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        warn(f"{path.name} is unreadable ({e}); starting from empty")
        return {}


def business_days_between(a: date, b: date) -> int:
    """Weekdays strictly after a, up to and including b."""
    n = 0
    d = a
    while d < b:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n += 1
    return n


def merge_series(old: list, new: src.Series) -> src.Series:
    merged = {d: v for d, v in old}
    merged.update(dict(new))
    return sorted(merged.items())[-HISTORY_LEN:]


def in_bounds(t: Tile, v: float) -> bool:
    return t.lo <= v <= t.hi


# ------------------------------------------------------------------
# Treasury curve
# ------------------------------------------------------------------
def refresh_curve(history: dict) -> dict[str, list]:
    """Returns {date: [yields...]} for the whole curve history, updated."""
    stored = history.get("curve", {})
    rows: dict[str, list] = {}
    if stored.get("tenors") == src.TENOR_KEYS:
        rows = {r[0]: r[1:] for r in stored.get("rows", [])}

    today = date.today()
    first_year = min((int(d[:4]) for d in rows), default=None)
    if first_year is None or first_year > CURVE_START_YEAR:
        print(f"Backfilling Treasury curve {CURVE_START_YEAR}-{today.year} from yearly CSVs", flush=True)
        # Treasury takes ~15-20s per request, so fetch years in parallel.
        years = range(CURVE_START_YEAR, today.year + 1)
        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = {pool.submit(src.treasury_year_csv, y): y for y in years}
            for fut in as_completed(futures):
                try:
                    rows.update(fut.result())
                except Exception as e:
                    warn(f"Treasury {futures[fut]} CSV: {e}")

    # The daily XML feed for this month and last (covers month boundaries
    # and any revisions Treasury posts to recent days).
    this_month = today.replace(day=1)
    last_month = (this_month - timedelta(days=1)).replace(day=1)
    for m in (last_month, this_month):
        try:
            fetched = src.treasury_month(m.strftime("%Y%m"))
        except Exception as e:
            warn(f"Treasury {m:%Y-%m} XML: {e}")
            continue
        for d, ys in fetched.items():
            ten = ys[src.TENOR_KEYS.index("10Y")]
            if ten is None or not (0 <= ten <= 15):
                warn(f"Treasury {d}: 10Y {ten} failed sanity check; row skipped")
                continue
            rows[d] = ys
    return rows


def curve_tiles(curve_rows: dict[str, list]) -> dict[str, src.Series]:
    idx = {k: i for i, k in enumerate(src.TENOR_KEYS)}
    out: dict[str, src.Series] = {k: [] for k in ("UST3M", "UST2Y", "UST3Y", "UST5Y", "UST10Y", "UST30Y",
                                                   "S2S10", "S3M10Y")}
    for d in sorted(curve_rows)[-HISTORY_LEN:]:
        y = curve_rows[d]
        for tenor in ("3M", "2Y", "3Y", "5Y", "10Y", "30Y"):
            v = y[idx[tenor]]
            if v is not None:
                out[f"UST{tenor}"].append((d, v))
        if y[idx["10Y"]] is not None and y[idx["2Y"]] is not None:
            out["S2S10"].append((d, round((y[idx["10Y"]] - y[idx["2Y"]]) * 100, 1)))
        if y[idx["10Y"]] is not None and y[idx["3M"]] is not None:
            out["S3M10Y"].append((d, round((y[idx["10Y"]] - y[idx["3M"]]) * 100, 1)))
    return out


def curve_snapshot(curve_rows: dict[str, list]) -> dict | None:
    dates = sorted(curve_rows)
    if not dates:
        return None
    latest = dates[-1]
    ld = date.fromisoformat(latest)

    def on_or_before(target: date) -> str | None:
        cands = [d for d in dates if d <= target.isoformat()]
        return cands[-1] if cands else None

    # Same calendar day last month, clamped to that month's length.
    prev_month_end = ld.replace(day=1) - timedelta(days=1)
    month_target = prev_month_end.replace(day=min(ld.day, prev_month_end.day))
    snap = {"as_of": latest, "tenors": src.TENOR_KEYS, "latest": curve_rows[latest]}
    for name, target in (("week_ago", ld - timedelta(days=7)), ("month_ago", month_target)):
        d = on_or_before(target)
        snap[name] = {"date": d, "y": curve_rows[d]} if d else None
    return snap


# ------------------------------------------------------------------
# Tiles
# ------------------------------------------------------------------
def build_tile(t: Tile, prev_tile: dict | None, hist_series: list, fetched: src.Series | None,
               fetch_error: str | None, today: date) -> dict | None:
    series = list(map(tuple, hist_series))
    error = fetch_error
    if fetched is not None:
        # Yahoo returns float32 noise (2806.97998...); keep a sane precision.
        fetched = [(d, round(v, t.decimals + 2)) for d, v in fetched]
        good = [(d, v) for d, v in fetched if in_bounds(t, v)]
        dropped = len(fetched) - len(good)
        if fetched and fetched[-1] not in good:
            error = f"latest value {fetched[-1][1]} on {fetched[-1][0]} outside sanity bounds [{t.lo}, {t.hi}]"
        elif dropped:
            warn(f"{t.key}: dropped {dropped} out-of-bounds historical point(s)")
        series = merge_series(series, good)
    if error:
        warn(f"{t.key}: {error}; keeping last good value")

    if not series:
        if prev_tile:
            return {**prev_tile, "status": "stale", "error": error or prev_tile.get("error")}
        return None  # never render an empty tile

    as_of, value = series[-1]
    prev_value = series[-2][1] if len(series) > 1 else None
    if prev_value is None:
        chg = chg_pct = None
    elif t.unit in ("pct", "bp"):
        chg = round(value - prev_value, 4)
        chg_pct = None
    else:
        chg = round(value - prev_value, 6)
        chg_pct = round((value / prev_value - 1) * 100, 4) if prev_value else None

    lag = business_days_between(date.fromisoformat(as_of), today)
    # Two extra business days of slack absorb exchange holidays without
    # crying wolf; a fetch error marks the tile stale regardless.
    stale = bool(error) or lag > t.lag_bd + 2

    return {
        "key": t.key,
        "label": t.label,
        "group": t.group,
        "unit": t.unit,
        "decimals": t.decimals,
        "value": value,
        "prev": prev_value,
        "chg": chg,
        "chg_pct": chg_pct,
        "chg_bp": round(chg * 100, 1) if t.unit == "pct" and chg is not None else (chg if t.unit == "bp" else None),
        "as_of": as_of,
        "spark": [[d, v] for d, v in series[-SPARK_LEN:]],
        "source": t.source,
        "source_url": t.source_url,
        "tier": t.tier,
        "note": t.note,
        "status": "stale" if stale else "ok",
        "last_good": as_of,
        "error": error,
    }, series


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def main() -> int:
    prev = load_json(DATA_PATH)
    history = load_json(HISTORY_PATH)
    today = datetime.now(timezone.utc).date()
    prev_tiles = prev.get("tiles", {})
    hist_series = history.get("series", {})

    # Curve first: the rate tiles are derived from it.
    curve_rows = refresh_curve(history)
    derived = curve_tiles(curve_rows)

    # ECB is one request for three crosses; USD/KRW prefers ECOS and falls
    # back to the ECB cross if ECOS fails.
    ecb: dict[str, src.Series] = {}
    try:
        ecb = src.ecb_rates()
    except Exception as e:
        warn(f"ECB: {e}")

    tiles_out: dict[str, dict] = {}
    series_out: dict[str, list] = {}
    for t in TILES:
        fetched: src.Series | None = None
        err: str | None = None
        if t.key in derived:
            fetched = derived[t.key] or None
            if fetched is None:
                err = "no Treasury data"
        elif t.key in ("EURUSD", "USDJPY"):
            fetched = ecb.get(t.key)
            err = None if fetched else "ECB fetch failed"
        else:
            try:
                fetched = t.fetch() if t.fetch else None
                if not fetched:
                    err, fetched = "source returned no observations", None
            except Exception as e:
                err = str(e)
            if err and t.key == "USDKRW" and ecb.get("USDKRW"):
                warn(f"USDKRW: ECOS failed ({err}); using ECB cross as fallback")
                t.source, t.source_url, t.note = "ECB (fallback)", src.ECB_PAGE, ECB_NOTE
                fetched, err = ecb["USDKRW"], None
                hist_series = {**hist_series, "USDKRW": []}  # don't splice two different fixes together

        built = build_tile(t, prev_tiles.get(t.key), hist_series.get(t.key, []), fetched, err, today)
        if built is None:
            warn(f"{t.key}: no good value has ever been fetched; tile hidden")
            continue
        tile, series = built if isinstance(built, tuple) else (built, hist_series.get(t.key, []))
        tiles_out[t.key] = tile
        series_out[t.key] = [list(p) for p in series]

    # Headlines: newest first across feeds, deduped by URL. If every feed
    # fails, keep what was there.
    headlines: list[dict] = []
    for source, url in src.FEEDS:
        try:
            headlines.extend(src.feed_items(source, url))
        except Exception as e:
            warn(f"Headlines {source} ({url}): {e}")
    seen: set[str] = set()
    deduped = []
    for h in sorted(headlines, key=lambda h: h["date"], reverse=True):
        if h["url"] not in seen:
            seen.add(h["url"])
            deduped.append(h)
    headlines = deduped[:HEADLINE_COUNT] or prev.get("headlines", [])

    events, cal_errors = src.calendar_events()
    for e in cal_errors:
        warn(e)
    upcoming = sorted(
        {(e["date"], e["event"]): e for e in events if e["date"] >= today.isoformat()}.values(),
        key=lambda e: (e["date"], e["time_et"] or ""),
    )[:CALENDAR_COUNT]
    if not upcoming:
        upcoming = [e for e in prev.get("calendar", []) if e["date"] >= today.isoformat()]

    data = {
        "schema": 1,
        "refreshed_utc": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "tiles": tiles_out,
        "curve": curve_snapshot(curve_rows),
        "headlines": headlines,
        "calendar": upcoming,
    }
    new_history = {
        "schema": 1,
        "series": series_out,
        "curve": {"tenors": src.TENOR_KEYS, "rows": [[d, *curve_rows[d]] for d in sorted(curve_rows)]},
    }

    # refreshed_utc changes every run; only rewrite when something else did,
    # so the backup cron slot doesn't commit and redeploy identical data.
    strip = lambda d: {k: v for k, v in d.items() if k != "refreshed_utc"}  # noqa: E731
    data_changed = strip(json.loads(json.dumps(data))) != strip(prev)
    history_changed = json.loads(json.dumps(new_history)) != history
    if data_changed or history_changed:
        DATA_PATH.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        HISTORY_PATH.write_text(json.dumps(new_history, separators=(",", ":")) + "\n")
        print(f"Wrote {DATA_PATH.name} and {HISTORY_PATH.name}")
    else:
        print("No new market data; files unchanged")

    print(f"{len(tiles_out)} tiles, {sum(t['status'] == 'stale' for t in tiles_out.values())} stale, "
          f"{len(headlines)} headlines, {len(upcoming)} calendar events, {len(ERRORS)} warnings")
    return 0


if __name__ == "__main__":
    sys.exit(main())
