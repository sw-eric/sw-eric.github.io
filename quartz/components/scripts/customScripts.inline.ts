// ============================================================
// SIDEBAR NAV — active state (client-side to keep all pages'
// HTML identical, preventing Quartz SPA morph reordering)
// ============================================================
document.addEventListener("nav", () => {
  const currentSlug = window.location.pathname.replace(/^\//, "").replace(/\/$/, "") || "index"
  const toSlug = (href: string) =>
    href
      .replace(/^https?:\/\/[^/]+/, "")
      .replace(/^\//, "")
      .replace(/\/$/, "") || "index"

  document.querySelectorAll<HTMLAnchorElement>(".sidebar-nav-link").forEach((a) => {
    a.classList.remove("active", "parent-active")
  })
  document.querySelectorAll<HTMLAnchorElement>(".sidebar-nav-link").forEach((a) => {
    const href = a.getAttribute("href") ?? ""
    if (/^https?:\/\//.test(href)) return // never mark external links active
    if (toSlug(href) === currentSlug) a.classList.add("active")
  })
  document.querySelectorAll<HTMLElement>("li.has-children").forEach((li) => {
    const parent = li.querySelector<HTMLElement>(":scope > .sidebar-nav-link")
    if (parent && li.querySelector(".child-link.active")) parent.classList.add("parent-active")
  })
})

// ============================================================
// SIDEBAR NAV — mobile collapse toggle
// Desktop always shows the full list (see custom.scss — the button
// is display:none there); on mobile it starts collapsed and expands
// as an accordion under the title/icon row.
// ============================================================
document.addEventListener("nav", () => {
  const nav = document.querySelector<HTMLElement>(".sidebar-nav")
  const toggle = nav?.querySelector<HTMLButtonElement>(".sidebar-nav-toggle")
  if (!nav || !toggle) return

  const setOpen = (open: boolean) => {
    nav.classList.toggle("nav-open", open)
    toggle.setAttribute("aria-expanded", String(open))
  }

  const onToggleClick = () => setOpen(!nav.classList.contains("nav-open"))
  toggle.addEventListener("click", onToggleClick)

  // Collapse immediately on link click so the (persisted) nav arrives
  // at the next page already closed, instead of staying open through
  // the SPA transition.
  const onNavClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest(".sidebar-nav-link")) setOpen(false)
  }
  nav.addEventListener("click", onNavClick)

  // Resizing past the mobile breakpoint (e.g. rotating a tablet)
  // shouldn't leave it stuck mid-accordion once desktop always-show
  // styles take over.
  const mobileQuery = window.matchMedia("(max-width: 800px)")
  const onBreakpointChange = () => {
    if (!mobileQuery.matches) setOpen(false)
  }
  mobileQuery.addEventListener("change", onBreakpointChange)

  window.addCleanup(() => {
    toggle.removeEventListener("click", onToggleClick)
    nav.removeEventListener("click", onNavClick)
    mobileQuery.removeEventListener("change", onBreakpointChange)
  })
})

// ============================================================
// READING PROGRESS BAR
// ============================================================
document.addEventListener("nav", () => {
  let bar = document.getElementById("reading-progress") as HTMLDivElement | null
  if (!bar) {
    bar = document.createElement("div")
    bar.id = "reading-progress"
    document.body.appendChild(bar)
  }
  const barEl = bar
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight
    barEl.style.width = h > 0 ? (window.scrollY / h) * 100 + "%" : "0%"
  }
  window.addEventListener("scroll", update, { passive: true })
  window.addCleanup(() => window.removeEventListener("scroll", update))
  update()
})

// ============================================================
// PAGE FADE-IN
// ============================================================
document.addEventListener("nav", () => {
  const center = document.querySelector(".center") as HTMLElement | null
  if (!center) return
  center.animate(
    [
      { opacity: "0", transform: "translateY(8px)" },
      { opacity: "1", transform: "translateY(0)" },
    ],
    { duration: 300, easing: "ease", fill: "forwards" },
  )
})

// ============================================================
// TYPEWRITER HERO SUBTITLE
// ============================================================
document.addEventListener("nav", () => {
  const timeoutIds: number[] = []
  document.querySelectorAll<HTMLElement>(".hero-sub[data-typewriter]").forEach((el) => {
    const text = el.getAttribute("data-typewriter") || ""
    el.textContent = ""
    let i = 0
    const type = () => {
      if (i < text.length) {
        el.textContent = text.slice(0, ++i)
        timeoutIds.push(window.setTimeout(type, 26))
      }
    }
    timeoutIds.push(window.setTimeout(type, 600))
  })
  window.addCleanup(() => timeoutIds.forEach(clearTimeout))
})

// ============================================================
// PAGE-SPECIFIC INJECTIONS
// These all run synchronously on the nav event so their DOM
// mutations are visible to the count-up / reveals handlers
// registered below.
// ============================================================

// --- INVESTMENT MANDATE: Allocation Bars ---
document.addEventListener("nav", () => {
  if (document.body.getAttribute("data-slug") !== "investment-mandate") return
  if (document.querySelector(".alloc-item")) return

  const article = document.querySelector("article")
  if (!article) return

  // Find the h2 for the "Niche" section
  let nicheH2: Element | null = null
  article.querySelectorAll("h2").forEach((h) => {
    if (!nicheH2 && h.textContent?.includes("Niche")) nicheH2 = h
  })
  if (!nicheH2) return

  // Find the ul that immediately follows (skip paragraphs)
  let target: Element | null = (nicheH2 as Element).nextElementSibling
  let insertAfter: Element | null = null
  while (target) {
    if (target.tagName === "UL") {
      insertAfter = target
      break
    }
    if (target.tagName === "H2") break
    target = target.nextElementSibling
  }
  if (!insertAfter) return

  const alloc = [
    {
      name: "AI Infrastructure & Energy",
      range: "60–70%",
      barW: "65",
      note: "Compute, memory, networking, and the power that feeds them.",
    },
    {
      name: "Global Macro",
      range: "20–30%",
      barW: "25",
      note: "Rates, FX, and country exposure — usually via liquid ETFs.",
    },
    {
      name: "Opportunistic",
      range: "~10%",
      barW: "10",
      note: "Special situations and high-conviction one-offs.",
    },
  ]

  const wrapper = document.createElement("div")
  wrapper.innerHTML = alloc
    .map(
      (a) => `
    <div class="alloc-item" data-reveal>
      <div class="alloc-header">
        <span class="alloc-name">${a.name}</span>
        <span class="alloc-range">${a.range}</span>
      </div>
      <div class="alloc-track">
        <div class="alloc-fill" data-bar-w="${a.barW}%"></div>
      </div>
      <span class="alloc-note">${a.note}</span>
    </div>
  `,
    )
    .join("")

  // Unwrap and insert each child after the target ul
  let ref: Element = insertAfter
  Array.from(wrapper.children).forEach((child) => {
    ref.after(child)
    ref = child
  })

  window.addCleanup(() => {
    document.querySelectorAll(".alloc-item").forEach((el) => el.remove())
  })
})

// --- TRADE MEMO: Ticker header ---
// Titles on individual trade pages follow "Type: TICKER"
// (e.g. "Pre-Trade Memo: SKHY"). Split that into a big ticker
// headline with a small type subheader underneath.
document.addEventListener("nav", () => {
  const slug = document.body.getAttribute("data-slug") ?? ""
  if (!slug.startsWith("portfolio/trades/") || slug === "portfolio/trades/index") return
  if (document.querySelector(".trade-type-subheader")) return

  const h1 = document.querySelector("h1.article-title") as HTMLElement | null
  if (!h1) return

  const fullTitle = h1.textContent?.trim() ?? ""
  const colonIndex = fullTitle.indexOf(":")
  if (colonIndex === -1) return

  const type = fullTitle.slice(0, colonIndex).trim()
  const ticker = fullTitle.slice(colonIndex + 1).trim()
  if (!type || !ticker) return

  h1.textContent = ticker

  const sub = document.createElement("div")
  sub.className = "trade-type-subheader"
  sub.textContent = type
  h1.after(sub)

  window.addCleanup(() => {
    h1.textContent = fullTitle
    sub.remove()
  })
})

// --- TRADE LOG: Position list ---
// Reads the same data the default folder listing already has
// (title, date, tags) and re-renders it ticker-first. Unlike the
// research list / journal timeline, this isn't hardcoded — new
// trade pages show up automatically as long as their title follows
// "Type: TICKER".
document.addEventListener("nav", () => {
  if (document.body.getAttribute("data-slug") !== "portfolio/trades/index") return
  if (document.querySelector(".trade-list")) return

  const article = document.querySelector("article")
  const defaultListing = document.querySelector(".page-listing")
  if (!article || !defaultListing) return

  const entries = Array.from(defaultListing.querySelectorAll<HTMLLIElement>(".section-li"))
    .map((li) => {
      const link = li.querySelector<HTMLAnchorElement>(".desc h3 a")
      if (!link) return null

      const fullTitle = link.textContent?.trim() ?? ""
      const colonIndex = fullTitle.indexOf(":")
      const type = colonIndex === -1 ? null : fullTitle.slice(0, colonIndex).trim()
      const ticker = colonIndex === -1 ? fullTitle : fullTitle.slice(colonIndex + 1).trim()

      return {
        href: link.getAttribute("href") ?? "#",
        ticker,
        type,
        date: li.querySelector("time")?.textContent?.trim() ?? "",
        tags: Array.from(li.querySelectorAll<HTMLAnchorElement>(".tags .tag-link")).map(
          (t) => t.textContent?.trim() ?? "",
        ),
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  if (entries.length === 0) return

  const list = document.createElement("div")
  list.className = "trade-list"
  list.innerHTML = entries
    .map(
      (e) => `
    <a href="${e.href}" class="trade-item" data-reveal>
      <div class="trade-item-top">
        <span class="trade-item-ticker">${e.ticker}</span>
        ${e.type ? `<span class="trade-item-type">${e.type}</span>` : ""}
        <span class="trade-item-date">${e.date}</span>
      </div>
      <div class="trade-item-tags">${e.tags.map((t) => `<span class="trade-item-tag">${t}</span>`).join("")}</div>
    </a>
  `,
    )
    .join("")

  article.appendChild(list)
  window.addCleanup(() => list.remove())
})

// --- RESEARCH: List ---
document.addEventListener("nav", () => {
  const slug = document.body.getAttribute("data-slug")
  if (slug !== "portfolio/research" && slug !== "portfolio/research/index") return
  if (document.querySelector(".research-list")) return

  const article = document.querySelector("article")
  if (!article) return

  const items = [
    {
      title: "Four Months, Two Markets: May to August 2026",
      date: "Aug 2026",
      tags: ["Macro", "Memory", "Semiconductors"],
      excerpt:
        "Two markets levered to the same memory cycle moved in opposite directions the same week — record earnings that missed consensus, a Fed hold under its most one-directional dissent in years, and two landmark IPOs funding the next leg of HBM supply.",
      href: "/portfolio/research/four-months-two-markets",
    },
    {
      title: "Map of the AI Compute Stack",
      date: "Jun 2026",
      tags: ["AI Infra", "Semiconductors", "Thesis"],
      excerpt:
        "From purified sand to model inference — a layer-by-layer breakdown of who controls each choke point, what variable decides the margin, and where the blast radius lands in adjacent industries.",
      href: "/portfolio/research/ai-compute-stack",
    },
  ]

  const list = document.createElement("div")
  list.className = "research-list"
  list.innerHTML = items
    .map(
      (r) => `
    <a href="${r.href}" class="research-item" data-reveal style="text-decoration:none;display:block">
      <span class="research-date">${r.date}</span>
      <span class="research-title">${r.title}</span>
      <div class="research-tags">${r.tags.map((t) => `<span class="research-tag">${t}</span>`).join("")}</div>
      <span class="research-excerpt">${r.excerpt}</span>
    </a>
  `,
    )
    .join("")

  article.appendChild(list)
  window.addCleanup(() => list.remove())
})

// --- JOURNAL: Timeline ---
document.addEventListener("nav", () => {
  const journalSlug = document.body.getAttribute("data-slug")
  if (journalSlug !== "portfolio/journal" && journalSlug !== "portfolio/journal/index") return
  if (document.querySelector(".journal-timeline")) return

  const article = document.querySelector("article")
  if (!article) return

  const entries = [
    {
      date: "Apr 2026",
      title: "Sonsu Research is founded",
      text: "The project takes shape — a public record of learning to allocate capital with discipline, documented from day one.",
      href: "/portfolio/journal/founding",
    },
    {
      date: "May 2026",
      title: "Investment mandate established",
      text: "The rules of the book are written down — what I trade, why, and the constraints I commit to before putting capital at risk.",
      href: "/portfolio/journal/mandate",
    },
    {
      date: "Jun 2026",
      title: "Funded with $1,500",
      text: "Personal capital deployed. The account is live and the process begins in earnest.",
      href: "/portfolio/journal/funded",
    },
  ]

  const timeline = document.createElement("div")
  timeline.className = "journal-timeline"
  timeline.innerHTML = entries
    .map(
      (e) => `
    <a href="${e.href}" class="timeline-entry" data-reveal>
      <span class="entry-date">${e.date}</span>
      <span class="entry-title">${e.title}</span>
      <span class="entry-text">${e.text}</span>
    </a>
  `,
    )
    .join("")

  article.appendChild(timeline)
  window.addCleanup(() => timeline.remove())
})

// ============================================================
// COUNT-UP STAT NUMBERS
// Runs AFTER injections so it picks up all [data-val] elements
// including those just added to the DOM above.
// ============================================================
document.addEventListener("nav", () => {
  const rafIds: number[] = []
  const scope = document.querySelector(".center") || document.body

  scope.querySelectorAll<HTMLElement>("[data-val]").forEach((el) => {
    const val = parseFloat(el.getAttribute("data-val") ?? "0") || 0
    const dec = parseInt(el.getAttribute("data-dec") ?? "0") || 0
    const pre = el.getAttribute("data-pre") || ""
    const suf = el.getAttribute("data-suf") || ""
    const fmt = (n: number) => pre + (dec ? n.toFixed(dec) : Math.round(n).toLocaleString()) + suf
    let start: number | null = null
    const tick = (ts: number) => {
      if (!start) start = ts
      const k = Math.min((ts - start) / 1300, 1)
      el.textContent = fmt(val * (1 - Math.pow(1 - k, 3)))
      if (k < 1) rafIds.push(requestAnimationFrame(tick))
    }
    rafIds.push(requestAnimationFrame(tick))
  })

  window.addCleanup(() => rafIds.forEach(cancelAnimationFrame))
})

// ============================================================
// ANIMATED ALLOCATION / PROGRESS BARS
// Runs AFTER injections so it picks up all [data-bar-w] elements.
// ============================================================
document.addEventListener("nav", () => {
  const timeoutIds: number[] = []
  document.querySelectorAll<HTMLElement>("[data-bar-w]").forEach((el) => {
    el.style.width = "0%"
    const target = el.getAttribute("data-bar-w") || "0%"
    timeoutIds.push(
      window.setTimeout(() => {
        el.style.transition = "width 1.1s cubic-bezier(0.6, 0, 0.2, 1)"
        el.style.width = target
      }, 250),
    )
  })
  window.addCleanup(() => timeoutIds.forEach(clearTimeout))
})

// ============================================================
// EQUITY CURVE SVG — ANIMATED STROKE DRAW
// Runs AFTER injection so it finds the injected [data-draw] path.
// ============================================================
document.addEventListener("nav", () => {
  const timeoutIds: number[] = []
  document.querySelectorAll<SVGPathElement>("[data-draw]").forEach((path) => {
    const length = path.getTotalLength()
    path.style.strokeDasharray = String(length)
    path.style.strokeDashoffset = String(length)
    timeoutIds.push(
      window.setTimeout(() => {
        path.style.transition = "stroke-dashoffset 2.4s 0.3s cubic-bezier(0.6, 0, 0.2, 1)"
        path.style.strokeDashoffset = "0"
      }, 50),
    )
  })
  window.addCleanup(() => timeoutIds.forEach(clearTimeout))
})

// ============================================================
// SCROLL-TRIGGERED REVEALS
// Runs AFTER injections so [data-reveal] in injected content is found.
// ============================================================
document.addEventListener("nav", () => {
  const article = document.querySelector("article")
  if (!article) return

  const explicit = Array.from(article.querySelectorAll<HTMLElement>("[data-reveal]"))
  const auto = Array.from(
    article.querySelectorAll<HTMLElement>("h2, h3, blockquote, .table-container, figure"),
  )
  const targets = [...new Set([...explicit, ...auto])]

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          ;(en.target as HTMLElement).classList.add("revealed")
          observer.unobserve(en.target)
        }
      })
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
  )

  targets.forEach((el) => {
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.classList.add("reveal-target")
      observer.observe(el)
    }
  })

  window.addCleanup(() => observer.disconnect())
})

// ============================================================
// ACTIVE TOC INDICATOR
// ============================================================
document.addEventListener("nav", () => {
  const tocLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("ul.toc-content > li > a"),
  )
  if (!tocLinks.length) return

  const headings = tocLinks
    .map((a) => {
      const id = a.getAttribute("href")?.replace("#", "")
      return id ? document.getElementById(id) : null
    })
    .filter(Boolean) as HTMLElement[]

  const observer = new IntersectionObserver(
    () => {
      let active: HTMLElement | null = null
      for (const h of headings) {
        if (h.getBoundingClientRect().top < window.innerHeight * 0.4) active = h
      }
      tocLinks.forEach((a) => {
        const id = a.getAttribute("href")?.replace("#", "")
        a.classList.toggle("in-view", !!active && active.id === id)
      })
    },
    { threshold: 0 },
  )

  headings.forEach((h) => observer.observe(h))
  window.addCleanup(() => observer.disconnect())
})

// ============================================================
// PORTFOLIO DASHBOARD (homepage)
// Fetches /static/portfolio-data.json (refreshed by a scheduled
// GitHub Action pulling an IBKR Flex Query) and renders stat
// tiles, an equity-curve chart with a crosshair tooltip, an open
// positions table, and narrative insights.
// ============================================================
interface PdPosition {
  symbol: string
  name: string
  opened: string
  days_held: number
  qty: number
  avg_cost: number
  price: number
  market_value: number
  weight_pct: number
  unrealized_pnl: number
  unrealized_pct: number
  daily_pnl: number
}

interface PdData {
  as_of: string
  inception_date: string
  base_currency: string
  account: {
    starting_capital: number
    net_liquidation: number
    total_return_pct: number
    cash: number
    invested: number
    cash_pct: number
    invested_pct: number
    unrealized_pnl: number
    realized_pnl: number
  }
  equity_curve: { date: string; nav: number }[]
  positions: PdPosition[]
  insights: string[]
}

function pdFormatUSD(n: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? "+" : n < 0 ? "-" : ""
  const abs = Math.abs(n)
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function pdFormatPct(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : ""
  return `${sign}${Math.abs(n).toFixed(2)}%`
}

function pdFormatUpdated(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffH = diffMs / 3_600_000
  if (diffH < 1) return `${Math.max(1, Math.round(diffMs / 60_000))}m ago`
  if (diffH < 24) return `${Math.round(diffH)}h ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function pdFormatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function pdRenderTable(mount: HTMLElement, positions: PdPosition[]) {
  const tbody = mount.querySelector("tbody")
  if (!tbody) return

  positions
    .slice()
    .sort((a, b) => b.market_value - a.market_value)
    .forEach((p) => {
      const tr = document.createElement("tr")

      const symTd = document.createElement("td")
      symTd.className = "pd-td-symbol"
      const symEl = document.createElement("span")
      symEl.className = "pd-symbol"
      symEl.textContent = p.symbol
      const nameEl = document.createElement("span")
      nameEl.className = "pd-symbol-name"
      nameEl.textContent = p.name
      symTd.append(symEl, nameEl)

      const heldTd = document.createElement("td")
      heldTd.textContent = `${p.days_held}d`

      const weightTd = document.createElement("td")
      weightTd.textContent = `${p.weight_pct.toFixed(1)}%`

      const avgTd = document.createElement("td")
      avgTd.textContent = pdFormatUSD(p.avg_cost)

      const priceTd = document.createElement("td")
      priceTd.textContent = pdFormatUSD(p.price)

      const uTd = document.createElement("td")
      uTd.className = p.unrealized_pnl >= 0 ? "pd-gain" : "pd-loss"
      const arrow = p.unrealized_pnl >= 0 ? "▲" : "▼"
      const amtEl = document.createElement("span")
      amtEl.className = "pd-u-amt"
      amtEl.textContent = `${arrow} ${pdFormatUSD(p.unrealized_pnl, { sign: true })}`
      const pctEl = document.createElement("span")
      pctEl.className = "pd-u-pct"
      pctEl.textContent = pdFormatPct(p.unrealized_pct)
      uTd.append(amtEl, pctEl)

      tr.append(symTd, heldTd, weightTd, avgTd, priceTd, uTd)
      tbody.appendChild(tr)
    })
}

function pdRenderInsights(mount: HTMLElement, insights: string[]) {
  const list = mount.querySelector(".pd-insights-list")
  if (!list) return
  insights.forEach((text) => {
    const li = document.createElement("li")
    li.textContent = text
    list.appendChild(li)
  })
}

function pdRenderChart(mount: HTMLElement, curve: { date: string; nav: number }[]) {
  const svg = mount.querySelector<SVGSVGElement>(".pd-chart-svg")
  const wrap = mount.querySelector<HTMLElement>(".pd-chart-wrap")
  const crosshair = mount.querySelector<HTMLElement>(".pd-crosshair")
  const tooltip = mount.querySelector<HTMLElement>(".pd-chart-tooltip")
  const tooltipDate = mount.querySelector<HTMLElement>(".pd-tooltip-date")
  const tooltipValue = mount.querySelector<HTMLElement>(".pd-tooltip-value")
  if (!svg || !wrap || !crosshair || !tooltip || !tooltipDate || !tooltipValue) return
  if (curve.length < 2) return

  const W = 760
  const H = 200
  const padL = 8
  const padR = 8
  const padT = 16
  const padB = 8

  const values = curve.map((p) => p.nav)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const start = values[0]

  const xAt = (i: number) => padL + (i / (curve.length - 1)) * (W - padL - padR)
  const yAt = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB)

  const linePath = curve
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)},${yAt(p.nav).toFixed(2)}`)
    .join(" ")

  const ns = "http://www.w3.org/2000/svg"
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
  while (svg.firstChild) svg.removeChild(svg.firstChild)

  const baseline = document.createElementNS(ns, "line")
  baseline.setAttribute("x1", String(padL))
  baseline.setAttribute("x2", String(W - padR))
  baseline.setAttribute("y1", String(yAt(start)))
  baseline.setAttribute("y2", String(yAt(start)))
  baseline.setAttribute("class", "pd-chart-baseline")

  const path = document.createElementNS(ns, "path")
  path.setAttribute("d", linePath)
  path.setAttribute("class", "pd-chart-line")

  const endGain = values[values.length - 1] >= start
  const endCx = xAt(curve.length - 1)
  const endCy = yAt(values[values.length - 1])

  const endRing = document.createElementNS(ns, "circle")
  endRing.setAttribute("cx", String(endCx))
  endRing.setAttribute("cy", String(endCy))
  endRing.setAttribute("r", "6")
  endRing.setAttribute("class", "pd-chart-end-ring")

  const endDot = document.createElementNS(ns, "circle")
  endDot.setAttribute("cx", String(endCx))
  endDot.setAttribute("cy", String(endCy))
  endDot.setAttribute("r", "4")
  endDot.setAttribute("class", `pd-chart-end-dot ${endGain ? "pd-gain-fill" : "pd-loss-fill"}`)

  svg.append(baseline, path, endRing, endDot)

  const onMove = (e: PointerEvent) => {
    const rect = wrap.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    let idx = Math.round(((relX - padL) / (W - padL - padR)) * (curve.length - 1))
    idx = Math.max(0, Math.min(curve.length - 1, idx))

    const leftPct = (xAt(idx) / W) * 100
    const topPct = (yAt(curve[idx].nav) / H) * 100

    crosshair.style.left = `${leftPct}%`
    crosshair.hidden = false
    tooltip.hidden = false
    tooltip.style.left = `${leftPct}%`
    tooltip.style.top = `${topPct}%`
    tooltipDate.textContent = pdFormatShortDate(curve[idx].date)
    tooltipValue.textContent = pdFormatUSD(curve[idx].nav)
  }
  const onLeave = () => {
    crosshair.hidden = true
    tooltip.hidden = true
  }

  wrap.addEventListener("pointermove", onMove)
  wrap.addEventListener("pointerleave", onLeave)
  window.addCleanup(() => {
    wrap.removeEventListener("pointermove", onMove)
    wrap.removeEventListener("pointerleave", onLeave)
  })
}

function pdRender(mount: HTMLElement, data: PdData) {
  const a = data.account
  const totalGain = a.net_liquidation >= a.starting_capital
  const unrealizedGain = a.unrealized_pnl >= 0

  mount.innerHTML = `
    <div class="pd-topline">
      <span class="pd-topline-label"><span class="pd-pulse-dot"></span>Portfolio Snapshot</span>
      <span class="pd-updated">Updated ${pdFormatUpdated(data.as_of)}</span>
    </div>
    <div class="pd-stats">
      <div class="pd-stat">
        <span class="pd-stat-label">Net liquidation</span>
        <span class="pd-stat-value">${pdFormatUSD(a.net_liquidation)}</span>
      </div>
      <div class="pd-stat">
        <span class="pd-stat-label">Total return</span>
        <span class="pd-stat-value ${totalGain ? "pd-gain" : "pd-loss"}">${pdFormatPct(a.total_return_pct)}</span>
        <span class="pd-stat-sub">since ${pdFormatShortDate(data.inception_date)} &middot; $${a.starting_capital.toLocaleString("en-US")} start</span>
      </div>
      <div class="pd-stat">
        <span class="pd-stat-label">Unrealized P&amp;L</span>
        <span class="pd-stat-value ${unrealizedGain ? "pd-gain" : "pd-loss"}">${pdFormatUSD(a.unrealized_pnl, { sign: true })}</span>
        <span class="pd-stat-sub">realized ${pdFormatUSD(a.realized_pnl, { sign: true })}</span>
      </div>
      <div class="pd-stat">
        <span class="pd-stat-label">Cash / invested</span>
        <span class="pd-stat-value">${a.cash_pct.toFixed(0)}% / ${a.invested_pct.toFixed(0)}%</span>
        <div class="pd-alloc-bar"><span class="pd-alloc-invested" style="width:${a.invested_pct}%"></span></div>
      </div>
    </div>
    <div class="pd-card pd-chart-card">
      <div class="pd-card-head"><span class="pd-card-title">Equity curve &middot; since inception</span></div>
      <div class="pd-chart-wrap">
        <svg class="pd-chart-svg"></svg>
        <div class="pd-crosshair" hidden></div>
        <div class="pd-chart-tooltip" hidden>
          <span class="pd-tooltip-date"></span>
          <span class="pd-tooltip-value"></span>
        </div>
      </div>
    </div>
    <div class="pd-grid">
      <div class="pd-card pd-positions-card">
        <div class="pd-card-head"><span class="pd-card-title">Open positions</span></div>
        <div class="pd-table-wrap">
          <table class="pd-table">
            <thead>
              <tr><th>Symbol</th><th>Held</th><th>Weight</th><th>Avg cost</th><th>Price</th><th>Unrealized</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div class="pd-card pd-insights-card">
        <div class="pd-card-head"><span class="pd-card-title">Notes</span></div>
        <ul class="pd-insights-list"></ul>
      </div>
    </div>
  `

  pdRenderTable(mount, data.positions)
  pdRenderInsights(mount, data.insights)
  pdRenderChart(mount, data.equity_curve)
}

document.addEventListener("nav", () => {
  if (document.body.getAttribute("data-slug") !== "index") return
  const mount = document.querySelector<HTMLElement>("#portfolio-dashboard")
  if (!mount) return

  let cancelled = false
  window.addCleanup(() => {
    cancelled = true
  })

  fetch("/static/portfolio-data.json", { cache: "no-store" })
    .then((r) => r.json())
    .then((data: PdData) => {
      if (cancelled) return
      pdRender(mount, data)
    })
    .catch(() => {
      if (cancelled) return
      const err = document.createElement("div")
      err.className = "pd-error"
      err.textContent = "Portfolio data is unavailable right now."
      mount.appendChild(err)
    })
})
