"""
Fetchers for the Market Desk (see fetch_markets.py).

Each fetcher returns a list of (iso_date, value) pairs, oldest first, or
raises. None of them decide what to keep — fetch_markets.py validates and
merges against the last good snapshot, so a failing source here can never
wipe a value that is already on the site.
"""

from __future__ import annotations

import csv
import io
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo

import requests

# BLS returns an "Access Denied" HTML page (with a 200) to generic browser
# user agents; a descriptive one with a contact URL is what it asks for.
UA = "SonsuResearch-MarketDesk/1.0 (+https://www.sonsuresearch.com)"
TIMEOUT = 30
ET_TZ = ZoneInfo("America/New_York")

Series = list[tuple[str, float]]


def http_get(url: str, *, params: dict | None = None, attempts: int = 3) -> requests.Response:
    last: Exception | None = None
    for i in range(attempts):
        try:
            r = requests.get(url, params=params, headers={"User-Agent": UA}, timeout=TIMEOUT)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"GET {url} failed after {attempts} attempts: {last}")


# ------------------------------------------------------------------
# U.S. Treasury daily par yield curve
# ------------------------------------------------------------------
TSY_XML = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
TSY_CSV = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "daily-treasury-rates.csv/{year}/all"
)
TSY_PAGE = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "TextView?type=daily_treasury_yield_curve"
)

# Tenor key -> (XML field, CSV column). 1.5M only exists from 2025.
TENORS: list[tuple[str, str, str]] = [
    ("1M", "BC_1MONTH", "1 Mo"),
    ("2M", "BC_2MONTH", "2 Mo"),
    ("3M", "BC_3MONTH", "3 Mo"),
    ("4M", "BC_4MONTH", "4 Mo"),
    ("6M", "BC_6MONTH", "6 Mo"),
    ("1Y", "BC_1YEAR", "1 Yr"),
    ("2Y", "BC_2YEAR", "2 Yr"),
    ("3Y", "BC_3YEAR", "3 Yr"),
    ("5Y", "BC_5YEAR", "5 Yr"),
    ("7Y", "BC_7YEAR", "7 Yr"),
    ("10Y", "BC_10YEAR", "10 Yr"),
    ("20Y", "BC_20YEAR", "20 Yr"),
    ("30Y", "BC_30YEAR", "30 Yr"),
]
TENOR_KEYS = [t[0] for t in TENORS]

Curve = dict[str, list[float | None]]  # iso date -> yields aligned to TENOR_KEYS


def _num(s: str | None) -> float | None:
    if s is None:
        return None
    s = s.strip()
    if s in ("", "N/A", "."):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def treasury_month(yyyymm: str) -> Curve:
    r = http_get(TSY_XML, params={"data": "daily_treasury_yield_curve", "field_tdr_date_value_month": yyyymm})
    out: Curve = {}
    for props in re.findall(r"<m:properties>(.*?)</m:properties>", r.text, re.S):
        fields = dict(re.findall(r"<d:(\w+)[^>]*>([^<]*)</d:\w+>", props))
        d = fields.get("NEW_DATE", "")[:10]
        if d:
            out[d] = [_num(fields.get(xml)) for _, xml, _ in TENORS]
    return out


def treasury_year_csv(year: int) -> Curve:
    r = http_get(
        TSY_CSV.format(year=year),
        params={"type": "daily_treasury_yield_curve", "field_tdr_date_value": str(year), "page": "", "_format": "csv"},
    )
    out: Curve = {}
    for row in csv.DictReader(io.StringIO(r.text)):
        m, d, y = row["Date"].split("/")
        out[f"{y}-{m}-{d}"] = [_num(row.get(col)) for _, _, col in TENORS]
    return out


# ------------------------------------------------------------------
# ECB euro foreign exchange reference rates
# ------------------------------------------------------------------
ECB_90D = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml"
ECB_PAGE = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"


def ecb_rates() -> dict[str, Series]:
    """EUR/USD plus USD crosses (EUR/xxx / EUR/USD)."""
    root = ET.fromstring(http_get(ECB_90D).content)
    eurusd: Series = []
    usdjpy: Series = []
    usdkrw: Series = []
    for day in root.iter():
        d = day.get("time")
        if not d:
            continue
        rates = {c.get("currency"): float(c.get("rate")) for c in day if c.get("currency")}
        usd = rates.get("USD")
        if not usd:
            continue
        eurusd.append((d, usd))
        if "JPY" in rates:
            usdjpy.append((d, rates["JPY"] / usd))
        if "KRW" in rates:
            usdkrw.append((d, rates["KRW"] / usd))
    return {k: sorted(v) for k, v in {"EURUSD": eurusd, "USDJPY": usdjpy, "USDKRW": usdkrw}.items()}


# ------------------------------------------------------------------
# Bank of Korea ECOS
# ------------------------------------------------------------------
ECOS_URL = "https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/{rows}/{stat}/D/{start}/{end}/{item}"
ECOS_PAGE = "https://ecos.bok.or.kr/"


def ecos_daily(stat: str, item: str, days: int = 120) -> Series:
    # The public "sample" key caps every response at 10 rows, so query in
    # ~10-session date windows; with a real key the same loop just makes a
    # handful of extra small calls.
    key = os.environ.get("ECOS_API_KEY") or "sample"
    end = date.today()
    out: dict[str, float] = {}
    cursor = end - timedelta(days=days)
    while cursor <= end:
        win_end = min(cursor + timedelta(days=12), end)
        url = ECOS_URL.format(
            key=key, rows=10 if key == "sample" else 100, stat=stat, item=item, start=cursor.strftime("%Y%m%d"), end=win_end.strftime("%Y%m%d")
        )
        data = http_get(url).json()
        block = data.get("StatisticSearch")
        if block is None:
            result = data.get("RESULT", {})
            # INFO-200 is "no data for this window" (holidays), not an error.
            if result.get("CODE") != "INFO-200":
                raise RuntimeError(f"ECOS {stat}/{item}: {result}")
        else:
            for row in block.get("row", []):
                v = _num(row.get("DATA_VALUE"))
                t = row.get("TIME", "")
                if v is not None and len(t) == 8:
                    out[f"{t[:4]}-{t[4:6]}-{t[6:]}"] = v
        cursor = win_end + timedelta(days=1)
    return sorted(out.items())


# ------------------------------------------------------------------
# FRED (St. Louis Fed)
# ------------------------------------------------------------------
FRED_API = "https://api.stlouisfed.org/fred/series/observations"
FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv"


def fred_series(series_id: str, days: int = 150) -> Series:
    start = (date.today() - timedelta(days=days)).isoformat()
    key = os.environ.get("FRED_API_KEY")
    out: Series = []
    if key:
        params = {"series_id": series_id, "api_key": key, "file_type": "json", "observation_start": start}
        for obs in http_get(FRED_API, params=params).json().get("observations", []):
            v = _num(obs.get("value"))
            if v is not None:
                out.append((obs["date"], v))
    else:
        # Keyless fallback, used for local runs before the secret exists.
        text = http_get(FRED_CSV, params={"id": series_id, "cosd": start}).text
        rows = list(csv.reader(io.StringIO(text)))
        for row in rows[1:]:
            v = _num(row[1]) if len(row) > 1 else None
            if v is not None:
                out.append((row[0], v))
    return out


def fred_page(series_id: str) -> str:
    return f"https://fred.stlouisfed.org/series/{series_id}"


# ------------------------------------------------------------------
# Yahoo Finance via yfinance (Tier 2, unofficial)
# ------------------------------------------------------------------
def yahoo_series(symbol: str, period: str = "6mo") -> Series:
    import yfinance as yf  # imported lazily so the other sources work without it

    last: Exception | None = None
    for i in range(3):
        try:
            hist = yf.Ticker(symbol).history(period=period, interval="1d", auto_adjust=False)
            out: Series = []
            for ts, close in hist["Close"].items():
                # A session still in progress (or a feed hiccup) comes back
                # as NaN; drop it rather than letting it reach a tile.
                if close == close:
                    out.append((ts.date().isoformat(), float(close)))
            if out:
                return out
            last = RuntimeError("empty history")
        except Exception as e:  # yfinance raises a wide range of types
            last = e
        time.sleep(3 * (i + 1))
    raise RuntimeError(f"yfinance {symbol}: {last}")


def yahoo_page(symbol: str) -> str:
    return f"https://finance.yahoo.com/quote/{requests.utils.quote(symbol)}"


# ------------------------------------------------------------------
# Headlines (official RSS / Atom feeds)
# ------------------------------------------------------------------
FEEDS: list[tuple[str, str]] = [
    ("Federal Reserve", "https://www.federalreserve.gov/feeds/press_monetary.xml"),
    ("Federal Reserve", "https://www.federalreserve.gov/feeds/speeches_and_testimony.xml"),
    # BLS's "latest" feed has one generic item; the per-release feeds carry
    # the actual release headlines.
    ("BLS", "https://www.bls.gov/feed/empsit.rss"),
    ("BLS", "https://www.bls.gov/feed/cpi.rss"),
    ("BEA", "https://apps.bea.gov/rss/rss.xml"),
    ("ECB", "https://www.ecb.europa.eu/rss/press.html"),
    ("Bank of Korea", "https://www.bok.or.kr/eng/bbs/E0000634/news.rss?menuNo=400423"),
]


def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1]


def _parse_date(s: str | None) -> str | None:
    if not s:
        return None
    s = s.strip()
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc).date().isoformat()
    except (TypeError, ValueError):
        pass
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        m = re.match(r"(\d{4}-\d{2}-\d{2})", s) or re.match(r"(\d{4}\.\d{2}\.\d{2})", s)
        return m.group(1).replace(".", "-") if m else None


def feed_items(source: str, url: str, limit: int = 8) -> list[dict]:
    root = ET.fromstring(http_get(url).content)
    items = []
    for node in root.iter():
        tag = _strip_ns(node.tag)
        if tag not in ("item", "entry"):
            continue
        fields: dict[str, str] = {}
        for child in node:
            ct = _strip_ns(child.tag)
            if ct == "link" and child.get("href"):
                fields.setdefault("link", child.get("href", ""))
            elif child.text:
                fields.setdefault(ct, child.text.strip())
        title = re.sub(r"\s+", " ", fields.get("title", "")).strip()
        link = fields.get("link", "").strip()
        d = _parse_date(fields.get("pubDate") or fields.get("date") or fields.get("updated") or fields.get("published"))
        if title and link.startswith("http") and d:
            items.append({"title": title, "source": source, "date": d, "url": link})
        if len(items) >= limit:
            break
    return items


# ------------------------------------------------------------------
# Release calendar (BLS + BEA iCalendar, Fed FOMC page)
# ------------------------------------------------------------------
BLS_ICS = "https://www.bls.gov/schedule/news_release/bls.ics"
BEA_ICS = "https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics"
FOMC_PAGE = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"

BLS_KEEP = {
    "Consumer Price Index": "CPI",
    "Employment Situation": "Employment Situation (payrolls)",
    "Producer Price Index": "PPI",
}
BEA_KEEP = [
    (re.compile(r"^GDP\b"), None),
    (re.compile(r"^Personal Income and Outlays"), "Personal Income and Outlays (PCE)"),
]


def _ics_events(text: str) -> list[tuple[str, str, str]]:
    if "BEGIN:VCALENDAR" not in text:
        raise RuntimeError("not an iCalendar response (blocked or changed)")
    text = re.sub(r"\r?\n[ \t]", "", text)  # unfold continuation lines
    out = []
    for ev in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", text, re.S):
        start = re.search(r"^DTSTART[^:\n]*:(\S+)", ev, re.M)
        summary = re.search(r"^SUMMARY[^:\n]*:(.*)$", ev, re.M)
        if not start or not summary:
            continue
        raw = start.group(1)
        if raw.endswith("Z"):
            # BEA publishes in UTC; BLS uses a US-Eastern TZID. Show ET.
            dt = datetime.strptime(raw, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).astimezone(ET_TZ)
            d, t = dt.date().isoformat(), dt.strftime("%H:%M")
        else:
            d = f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
            t = f"{raw[9:11]}:{raw[11:13]}" if "T" in raw and len(raw) >= 13 else ""
        out.append((d, t, summary.group(1).strip().replace("\\,", ",")))
    return out


def calendar_events() -> tuple[list[dict], list[str]]:
    """Upcoming releases from each official calendar. Returns (events, errors)."""
    events: list[dict] = []
    errors: list[str] = []

    try:
        for d, t, s in _ics_events(http_get(BLS_ICS).text):
            if s in BLS_KEEP:
                events.append({"date": d, "time_et": t or None, "event": BLS_KEEP[s], "source": "BLS",
                               "url": "https://www.bls.gov/schedule/news_release/"})
    except Exception as e:
        errors.append(f"BLS calendar: {e}")

    try:
        for d, t, s in _ics_events(http_get(BEA_ICS).text):
            for rx, label in BEA_KEEP:
                if rx.search(s):
                    events.append({"date": d, "time_et": t or None, "event": label or s, "source": "BEA",
                                   "url": "https://www.bea.gov/news/schedule"})
    except Exception as e:
        errors.append(f"BEA calendar: {e}")

    try:
        html = http_get(FOMC_PAGE).text
        months = {m: i for i, m in enumerate(
            ["January", "February", "March", "April", "May", "June", "July", "August",
             "September", "October", "November", "December"], 1)}
        for year_block in re.finditer(r"(\d{4}) FOMC Meetings(.*?)(?=\d{4} FOMC Meetings|$)", html, re.S):
            year = int(year_block.group(1))
            for mon, days in re.findall(
                r"fomc-meeting__month[^>]*><strong>([\w/]+)</strong>.*?fomc-meeting__date[^>]*>([^<]+)<",
                year_block.group(2), re.S,
            ):
                mon = mon.split("/")[-1]
                last_day = re.findall(r"\d+", days)
                if mon not in months or not last_day:
                    continue
                # The decision is announced on the meeting's final day.
                events.append({"date": f"{year}-{months[mon]:02d}-{int(last_day[-1]):02d}", "time_et": "14:00",
                               "event": "FOMC rate decision", "source": "Federal Reserve", "url": FOMC_PAGE})
    except Exception as e:
        errors.append(f"FOMC calendar: {e}")

    return events, errors
