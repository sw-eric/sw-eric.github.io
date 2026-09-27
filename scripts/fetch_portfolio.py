#!/usr/bin/env python3
"""
Refreshes quartz/static/portfolio-data.json from an IBKR Flex Query.

Flex Web Service is a batch/reporting API (updates lag live trading by
minutes to a day), not a streaming feed — see the Sonsu Research homepage
dashboard, which is built for that cadence rather than tick-by-tick data.

Setup (one-time, in IBKR Account Management):
  Reports -> Flex Queries -> Create a query with sections:
    - Open Positions
    - Trades
    - Net Asset Value (NAV) in Base
  Then set these as repo secrets (Settings -> Secrets and variables -> Actions):
    the Flex access token (named SONSUDASHBOARD2 in this repo's secrets —
      the workflow maps it to IBKR_FLEX_TOKEN internally; use any name
      you like, just keep the workflow's `env:` mapping in sync)
    IBKR_FLEX_QUERY_ID

Run manually with:
    IBKR_FLEX_TOKEN=... IBKR_FLEX_QUERY_ID=... python3 scripts/fetch_portfolio.py
"""

from __future__ import annotations

import os
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import json
import requests

FLEX_SEND_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest"
FLEX_GET_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "quartz" / "static" / "portfolio-data.json"


def fetch_statement(token: str, query_id: str, max_attempts: int = 6) -> ET.Element:
    r = requests.get(FLEX_SEND_URL, params={"t": token, "q": query_id, "v": 3}, timeout=30)
    r.raise_for_status()
    root = ET.fromstring(r.text)
    status = root.findtext("Status")
    if status != "Success":
        raise RuntimeError(f"Flex SendRequest failed: {ET.tostring(root, encoding='unicode')}")
    ref_code = root.findtext("ReferenceCode")

    for attempt in range(max_attempts):
        time.sleep(5 if attempt == 0 else 10)
        r2 = requests.get(FLEX_GET_URL, params={"t": token, "q": ref_code, "v": 3}, timeout=30)
        r2.raise_for_status()
        statement = ET.fromstring(r2.text)
        if statement.tag != "FlexErrorResponse":
            return statement
        code = statement.findtext("ErrorCode")
        if code != "1019":  # 1019 == statement not generated yet
            raise RuntimeError(f"Flex GetStatement error {code}: {statement.findtext('ErrorMessage')}")
    raise TimeoutError("Flex statement did not become ready in time")


def earliest_trade_dates(xml_root: ET.Element) -> dict[str, str]:
    """Symbol -> earliest execution date, used as a position's open date
    (Open Position records don't carry one themselves)."""
    earliest: dict[str, str] = {}
    for t in xml_root.iter("Trade"):
        a = t.attrib
        symbol = a.get("symbol")
        dt = a.get("tradeDate") or (a.get("dateTime", "")[:8])
        if not symbol or not dt:
            continue
        date_str = f"{dt[0:4]}-{dt[4:6]}-{dt[6:8]}"
        if symbol not in earliest or date_str < earliest[symbol]:
            earliest[symbol] = date_str
    return earliest


def parse_positions(xml_root: ET.Element) -> list[dict]:
    opened_by_symbol = earliest_trade_dates(xml_root)
    positions = []
    for p in xml_root.iter("OpenPosition"):
        a = p.attrib
        symbol = a.get("symbol")
        qty = float(a.get("position", 0))
        avg_cost = float(a.get("costBasisPrice", 0))
        price = float(a.get("markPrice", 0))
        market_value = float(a.get("positionValue", 0))
        cost_basis = avg_cost * qty
        unrealized = market_value - cost_basis
        positions.append(
            dict(
                symbol=symbol,
                name=a.get("description"),
                opened=opened_by_symbol.get(symbol),
                qty=qty,
                avg_cost=round(avg_cost, 2),
                price=round(price, 2),
                market_value=round(market_value, 2),
                unrealized_pnl=round(unrealized, 2),
                unrealized_pct=round((unrealized / cost_basis * 100) if cost_basis else 0, 2),
            )
        )
    return positions


def parse_equity_curve(xml_root: ET.Element) -> list[dict]:
    curve = []
    for node in xml_root.iter("EquitySummaryByReportDateInBase"):
        d = node.attrib.get("reportDate", "")
        nav = float(node.attrib.get("total", 0))
        if len(d) == 8:
            d = f"{d[0:4]}-{d[4:6]}-{d[6:8]}"
        curve.append(dict(date=d, nav=round(nav, 2)))
    curve.sort(key=lambda x: x["date"])
    return curve


def parse_realized_pnl(xml_root: ET.Element) -> float:
    total = 0.0
    for t in xml_root.iter("Trade"):
        a = t.attrib
        if a.get("openCloseIndicator") == "C":
            total += float(a.get("fifoPnlRealized", 0)) + float(a.get("ibCommission", 0))
    return round(total, 2)


def build_insights(account: dict, positions: list[dict], last_trade_date: str | None) -> list[str]:
    insights = []

    direction = "Up" if account["total_return_pct"] >= 0 else "Down"
    insights.append(
        f"{direction} {abs(account['total_return_pct']):.2f}% since inception "
        f"(${account['starting_capital']:,.0f} → ${account['net_liquidation']:,.2f} net liquidation) "
        f"across {len(positions)} open position{'s' if len(positions) != 1 else ''} "
        f"— realized P&L is ${account['realized_pnl']:,.2f}, so "
        f"{'the gain is unrealized, not locked in' if account['realized_pnl'] == 0 else 'part of the return is already locked in'}."
    )

    if len(positions) >= 2:
        best = max(positions, key=lambda p: p["unrealized_pct"])
        largest = max(positions, key=lambda p: p["market_value"])
        if best["symbol"] != largest["symbol"]:
            insights.append(
                f"{best['name']} ({best['symbol']}) is doing the work: "
                f"{best['unrealized_pct']:+.1f}% unrealized on a ${best['market_value']:,.0f} position, "
                f"while {largest['symbol']} — the largest position at {largest['weight_pct']:.0f}% of NAV — "
                f"is at {largest['unrealized_pct']:+.1f}%. Position size isn't tracking conviction yet."
            )

    if account["cash_pct"] >= 15:
        insights.append(
            f"{account['cash_pct']:.1f}% of the book (${account['cash']:,.2f}) is sitting in cash. "
            f"For a thesis built on concentrated long equity, that's a meaningful drag if it stays idle much longer."
        )

    if last_trade_date:
        days_since = (datetime.now(timezone.utc).date() - datetime.fromisoformat(last_trade_date).date()).days
        if days_since >= 14:
            insights.append(
                f"No trades since {datetime.fromisoformat(last_trade_date).strftime('%b %-d')} "
                f"— {days_since}+ days of pure holding with no adds, trims, or exits across any position."
            )

    return insights


def main() -> None:
    token = os.environ.get("IBKR_FLEX_TOKEN")
    query_id = os.environ.get("IBKR_FLEX_QUERY_ID")
    if not token or not query_id:
        print("IBKR_FLEX_TOKEN / IBKR_FLEX_QUERY_ID not set", file=sys.stderr)
        sys.exit(1)

    xml_root = fetch_statement(token, query_id)

    positions = parse_positions(xml_root)
    equity_curve = parse_equity_curve(xml_root)
    realized_pnl = parse_realized_pnl(xml_root)

    net_liq = equity_curve[-1]["nav"] if equity_curve else sum(p["market_value"] for p in positions)
    starting_capital = equity_curve[0]["nav"] if equity_curve else net_liq
    invested = sum(p["market_value"] for p in positions)
    cash = round(net_liq - invested, 2)
    unrealized_pnl = round(sum(p["unrealized_pnl"] for p in positions), 2)

    today = datetime.now(timezone.utc).date()
    for p in positions:
        p["weight_pct"] = round(p["market_value"] / net_liq * 100, 2) if net_liq else 0
        p["days_held"] = (today - datetime.fromisoformat(p["opened"]).date()).days if p["opened"] else None
        p["daily_pnl"] = None  # not available from a daily Flex snapshot

    account = dict(
        starting_capital=starting_capital,
        net_liquidation=net_liq,
        total_return_pct=round((net_liq - starting_capital) / starting_capital * 100, 2) if starting_capital else 0,
        cash=cash,
        invested=round(invested, 2),
        cash_pct=round(cash / net_liq * 100, 2) if net_liq else 0,
        invested_pct=round(invested / net_liq * 100, 2) if net_liq else 0,
        unrealized_pnl=unrealized_pnl,
        realized_pnl=realized_pnl,
    )

    last_trade_date = max((p["opened"] for p in positions if p["opened"]), default=None)

    data = dict(
        as_of=datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        inception_date=equity_curve[0]["date"] if equity_curve else None,
        base_currency="USD",
        account=account,
        equity_curve=equity_curve,
        positions=positions,
        insights=build_insights(account, positions, last_trade_date),
    )

    OUTPUT_PATH.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
