// ============================================================
// WORKSHOP WIDGETS
// #yield-curve-explorer: compares Treasury par curves on two dates and
//   charts 2s10s since 1990 with inversions shaded. Reads the same
//   history file the Market Desk pipeline writes.
// #options-pricer: Black-Scholes European pricer with Greeks, payoff at
//   expiry, breakeven and max loss. Math lives in blackScholes.ts.
// ============================================================
import {
  fmtNum,
  fmtShortDate,
  htmlEl,
  linePath,
  linear,
  niceDomain,
  onResize,
  parseISO,
  placeTooltip,
  signed,
  svgEl,
} from "./chartKit"
import { blackScholes, expiryPnl, positionOutcome, type Strategy } from "./blackScholes"

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

type Row = [string, ...(number | null)[]]

function field(labelText: string, input: HTMLElement, hint?: string): HTMLElement {
  const wrap = htmlEl("label", "ws-field")
  wrap.append(htmlEl("span", "ws-field-label", labelText), input)
  if (hint) wrap.append(htmlEl("span", "ws-field-hint", hint))
  return wrap
}

function numberInput(value: number, step: number, min?: number): HTMLInputElement {
  const i = htmlEl("input", "ws-input") as HTMLInputElement
  i.type = "number"
  i.inputMode = "decimal"
  i.step = String(step)
  if (min !== undefined) i.min = String(min)
  i.value = String(value)
  return i
}

function segButtons(
  options: [string, string][],
  initial: string,
  onPick: (v: string) => void,
): HTMLElement {
  const group = htmlEl("div", "ws-seg")
  group.setAttribute("role", "group")
  const set = (v: string) =>
    group
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)))
  for (const [v, label] of options) {
    const b = htmlEl("button", "ws-seg-btn", label) as HTMLButtonElement
    b.type = "button"
    b.dataset.v = v
    b.addEventListener("click", () => {
      set(v)
      onPick(v)
    })
    group.append(b)
  }
  set(initial)
  return group
}

// ------------------------------------------------------------
// Yield curve explorer
// ------------------------------------------------------------
function renderExplorer(mount: HTMLElement, tenors: string[], rows: Row[]) {
  mount.replaceChildren()
  const dates = rows.map((r) => r[0])
  const byDate = new Map(rows.map((r) => [r[0], r.slice(1) as (number | null)[]]))
  const first = dates[0]
  const last = dates[dates.length - 1]

  // Latest row on or before the requested date.
  const snap = (iso: string): string => {
    let lo = 0
    let hi = dates.length - 1
    if (iso <= first) return first
    if (iso >= last) return last
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (dates[mid] <= iso) lo = mid
      else hi = mid - 1
    }
    return dates[lo]
  }
  const shift = (iso: string, years: number, months = 0): string => {
    const d = new Date(parseISO(iso))
    d.setUTCFullYear(d.getUTCFullYear() - years)
    d.setUTCMonth(d.getUTCMonth() - months)
    return d.toISOString().slice(0, 10)
  }

  let dateA = last
  let dateB = snap(shift(last, 1))

  // Controls
  const controls = htmlEl("div", "ws-controls")
  const inputA = htmlEl("input", "ws-input") as HTMLInputElement
  const inputB = htmlEl("input", "ws-input") as HTMLInputElement
  for (const i of [inputA, inputB]) {
    i.type = "date"
    i.min = first
    i.max = last
  }
  const noteA = htmlEl("span", "ws-field-hint")
  const noteB = htmlEl("span", "ws-field-hint")
  const fieldA = field("Date A", inputA)
  fieldA.append(noteA)
  const fieldB = field("Date B", inputB)
  fieldB.append(noteB)
  const quick = segButtons(
    [
      ["1m", "1M before A"],
      ["1y", "1Y before A"],
      ["5y", "5Y before A"],
      ["10y", "10Y before A"],
    ],
    "1y",
    (v) => {
      const target =
        v === "1m" ? shift(dateA, 0, 1) : shift(dateA, v === "1y" ? 1 : v === "5y" ? 5 : 10)
      dateB = snap(target)
      update()
    },
  )
  const quickWrap = htmlEl("div", "ws-field")
  quickWrap.append(htmlEl("span", "ws-field-label", "Set B to"), quick)
  controls.append(fieldA, fieldB, quickWrap)

  // Curve chart
  const curveCard = htmlEl("div", "ws-card")
  const legend = htmlEl("div", "md-legend")
  const plot = htmlEl("div", "md-curve-plot")
  plot.tabIndex = 0
  plot.setAttribute(
    "aria-label",
    "Two Treasury curves. Use left and right arrow keys to read each tenor.",
  )
  const svg = svgEl("svg", { class: "md-curve-svg", role: "img" })
  const cross = htmlEl("div", "md-crosshair")
  const tip = htmlEl("div", "md-tip")
  cross.hidden = tip.hidden = true
  plot.append(svg, cross, tip)
  const tableWrap = htmlEl("div", "ws-table-wrap")
  curveCard.append(legend, plot, tableWrap)

  // 2s10s chart
  const spreadCard = htmlEl("div", "ws-card")
  const spreadHead = htmlEl("div", "ws-card-head")
  spreadHead.append(htmlEl("span", "md-panel-title", "2s10s since 1990"))
  let spreadRange = "all"
  spreadHead.append(
    segButtons(
      [
        ["5", "5Y"],
        ["10", "10Y"],
        ["all", "All"],
      ],
      "all",
      (v) => {
        spreadRange = v
        drawSpread()
      },
    ),
  )
  const splot = htmlEl("div", "md-curve-plot")
  splot.tabIndex = 0
  splot.setAttribute("aria-label", "10Y minus 2Y spread history. Shaded areas are inversions.")
  const ssvg = svgEl("svg", { class: "md-curve-svg", role: "img" })
  const scross = htmlEl("div", "md-crosshair")
  const stip = htmlEl("div", "md-tip")
  scross.hidden = stip.hidden = true
  splot.append(ssvg, scross, stip)
  const sNote = htmlEl(
    "p",
    "ws-caption",
    "Shaded: 2Y yield above 10Y yield (inverted). Vertical lines mark dates A and B.",
  )
  spreadCard.append(spreadHead, splot, sNote)

  mount.append(controls, curveCard, spreadCard)

  const i2 = tenors.indexOf("2Y")
  const i10 = tenors.indexOf("10Y")
  const spread: [string, number][] = rows
    .filter((r) => r[i2 + 1] !== null && r[i10 + 1] !== null)
    .map((r) => [r[0], Math.round(((r[i10 + 1] as number) - (r[i2 + 1] as number)) * 1000) / 10])

  // ---- curve drawing ----
  const H = 240
  const m = { top: 12, right: 14, bottom: 26, left: 44 }
  let xAt = (_i: number) => 0
  let yAt = (_v: number) => 0
  let active = -1

  const curveSeries = () => [
    { name: "A", date: dateA, y: byDate.get(dateA)!, cls: "md-curve-latest" },
    { name: "B", date: dateB, y: byDate.get(dateB)!, cls: "md-curve-week" },
  ]

  const drawCurve = () => {
    const series = curveSeries()
    const W = Math.max(280, Math.round(plot.clientWidth))
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.setAttribute("height", String(H))
    svg.replaceChildren()
    const all = series.flatMap((s) => s.y).filter((v): v is number => v !== null)
    const dom = niceDomain(Math.min(...all), Math.max(...all), W < 480 ? 3 : 5, 0.1)
    const sx = linear(Math.sqrt(1 / 12), Math.sqrt(30), m.left, W - m.right)
    xAt = (i) => sx(Math.sqrt(TENOR_YEARS[tenors[i]]))
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
    tenors.forEach((tn, i) => {
      if (W < 520 && !narrowKeep.has(tn)) return
      if (xAt(i) - lastLabelX < 26) return
      lastLabelX = xAt(i)
      const t = svgEl("text", { x: xAt(i), y: H - 8, class: "md-axis md-axis-x" })
      t.textContent = tn
      grid.append(t)
    })
    svg.append(grid)
    for (const s of [...series].reverse()) {
      svg.append(
        svgEl("path", {
          d: linePath(s.y.map((v, i) => [xAt(i), v === null ? null : yAt(v)])),
          class: `md-curve-line ${s.cls}`,
        }),
      )
      s.y.forEach((v, i) => {
        if (v !== null)
          svg.append(
            svgEl("circle", { cx: xAt(i), cy: yAt(v), r: 2.5, class: `md-curve-pt ${s.cls}-pt` }),
          )
      })
    }
    if (active >= 0) showCurve(active)
  }

  const showCurve = (i: number) => {
    active = i
    const [a, b] = curveSeries()
    const x = (xAt(i) / Number(svg.viewBox.baseVal.width)) * plot.clientWidth
    cross.style.left = `${x}px`
    cross.style.top = `${m.top}px`
    cross.style.height = `${H - m.top - m.bottom}px`
    cross.hidden = false
    tip.replaceChildren(htmlEl("span", "md-tip-head", tenors[i]))
    for (const s of [a, b]) {
      const row = htmlEl("span", "md-tip-row")
      const v = s.y[i]
      row.append(
        htmlEl("span", `md-legend-key ${s.cls}`),
        htmlEl("span", "md-tip-val", v === null ? "n/a" : `${fmtNum(v, 2)}%`),
        htmlEl("span", "md-tip-lbl", fmtShortDate(s.date, true)),
      )
      tip.append(row)
    }
    if (a.y[i] !== null && b.y[i] !== null) {
      tip.append(
        htmlEl(
          "span",
          "md-tip-foot",
          `A minus B: ${signed(((a.y[i] as number) - (b.y[i] as number)) * 100, 0)} bp`,
        ),
      )
    }
    const yv = a.y[i] ?? b.y[i]
    placeTooltip(tip, plot, x, yv === null ? m.top : yAt(yv))
  }

  const renderTable = () => {
    const [a, b] = curveSeries()
    const table = htmlEl("table", "ws-table")
    const head = htmlEl("tr")
    head.append(htmlEl("th", "", ""))
    tenors.forEach((t) => head.append(htmlEl("th", "", t)))
    const thead = htmlEl("thead")
    thead.append(head)
    const tbody = htmlEl("tbody")
    const rowOf = (label: string, vals: (number | null)[], fmt: (v: number) => string) => {
      const tr = htmlEl("tr")
      tr.append(htmlEl("th", "", label))
      vals.forEach((v) => tr.append(htmlEl("td", "", v === null ? "" : fmt(v))))
      tbody.append(tr)
    }
    rowOf(`A ${fmtShortDate(a.date, true)}`, a.y, (v) => fmtNum(v, 2))
    rowOf(`B ${fmtShortDate(b.date, true)}`, b.y, (v) => fmtNum(v, 2))
    rowOf(
      "A minus B, bp",
      a.y.map((v, i) => (v === null || b.y[i] === null ? null : (v - (b.y[i] as number)) * 100)),
      (v) => signed(v, 0),
    )
    table.append(thead, tbody)
    tableWrap.replaceChildren(table)
  }

  // ---- 2s10s drawing ----
  const SH = 200
  const sm = { top: 12, right: 14, bottom: 26, left: 50 }
  let sView: [string, number][] = spread
  let sxAt = (_i: number) => 0
  let syAt = (_v: number) => 0

  const drawSpread = () => {
    const cutoff = spreadRange === "all" ? first : shift(last, Number(spreadRange))
    sView = spread.filter((p) => p[0] >= cutoff)
    const W = Math.max(280, Math.round(splot.clientWidth))
    ssvg.setAttribute("viewBox", `0 0 ${W} ${SH}`)
    ssvg.setAttribute("height", String(SH))
    ssvg.replaceChildren()
    const vals = sView.map((p) => p[1])
    const dom = niceDomain(Math.min(0, ...vals), Math.max(0, ...vals), W < 480 ? 3 : 4, 0.06)
    const t0 = parseISO(sView[0][0])
    const t1 = parseISO(sView[sView.length - 1][0])
    const tx = linear(t0, t1, sm.left, W - sm.right)
    sxAt = (i) => tx(parseISO(sView[i][0]))
    syAt = linear(dom.lo, dom.hi, SH - sm.bottom, sm.top)

    const grid = svgEl("g", { class: "md-grid" })
    for (const v of dom.ticks) {
      grid.append(svgEl("line", { x1: sm.left, x2: W - sm.right, y1: syAt(v), y2: syAt(v) }))
      const t = svgEl("text", { x: sm.left - 8, y: syAt(v), class: "md-axis md-axis-y" })
      t.textContent = `${fmtNum(v, 0)} bp`
      grid.append(t)
    }
    // Year labels, spaced to fit.
    const y0 = new Date(t0).getUTCFullYear()
    const y1 = new Date(t1).getUTCFullYear()
    const span = y1 - y0
    const every = span > 24 ? 5 : span > 10 ? 2 : 1
    for (let y = y0 + 1; y <= y1; y++) {
      if (y % every !== 0) continue
      const x = tx(Date.UTC(y, 0, 1))
      if (x < sm.left + 10 || x > W - sm.right - 10) continue
      const t = svgEl("text", { x, y: SH - 8, class: "md-axis md-axis-x" })
      t.textContent = String(y)
      grid.append(t)
    }
    ssvg.append(grid)

    // Inversion shading: one band per contiguous run below zero.
    const bands = svgEl("g", { class: "ws-inversion" })
    let runStart = -1
    sView.forEach((p, i) => {
      const inv = p[1] < 0
      if (inv && runStart < 0) runStart = i
      if ((!inv || i === sView.length - 1) && runStart >= 0) {
        const end = inv ? i : i - 1
        const x0 = sxAt(runStart)
        const x1 = Math.max(sxAt(end), x0 + 1)
        bands.append(
          svgEl("rect", { x: x0, y: sm.top, width: x1 - x0, height: SH - sm.top - sm.bottom }),
        )
        runStart = -1
      }
    })
    ssvg.append(bands)
    ssvg.append(
      svgEl("line", {
        x1: sm.left,
        x2: W - sm.right,
        y1: syAt(0),
        y2: syAt(0),
        class: "ws-zero",
      }),
    )
    ssvg.append(
      svgEl("path", {
        d: linePath(sView.map((p, i) => [sxAt(i), syAt(p[1])])),
        class: "md-curve-line ws-spread-line",
      }),
    )
    for (const [d, cls] of [
      [dateA, "ws-mark-a"],
      [dateB, "ws-mark-b"],
    ]) {
      if (d < sView[0][0]) continue
      const x = tx(parseISO(d))
      ssvg.append(
        svgEl("line", { x1: x, x2: x, y1: sm.top, y2: SH - sm.bottom, class: `ws-mark ${cls}` }),
      )
    }
  }

  const showSpread = (clientX: number) => {
    const rect = splot.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * Number(ssvg.viewBox.baseVal.width)
    let lo = 0
    let hi = sView.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (sxAt(mid) < vx) lo = mid
      else hi = mid
    }
    const i = Math.abs(sxAt(lo) - vx) <= Math.abs(sxAt(hi) - vx) ? lo : hi
    const x = (sxAt(i) / Number(ssvg.viewBox.baseVal.width)) * splot.clientWidth
    scross.style.left = `${x}px`
    scross.style.top = `${sm.top}px`
    scross.style.height = `${SH - sm.top - sm.bottom}px`
    scross.hidden = false
    stip.replaceChildren(
      htmlEl("span", "md-tip-head", fmtShortDate(sView[i][0], true)),
      htmlEl("span", "md-tip-val", `${signed(sView[i][1], 0)} bp`),
    )
    placeTooltip(stip, splot, x, syAt(sView[i][1]))
  }

  const update = () => {
    inputA.value = dateA
    inputB.value = dateB
    noteA.textContent = ""
    noteB.textContent = ""
    legend.replaceChildren()
    for (const s of curveSeries()) {
      const item = htmlEl("span", "md-legend-item")
      item.append(
        htmlEl("span", `md-legend-key ${s.cls}`),
        document.createTextNode(`${s.name}: ${fmtShortDate(s.date, true)}`),
      )
      legend.append(item)
    }
    drawCurve()
    renderTable()
    drawSpread()
  }

  const onDate = (which: "A" | "B") => (e: Event) => {
    const raw = (e.target as HTMLInputElement).value
    if (!raw) return
    const snapped = snap(raw)
    if (which === "A") dateA = snapped
    else dateB = snapped
    update()
    if (snapped !== raw) {
      ;(which === "A" ? noteA : noteB).textContent =
        `No data on ${fmtShortDate(raw, true)}; showing the prior session.`
    }
  }
  inputA.addEventListener("change", onDate("A"))
  inputB.addEventListener("change", onDate("B"))

  const onCurveMove = (e: PointerEvent) => {
    const rect = plot.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * Number(svg.viewBox.baseVal.width)
    let best = 0
    tenors.forEach((_, i) => {
      if (Math.abs(xAt(i) - vx) < Math.abs(xAt(best) - vx)) best = i
    })
    showCurve(best)
  }
  const hideCurve = () => {
    active = -1
    cross.hidden = tip.hidden = true
  }
  const onCurveKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const base = active < 0 ? tenors.length - 1 : active
    showCurve(Math.max(0, Math.min(tenors.length - 1, base + (e.key === "ArrowLeft" ? -1 : 1))))
  }
  const onSpreadMove = (e: PointerEvent) => showSpread(e.clientX)
  const hideSpread = () => {
    scross.hidden = stip.hidden = true
  }
  plot.addEventListener("pointermove", onCurveMove)
  plot.addEventListener("pointerleave", hideCurve)
  plot.addEventListener("keydown", onCurveKey)
  plot.addEventListener("blur", hideCurve)
  splot.addEventListener("pointermove", onSpreadMove)
  splot.addEventListener("pointerleave", hideSpread)
  const stopA = onResize(plot, drawCurve)
  const stopB = onResize(splot, drawSpread)
  window.addCleanup(() => {
    stopA()
    stopB()
  })
  update()
}

// ------------------------------------------------------------
// Options pricer
// ------------------------------------------------------------
const STRATEGIES: [Strategy, string][] = [
  ["long_call", "Long call"],
  ["long_put", "Long put"],
  ["short_put", "Cash-secured put"],
]

function money(n: number | null, decimals = 2): string {
  if (n === null) return "Unlimited"
  const s = `$${fmtNum(Math.abs(n), decimals)}`
  return n < 0 ? `−${s}` : s
}

function renderPricer(mount: HTMLElement, riskFree: { rate: number; asOf: string } | null) {
  mount.replaceChildren()
  let strategy: Strategy = "long_call"

  const S = numberInput(100, 0.01, 0.01)
  const K = numberInput(105, 0.5, 0.01)
  const days = numberInput(45, 1, 0)
  const vol = numberInput(30, 0.5, 0.01)
  const rate = numberInput(riskFree ? riskFree.rate : 4, 0.01)
  const q = numberInput(0, 0.01, 0)
  const contracts = numberInput(1, 1, 1)
  const premium = numberInput(0, 0.01, 0)
  let premiumTouched = false

  const useModel = htmlEl("button", "ws-link-btn", "Use model price") as HTMLButtonElement
  useModel.type = "button"

  const inputs = htmlEl("div", "ws-controls ws-controls-grid")
  const stratField = htmlEl("div", "ws-field ws-field-wide")
  stratField.append(
    htmlEl("span", "ws-field-label", "Position"),
    segButtons(STRATEGIES, strategy, (v) => {
      strategy = v as Strategy
      recompute()
    }),
  )
  const premiumField = field("Premium per share", premium)
  premiumField.append(useModel)
  inputs.append(
    stratField,
    field("Underlying price", S),
    field("Strike", K),
    field("Days to expiry", days),
    field("Volatility, % a year", vol),
    field(
      "Risk-free rate, %",
      rate,
      riskFree ? `Default: US 3M par yield, ${fmtShortDate(riskFree.asOf)}` : undefined,
    ),
    field("Dividend yield, %", q),
    field("Contracts (x100)", contracts),
    premiumField,
  )

  const results = htmlEl("div", "ws-results")
  const chartCard = htmlEl("div", "ws-card")
  const legend = htmlEl("div", "md-legend")
  for (const [cls, label] of [
    ["ws-pay-expiry", "P&L at expiry"],
    ["ws-pay-today", "P&L today (model)"],
  ]) {
    const item = htmlEl("span", "md-legend-item")
    item.append(htmlEl("span", `md-legend-key ${cls}`), document.createTextNode(label))
    legend.append(item)
  }
  const plot = htmlEl("div", "md-curve-plot")
  plot.tabIndex = 0
  plot.setAttribute("aria-label", "Profit and loss by underlying price.")
  const svg = svgEl("svg", { class: "md-curve-svg", role: "img" })
  const cross = htmlEl("div", "md-crosshair")
  const tip = htmlEl("div", "md-tip")
  cross.hidden = tip.hidden = true
  plot.append(svg, cross, tip)
  chartCard.append(legend, plot)

  const note = htmlEl(
    "p",
    "ws-caption",
    "European exercise, Black-Scholes-Merton with a continuous dividend yield. " +
      "Listed US equity options are American, so early exercise is not modeled. " +
      "The mandate permits long calls, long puts and cash-secured puts only.",
  )
  mount.append(inputs, results, chartCard, note)

  const H = 240
  const m = { top: 12, right: 14, bottom: 26, left: 62 }
  let grid: { x: number; exp: number; today: number }[] = []
  let xs = (_v: number) => 0
  let ys = (_v: number) => 0

  const read = () => {
    const n = (i: HTMLInputElement, fallback: number) => {
      const v = parseFloat(i.value)
      return Number.isFinite(v) ? v : fallback
    }
    return {
      S: Math.max(n(S, 100), 0.01),
      K: Math.max(n(K, 100), 0.01),
      T: Math.max(n(days, 0), 0) / 365,
      sigma: Math.max(n(vol, 30), 0) / 100,
      r: n(rate, 0) / 100,
      q: Math.max(n(q, 0), 0) / 100,
      contracts: Math.max(Math.round(n(contracts, 1)), 1),
      premium: Math.max(n(premium, 0), 0),
    }
  }

  const statRow = (label: string, value: string, sub?: string) => {
    const cell = htmlEl("div", "ws-stat")
    cell.append(htmlEl("span", "ws-stat-label", label), htmlEl("span", "ws-stat-value", value))
    if (sub) cell.append(htmlEl("span", "ws-stat-sub", sub))
    return cell
  }

  const recompute = () => {
    const p = read()
    const type = strategy === "long_call" ? "call" : "put"
    const bs = blackScholes({ type, S: p.S, K: p.K, T: p.T, r: p.r, q: p.q, sigma: p.sigma })
    if (!premiumTouched) premium.value = bs.price.toFixed(2)
    const prem = premiumTouched ? p.premium : Number(bs.price.toFixed(2))
    const out = positionOutcome(strategy, p.K, prem, p.contracts)
    const side = strategy === "short_put" ? -1 : 1
    const n = p.contracts * 100

    const greeks = htmlEl("div", "ws-stats")
    greeks.append(
      statRow("Model price", money(bs.price), `${money(bs.price * 100)} per contract`),
      statRow(
        "Delta",
        fmtNum(bs.delta * side, 3),
        `${fmtNum(bs.delta * side * n, 1)} share equivalent`,
      ),
      statRow("Gamma", fmtNum(bs.gamma * side, 4), "per $1 move"),
      statRow("Vega", fmtNum(bs.vega * side, 3), `${money(bs.vega * side * n)} per vol point`),
      statRow("Theta", fmtNum(bs.theta * side, 3), `${money(bs.theta * side * n)} per day`),
      statRow("Rho", fmtNum(bs.rho * side, 3), `${money(bs.rho * side * n)} per rate point`),
    )
    const outcome = htmlEl("div", "ws-stats ws-stats-outcome")
    outcome.append(
      statRow("Breakeven at expiry", money(out.breakeven)),
      statRow("Max loss", money(out.maxLoss), "whole position"),
      statRow("Max gain", money(out.maxGain), "whole position"),
    )
    if (out.cashRequired !== null)
      outcome.append(statRow("Cash to secure", money(out.cashRequired)))
    const note2 = htmlEl(
      "p",
      "ws-caption",
      `Greeks are per share and signed for the position${strategy === "short_put" ? " (short)" : ""}. ` +
        `Premium ${premiumTouched ? "entered by you" : "set to the model price"}.`,
    )
    results.replaceChildren(greeks, outcome, note2)

    // Payoff grid: 50% to 150% of the larger of spot and strike.
    const center = Math.max(p.S, p.K)
    const lo = center * 0.5
    const hi = center * 1.5
    grid = []
    for (let i = 0; i <= 160; i++) {
      const x = lo + ((hi - lo) * i) / 160
      const val = blackScholes({ type, S: x, K: p.K, T: p.T, r: p.r, q: p.q, sigma: p.sigma }).price
      grid.push({
        x,
        exp: expiryPnl(strategy, p.K, prem, x, p.contracts),
        today: (val - prem) * n * side,
      })
    }
    drawPayoff(p.S, out.breakeven, lo, hi)
  }

  let lastArgs: [number, number, number, number] = [0, 0, 0, 0]
  const drawPayoff = (spot: number, be: number, lo: number, hi: number) => {
    lastArgs = [spot, be, lo, hi]
    const W = Math.max(280, Math.round(plot.clientWidth))
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.setAttribute("height", String(H))
    svg.replaceChildren()
    const vals = grid.flatMap((g) => [g.exp, g.today])
    const dom = niceDomain(Math.min(0, ...vals), Math.max(0, ...vals), W < 480 ? 4 : 5, 0.08)
    xs = linear(lo, hi, m.left, W - m.right)
    ys = linear(dom.lo, dom.hi, H - m.bottom, m.top)

    const g = svgEl("g", { class: "md-grid" })
    for (const v of dom.ticks) {
      g.append(svgEl("line", { x1: m.left, x2: W - m.right, y1: ys(v), y2: ys(v) }))
      const t = svgEl("text", { x: m.left - 8, y: ys(v), class: "md-axis md-axis-y" })
      t.textContent = money(v, 0)
      g.append(t)
    }
    const xd = niceDomain(lo, hi, W < 480 ? 4 : 6, 0)
    for (const v of xd.ticks) {
      if (v < lo || v > hi) continue
      const t = svgEl("text", { x: xs(v), y: H - 8, class: "md-axis md-axis-x" })
      t.textContent = fmtNum(v, v < 10 ? 1 : 0)
      g.append(t)
    }
    svg.append(g)

    // Profit / loss washes under the expiry line, split at zero.
    const zeroY = ys(0)
    const area = (sign: 1 | -1) =>
      `M${xs(grid[0].x)},${zeroY}` +
      grid
        .map(
          (p) =>
            `L${xs(p.x).toFixed(2)},${ys(sign > 0 ? Math.max(p.exp, 0) : Math.min(p.exp, 0)).toFixed(2)}`,
        )
        .join("") +
      `L${xs(grid[grid.length - 1].x)},${zeroY}Z`
    svg.append(
      svgEl("path", { d: area(1), class: "ws-pay-gain" }),
      svgEl("path", { d: area(-1), class: "ws-pay-loss" }),
      svgEl("line", { x1: m.left, x2: W - m.right, y1: zeroY, y2: zeroY, class: "ws-zero" }),
    )
    // Stack the second label a line lower when the two markers are close.
    const crowded = Math.abs(xs(spot) - xs(be)) < 64
    for (const [v, cls, label, row] of [
      [spot, "ws-mark-a", "Spot", 0],
      [be, "ws-mark-b", "Breakeven", crowded ? 1 : 0],
    ] as [number, string, string, number][]) {
      if (v < lo || v > hi) continue
      svg.append(
        svgEl("line", {
          x1: xs(v),
          x2: xs(v),
          y1: m.top,
          y2: H - m.bottom,
          class: `ws-mark ${cls}`,
        }),
      )
      const t = svgEl("text", {
        x: xs(v) + 4,
        y: m.top + 10 + row * 12,
        class: "md-axis ws-mark-label",
      })
      t.textContent = label
      svg.append(t)
    }
    svg.append(
      svgEl("path", {
        d: linePath(grid.map((p) => [xs(p.x), ys(p.today)])),
        class: "md-curve-line ws-pay-today",
      }),
      svgEl("path", {
        d: linePath(grid.map((p) => [xs(p.x), ys(p.exp)])),
        class: "md-curve-line ws-pay-expiry",
      }),
    )
  }

  const showPayoff = (clientX: number) => {
    if (!grid.length) return
    const rect = plot.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * Number(svg.viewBox.baseVal.width)
    let best = 0
    grid.forEach((p, i) => {
      if (Math.abs(xs(p.x) - vx) < Math.abs(xs(grid[best].x) - vx)) best = i
    })
    const p = grid[best]
    const x = (xs(p.x) / Number(svg.viewBox.baseVal.width)) * plot.clientWidth
    cross.style.left = `${x}px`
    cross.style.top = `${m.top}px`
    cross.style.height = `${H - m.top - m.bottom}px`
    cross.hidden = false
    tip.replaceChildren(htmlEl("span", "md-tip-head", `Underlying ${money(p.x)}`))
    for (const [cls, label, v] of [
      ["ws-pay-expiry", "At expiry", p.exp],
      ["ws-pay-today", "Today", p.today],
    ] as [string, string, number][]) {
      const row = htmlEl("span", "md-tip-row")
      row.append(
        htmlEl("span", `md-legend-key ${cls}`),
        htmlEl("span", "md-tip-val", money(v)),
        htmlEl("span", "md-tip-lbl", label),
      )
      tip.append(row)
    }
    placeTooltip(tip, plot, x, ys(p.exp))
  }

  const onInput = (e: Event) => {
    if (e.target === premium) premiumTouched = true
    recompute()
  }
  inputs.addEventListener("input", onInput)
  useModel.addEventListener("click", () => {
    premiumTouched = false
    recompute()
  })
  const onMove = (e: PointerEvent) => showPayoff(e.clientX)
  const hide = () => {
    cross.hidden = tip.hidden = true
  }
  plot.addEventListener("pointermove", onMove)
  plot.addEventListener("pointerleave", hide)
  const stop = onResize(plot, () => drawPayoff(...lastArgs))
  window.addCleanup(() => {
    stop()
    inputs.removeEventListener("input", onInput)
  })
  recompute()
}

document.addEventListener("nav", () => {
  let cancelled = false
  window.addCleanup(() => {
    cancelled = true
  })

  const explorer = document.querySelector<HTMLElement>("#yield-curve-explorer")
  if (explorer) {
    explorer.replaceChildren(htmlEl("div", "md-loading", "Loading Treasury history"))
    fetch("/static/market-history.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((h: { curve: { tenors: string[]; rows: Row[] } }) => {
        if (!cancelled) renderExplorer(explorer, h.curve.tenors, h.curve.rows)
      })
      .catch(() => {
        if (!cancelled)
          explorer.replaceChildren(
            htmlEl("div", "md-error", "Treasury history is unavailable right now."),
          )
      })
  }

  const pricer = document.querySelector<HTMLElement>("#options-pricer")
  if (pricer) {
    // Default the rate to the Desk's 3M yield when it is available; the
    // pricer still works without it.
    fetch("/static/market-data.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (cancelled) return
        const t = d?.tiles?.UST3M
        renderPricer(pricer, t ? { rate: t.value, asOf: t.as_of } : null)
      })
  }
})
