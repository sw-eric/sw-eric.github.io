// Small hand-rolled SVG helpers shared by the Market Desk and Workshop
// widgets. Colors never live here: every mark gets a class and the
// palette comes from custom.scss, so light/dark mode just works.

const NS = "http://www.w3.org/2000/svg"

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

export function htmlEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// Round tick step (1 / 2 / 2.5 / 5 x 10^k) giving roughly `target` ticks.
export function niceStep(span: number, target: number): number {
  if (!(span > 0)) return 1
  const raw = span / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return nice * mag
}

// Domain padded by `padFrac` and snapped out to round ticks.
export function niceDomain(
  lo: number,
  hi: number,
  target: number,
  padFrac = 0.08,
): { lo: number; hi: number; step: number; ticks: number[] } {
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.01 || 1
    hi += Math.abs(hi) * 0.01 || 1
  }
  const pad = (hi - lo) * padFrac
  const step = niceStep(hi - lo + 2 * pad, target)
  const nlo = Math.floor((lo - pad) / step) * step
  const nhi = Math.ceil((hi + pad) / step) * step
  const ticks: number[] = []
  for (let v = nlo; v <= nhi + step / 2; v += step) ticks.push(Number(v.toFixed(10)))
  return { lo: nlo, hi: nhi, step, ticks }
}

export function linear(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  return (v: number) => r0 + (v - d0) * k
}

// Path through points, breaking the line wherever y is null.
export function linePath(points: [number, number | null][]): string {
  let d = ""
  let pen = false
  for (const [x, y] of points) {
    if (y === null || !Number.isFinite(y)) {
      pen = false
      continue
    }
    d += `${pen ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`
    pen = true
  }
  return d
}

export function parseISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

export function fmtShortDate(iso: string, withYear = false): string {
  return new Date(parseISO(iso)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  })
}

export function fmtNum(n: number, decimals: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function signed(n: number, decimals: number): string {
  const s = fmtNum(Math.abs(n), decimals)
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s
}

// Positions a tooltip near (x, y) inside `box`, flipping below the point
// when there is no room above.
export function placeTooltip(tip: HTMLElement, box: HTMLElement, x: number, y: number) {
  tip.hidden = false
  const tw = tip.offsetWidth
  const th = tip.offsetHeight
  const left = Math.min(Math.max(x - tw / 2, 4), box.clientWidth - tw - 4)
  const top = y - th - 12 >= 0 ? y - th - 12 : y + 14
  tip.style.left = `${left}px`
  tip.style.top = `${top}px`
}

// Redraws on container resize; returns a disposer for window.addCleanup.
export function onResize(target: Element, draw: () => void): () => void {
  let frame = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(draw)
  })
  ro.observe(target)
  return () => {
    cancelAnimationFrame(frame)
    ro.disconnect()
  }
}
