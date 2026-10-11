// ============================================================
// MARKET DESK (/desk)
// Renders /static/market-data.json (refreshed by a scheduled GitHub
// Action, see scripts/fetch_markets.py) into dense prior-close tiles,
// a Treasury curve chart, a release calendar and official headlines.
// Nothing here is live; every tile shows its own as-of date.
// ============================================================
import {
  fmtNum,
  fmtShortDate,
  htmlEl,
  linePath,
  linear,
  niceDomain,
  onResize,
  placeTooltip,
  signed,
  svgEl,
} from "./chartKit"

interface DeskTile {
  key: string
  label: string
  group: string
  unit: "pct" | "bp" | "level" | "fx"
  decimals: number
  value: number
  prev: number | null
  chg: number | null
  chg_pct: number | null
  chg_bp: number | null
  as_of: string
  spark: [string, number][]
  source: string
  source_url: string
  tier: number
  note: string | null
  status: "ok" | "stale"
  last_good: string
}

interface DeskData {
  refreshed_utc: string
  tiles: Record<string, DeskTile>
  curve: {
    as_of: string
    tenors: string[]
    latest: (number | null)[]
    week_ago: { date: string; y: (number | null)[] } | null
    month_ago: { date: string; y: (number | null)[] } | null
  } | null
  headlines: { title: string; source: string; date: string; url: string }[]
  calendar: { date: string; time_et: string | null; event: string; source: string; url: string }[]
}

// Panel order and contents.
const PANELS: { id: string; title: string; keys: string[] }[] = [
  {
    id: "rates",
    title: "Rates",
    keys: ["UST3M", "UST2Y", "UST3Y", "UST5Y", "UST10Y", "UST30Y", "S2S10", "S3M10Y"],
  },
  { id: "us_index", title: "US equities", keys: ["SPX", "CCMP", "INDU", "RTY", "VIX"] },
  { id: "asia", title: "Asia", keys: ["KOSPI", "N225", "HSI"] },
  { id: "fx", title: "FX", keys: ["EURUSD", "USDJPY", "USDKRW", "DXY"] },
  { id: "commodities", title: "Commodities", keys: ["GOLD", "WTI", "BRENT"] },
]

const TENOR_YEARS: Record<string, number> = {
  "1M": 1 / 12,
  "2M": 2 / 12,
  "3M": 3 / 12,
  "4M": 4 / 12,
  "6M": 0.5,
  "1Y": 1,
  "2Y": 2,
  "3Y": 3,
  "5Y": 5,
  "7Y": 7,
  "10Y": 10,
  "20Y": 20,
  "30Y": 30,
}

function fmtValue(t: DeskTile): string {
  if (t.unit === "pct") return `${fmtNum(t.value, 2)}%`
  if (t.unit === "bp") return `${fmtNum(t.value, 0)} bp`
  return fmtNum(t.value, t.decimals)
}

function fmtChange(t: DeskTile): string {
  if (t.chg === null) return "n/a"
  if (t.unit === "pct") return `${signed(t.chg_bp ?? 0, 1)} bp`
  if (t.unit === "bp") return `${signed(t.chg, 0)} bp`
  const pct = t.chg_pct === null ? "" : ` (${signed(t.chg_pct, 2)}%)`
  return `${signed(t.chg, t.decimals)}${pct}`
}

function sparkline(points: [string, number][]): SVGSVGElement {
  const svg = svgEl("svg", {
    class: "md-spark",
    viewBox: "0 0 100 24",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
  })
  if (points.length < 2) return svg
  const vals = points.map((p) => p[1])
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const x = linear(0, points.length - 1, 1, 99)
  const y = linear(lo, hi === lo ? lo + 1 : hi, 22, 2)
  const pts: [number, number][] = points.map((p, i) => [x(i), y(p[1])])
  svg.append(
    svgEl("path", { d: linePath(pts), class: "md-spark-line" }),
    // Zero-length round-capped segment renders as an undistorted dot even
    // with preserveAspectRatio="none" (the stroke doesn't scale).
    svgEl("path", {
      d: `M${pts[pts.length - 1][0]},${pts[pts.length - 1][1]}h0`,
      class: "md-spark-dot",
    }),
  )
  return svg
}

function renderTile(t: DeskTile): HTMLElement {
  const tile = htmlEl("div", `md-tile${t.status === "stale" ? " is-stale" : ""}`)

  const top = htmlEl("div", "md-tile-top")
  top.append(htmlEl("span", "md-tile-label", t.label))
  if (t.status === "stale") {
    top.append(
      htmlEl("span", "md-badge md-badge-stale", `Stale, last ${fmtShortDate(t.last_good)}`),
    )
  } else if (t.tier === 2) {
    const badge = htmlEl("span", "md-badge", "Unofficial")
    badge.title = `via ${t.source} (unofficial)`
    top.append(badge)
  }

  const value = htmlEl("div", "md-tile-value", fmtValue(t))

  const dir = t.chg === null || t.chg === 0 ? "flat" : t.chg > 0 ? "up" : "down"
  const chg = htmlEl("div", `md-tile-chg md-${dir}`)
  chg.append(
    htmlEl("span", "md-arrow", dir === "up" ? "▲" : dir === "down" ? "▼" : "–"),
    document.createTextNode(` ${fmtChange(t)}`),
  )

  const meta = htmlEl("div", "md-tile-meta")
  const src = htmlEl("a", "md-src", t.source) as HTMLAnchorElement
  src.href = t.source_url
  src.target = "_blank"
  src.rel = "noopener noreferrer"
  meta.append(src, htmlEl("span", "md-date", `· ${fmtShortDate(t.as_of)}`))

  tile.append(top, value, chg, sparkline(t.spark), meta)
  if (t.note && t.group !== "rates") {
    const note = htmlEl("div", "md-tile-note", t.note)
    note.title = t.note
    tile.append(note)
  }
  return tile
}

function panel(
  title: string,
  sub?: string,
): { root: HTMLElement; body: HTMLElement; head: HTMLElement } {
  const root = htmlEl("section", "md-panel")
  const head = htmlEl("div", "md-panel-head")
  head.append(htmlEl("span", "md-panel-title", title))
  if (sub) head.append(htmlEl("span", "md-panel-sub", sub))
  const body = htmlEl("div", "md-panel-body")
  root.append(head, body)
  return { root, body, head }
}

function renderCurve(host: HTMLElement, curve: NonNullable<DeskData["curve"]>) {
  const wrap = htmlEl("div", "md-curve")
  const legend = htmlEl("div", "md-legend")
  const series = [
    { name: "Latest", date: curve.as_of, y: curve.latest, cls: "md-curve-latest" },
    curve.week_ago && {
      name: "1 week ago",
      date: curve.week_ago.date,
      y: curve.week_ago.y,
      cls: "md-curve-week",
    },
    curve.month_ago && {
      name: "1 month ago",
      date: curve.month_ago.date,
      y: curve.month_ago.y,
      cls: "md-curve-month",
    },
  ].filter(Boolean) as { name: string; date: string; y: (number | null)[]; cls: string }[]

  for (const s of series) {
    const item = htmlEl("span", "md-legend-item")
    const key = htmlEl("span", `md-legend-key ${s.cls}`)
    item.append(key, document.createTextNode(`${s.name} (${fmtShortDate(s.date)})`))
    legend.append(item)
  }

  const plot = htmlEl("div", "md-curve-plot")
  plot.tabIndex = 0
  plot.setAttribute(
    "aria-label",
    "Treasury par yield curve. Use left and right arrow keys to read each tenor.",
  )
  const svg = svgEl("svg", { class: "md-curve-svg", role: "img" })
  const cross = htmlEl("div", "md-crosshair")
  cross.hidden = true
  const tip = htmlEl("div", "md-tip")
  tip.hidden = true
  plot.append(svg, cross, tip)
  wrap.append(legend, plot)
  host.append(wrap)

  const H = 220
  const m = { top: 12, right: 14, bottom: 26, left: 44 }
  let xAt = (_i: number) => 0
  let yAt = (_v: number) => 0
  let active = -1

  const draw = () => {
    const W = Math.max(280, Math.round(plot.clientWidth))
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.setAttribute("height", String(H))
    svg.replaceChildren()

    const all = series.flatMap((s) => s.y).filter((v): v is number => v !== null)
    const dom = niceDomain(Math.min(...all), Math.max(...all), W < 480 ? 3 : 4, 0.1)
    // sqrt maturity spacing keeps the front end readable without a log axis
    const sx = linear(Math.sqrt(TENOR_YEARS[curve.tenors[0]]), Math.sqrt(30), m.left, W - m.right)
    xAt = (i: number) => sx(Math.sqrt(TENOR_YEARS[curve.tenors[i]]))
    yAt = linear(dom.lo, dom.hi, H - m.bottom, m.top)

    const grid = svgEl("g", { class: "md-grid" })
    for (const v of dom.ticks) {
      grid.append(svgEl("line", { x1: m.left, x2: W - m.right, y1: yAt(v), y2: yAt(v) }))
      const t = svgEl("text", { x: m.left - 8, y: yAt(v), class: "md-axis md-axis-y" })
      t.textContent = `${fmtNum(v, dom.step < 0.1 ? 2 : dom.step < 1 ? 1 : 0)}%`
      grid.append(t)
    }
    const narrowKeep = new Set(["1M", "6M", "2Y", "5Y", "10Y", "30Y"])
    let lastLabelX = -Infinity
    curve.tenors.forEach((tn, i) => {
      if (W < 520 && !narrowKeep.has(tn)) return
      if (xAt(i) - lastLabelX < 26) return
      lastLabelX = xAt(i)
      const t = svgEl("text", { x: xAt(i), y: H - 8, class: "md-axis md-axis-x" })
      t.textContent = tn
      grid.append(t)
    })
    svg.append(grid)

    // Oldest first so the latest curve sits on top.
    for (const s of [...series].reverse()) {
      svg.append(
        svgEl("path", {
          d: linePath(s.y.map((v, i) => [xAt(i), v === null ? null : yAt(v)])),
          class: `md-curve-line ${s.cls}`,
        }),
      )
    }
    curve.latest.forEach((v, i) => {
      if (v !== null)
        svg.append(svgEl("circle", { cx: xAt(i), cy: yAt(v), r: 2.5, class: "md-curve-pt" }))
    })
    if (active >= 0) show(active)
  }

  const show = (i: number) => {
    active = i
    const x = (xAt(i) / Number(svg.viewBox.baseVal.width)) * plot.clientWidth
    cross.style.left = `${x}px`
    cross.style.top = `${m.top}px`
    cross.style.height = `${H - m.top - m.bottom}px`
    cross.hidden = false
    tip.replaceChildren(htmlEl("span", "md-tip-head", curve.tenors[i]))
    for (const s of series) {
      const v = s.y[i]
      const row = htmlEl("span", "md-tip-row")
      row.append(
        htmlEl("span", `md-legend-key ${s.cls}`),
        htmlEl("span", "md-tip-val", v === null ? "n/a" : `${fmtNum(v, 2)}%`),
        htmlEl("span", "md-tip-lbl", s.name),
      )
      tip.append(row)
    }
    const latest = series[0].y[i]
    const wk = series[1]?.y[i]
    if (latest !== null && wk !== null && wk !== undefined) {
      tip.append(htmlEl("span", "md-tip-foot", `${signed((latest - wk) * 100, 0)} bp vs 1 week`))
    }
    placeTooltip(tip, plot, x, curve.latest[i] === null ? m.top : yAt(curve.latest[i] as number))
  }
  const hide = () => {
    active = -1
    cross.hidden = true
    tip.hidden = true
  }
  const nearest = (clientX: number) => {
    const rect = plot.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * Number(svg.viewBox.baseVal.width)
    let best = 0
    curve.tenors.forEach((_, i) => {
      if (Math.abs(xAt(i) - vx) < Math.abs(xAt(best) - vx)) best = i
    })
    return best
  }
  const onMove = (e: PointerEvent) => show(nearest(e.clientX))
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const base = active < 0 ? curve.tenors.length - 1 : active
    show(Math.max(0, Math.min(curve.tenors.length - 1, base + (e.key === "ArrowLeft" ? -1 : 1))))
  }
  plot.addEventListener("pointermove", onMove)
  plot.addEventListener("pointerleave", hide)
  plot.addEventListener("keydown", onKey)
  plot.addEventListener("blur", hide)
  const stop = onResize(plot, draw)
  window.addCleanup(() => {
    stop()
    plot.removeEventListener("pointermove", onMove)
    plot.removeEventListener("pointerleave", hide)
    plot.removeEventListener("keydown", onKey)
    plot.removeEventListener("blur", hide)
  })
  draw()
}

function fmtRefreshed(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
  return `${date}, ${time} UTC`
}

function weekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  })
}

function renderDesk(mount: HTMLElement, data: DeskData) {
  mount.replaceChildren()

  const head = htmlEl("div", "md-head")
  const line = htmlEl("div", "md-head-line")
  line.append(
    htmlEl("span", "md-head-label", "Prior close data"),
    htmlEl("span", "md-head-time", `Last refreshed ${fmtRefreshed(data.refreshed_utc)}`),
  )
  const disc = htmlEl("p", "md-disclaimer")
  const link = htmlEl("a", "internal", "disclaimer") as HTMLAnchorElement
  link.href = "/disclaimer"
  disc.append(
    document.createTextNode(
      "Nothing on this page is live or investment advice. Each tile shows the date of its own source. See the ",
    ),
    link,
    document.createTextNode("."),
  )
  head.append(line, disc)

  const book = htmlEl("a", "md-book") as HTMLAnchorElement
  book.href = "/#portfolio-dashboard"
  book.append(
    htmlEl("span", "md-book-label", "My book"),
    htmlEl("span", "md-book-text", "Positions, NAV and P&L are on the portfolio dashboard"),
    htmlEl("span", "md-book-arrow", "→"),
  )

  const grid = htmlEl("div", "md-grid-panels")

  for (const p of PANELS) {
    const tiles = p.keys.map((k) => data.tiles[k]).filter(Boolean)
    if (!tiles.length) continue
    const sub =
      p.id === "rates"
        ? "US Treasury par yields; spreads in bp"
        : p.id === "us_index"
          ? "Index levels"
          : undefined
    const { root, body } = panel(p.title, sub)
    root.dataset.panel = p.id
    const tileGrid = htmlEl("div", "md-tiles")
    tiles.forEach((t) => tileGrid.append(renderTile(t)))
    body.append(tileGrid)
    if (p.id === "rates" && data.curve) renderCurve(body, data.curve)

    grid.append(root)
  }

  // Calendar + headlines
  const lower = htmlEl("div", "md-lower")
  if (data.calendar.length) {
    const { root, body } = panel("Calendar", "Scheduled US releases, ET")
    const list = htmlEl("ul", "md-list md-cal")
    for (const e of data.calendar) {
      const li = htmlEl("li")
      const when = htmlEl("span", "md-cal-when")
      when.append(
        htmlEl("span", "md-cal-date", `${weekday(e.date)} ${fmtShortDate(e.date)}`),
        htmlEl("span", "md-cal-time", e.time_et ?? ""),
      )
      const a = htmlEl("a", "md-cal-event", e.event) as HTMLAnchorElement
      a.href = e.url
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      li.append(when, a, htmlEl("span", "md-list-src", e.source))
      list.append(li)
    }
    body.append(list)
    lower.append(root)
  }
  if (data.headlines.length) {
    const { root, body } = panel("Headlines", "Official sources only")
    const list = htmlEl("ul", "md-list md-news")
    for (const h of data.headlines) {
      const li = htmlEl("li")
      const a = htmlEl("a", "md-news-title", h.title) as HTMLAnchorElement
      a.href = h.url
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      const meta = htmlEl("span", "md-news-meta", `${h.source} · ${fmtShortDate(h.date)}`)
      li.append(meta, a)
      list.append(li)
    }
    body.append(list)
    lower.append(root)
  }

  const foot = htmlEl(
    "p",
    "md-foot",
    "Yahoo Finance is not an official data source, so those tiles are marked unofficial. " +
      "ECB rates are a 14:10 CET reference fix, published for information only. " +
      "Index and VIX data are the property of their respective owners.",
  )

  mount.append(head, book, grid, lower, foot)
}

document.addEventListener("nav", () => {
  const mount = document.querySelector<HTMLElement>("#market-desk")
  if (!mount) return

  let cancelled = false
  window.addCleanup(() => {
    cancelled = true
  })

  fetch("/static/market-data.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json()
    })
    .then((data: DeskData) => {
      if (!cancelled) renderDesk(mount, data)
    })
    .catch(() => {
      if (cancelled) return
      mount.replaceChildren(htmlEl("div", "md-error", "Market data is unavailable right now."))
    })
})
