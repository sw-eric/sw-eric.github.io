// ============================================================
// SIDEBAR NAV — active state (client-side to keep all pages'
// HTML identical, preventing Quartz SPA morph reordering)
// ============================================================
document.addEventListener("nav", () => {
  const currentSlug =
    window.location.pathname.replace(/^\//, "").replace(/\/$/, "") || "index"
  const toSlug = (href: string) =>
    href.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").replace(/\/$/, "") || "index"

  document.querySelectorAll<HTMLAnchorElement>(".sidebar-nav-link").forEach((a) => {
    a.classList.remove("active", "parent-active")
  })
  document.querySelectorAll<HTMLAnchorElement>(".sidebar-nav-link").forEach((a) => {
    const href = a.getAttribute("href") ?? ""
    if (/^https?:\/\//.test(href)) return  // never mark external links active
    if (toSlug(href) === currentSlug) a.classList.add("active")
  })
  document.querySelectorAll<HTMLElement>("li.has-children").forEach((li) => {
    const parent = li.querySelector<HTMLElement>(":scope > .sidebar-nav-link")
    if (parent && li.querySelector(".child-link.active")) parent.classList.add("parent-active")
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
    [{ opacity: "0", transform: "translateY(8px)" }, { opacity: "1", transform: "translateY(0)" }],
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

// --- HOME: Portfolio Snapshot Card ---
document.addEventListener("nav", () => {
  if (document.body.getAttribute("data-slug") !== "index") return
  if (document.querySelector(".portfolio-snapshot")) return

  const dashEmbed = document.querySelector(".dashboard-embed")
  if (!dashEmbed) return

  const vals = [0,1.5,1,2.6,4,3.4,5.2,7,6.3,8.4,7.8,10.2,12,11.3,13.5,15.2,14.4,13.6,16.4,18.1,17.2,19.4,21,20.3,22.6,21.8,24.1,26]
  const W = 600, H = 200, n = vals.length, maxV = 28
  const X = (i: number) => ((i / (n - 1)) * W).toFixed(1)
  const Y = (v: number) => (188 - (v / maxV) * 168).toFixed(1)
  let lp = `M ${X(0)} ${Y(vals[0])}`
  for (let i = 1; i < n; i++) lp += ` L ${X(i)} ${Y(vals[i])}`
  const ap = lp + ` L ${W} ${H} L 0 ${H} Z`

  const card = document.createElement("div")
  card.className = "portfolio-snapshot"
  card.innerHTML = `
    <div class="snapshot-header">
      <span class="snapshot-label">Portfolio Snapshot</span>
      <span class="snapshot-live"><span class="live-dot"></span>Live soon</span>
    </div>
    <svg class="snapshot-curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ss-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--secondary)" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="var(--secondary)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${ap}" fill="url(#ss-fill)"/>
      <path d="${lp}" data-draw fill="none" stroke="var(--secondary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
    <div class="snapshot-stats">
      <div class="snapshot-stat">
        <span class="stat-value positive" data-val="18.4" data-dec="1" data-pre="+" data-suf="%">+18.4%</span>
        <span class="stat-label">Return · inception</span>
      </div>
      <div class="snapshot-stat">
        <span class="stat-value" data-val="27" data-dec="0">27</span>
        <span class="stat-label">Closed trades</span>
      </div>
      <div class="snapshot-stat">
        <span class="stat-value" data-val="63" data-dec="0" data-suf="%">63%</span>
        <span class="stat-label">Win rate</span>
      </div>
      <div class="snapshot-stat">
        <span class="stat-value" data-val="1500" data-dec="0" data-pre="$">$1,500</span>
        <span class="stat-label">Personal capital</span>
      </div>
    </div>
    <p class="snapshot-note">Illustrative figures. A live IBKR-linked dashboard connects here soon.</p>
  `
  dashEmbed.parentElement?.insertBefore(card, dashEmbed)
  window.addCleanup(() => card.remove())
})

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
    if (target.tagName === "UL") { insertAfter = target; break }
    if (target.tagName === "H2") break
    target = target.nextElementSibling
  }
  if (!insertAfter) return

  const alloc = [
    { name: "AI Infrastructure & Energy", range: "60–70%", barW: "65", note: "Compute, memory, networking, and the power that feeds them." },
    { name: "Global Macro",               range: "20–30%", barW: "25", note: "Rates, FX, and country exposure — usually via liquid ETFs." },
    { name: "Opportunistic",              range: "~10%",   barW: "10", note: "Special situations and high-conviction one-offs." },
  ]

  const wrapper = document.createElement("div")
  wrapper.innerHTML = alloc.map(a => `
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
  `).join("")

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

// --- TRADE LOG: Live data note ---
document.addEventListener("nav", () => {
  if (document.body.getAttribute("data-slug") !== "portfolio/trades") return
  if (document.querySelector(".trade-live-note")) return

  const article = document.querySelector("article")
  if (!article) return

  const container = document.createElement("div")
  container.className = "trade-live-note"
  container.innerHTML = `
    <p style="font-family:var(--bodyFont);font-size:1rem;line-height:1.7;color:var(--darkgray);max-width:620px;margin:0 0 1.5rem 0">
      Every position, dated and tagged to its thesis. Live trade data is pulled directly from IBKR via the dashboard below.
    </p>
    <div class="trade-ibkr-info" style="background:var(--card);border:1px solid var(--lightgray);border-radius:4px;padding:1.25rem 1.5rem;margin-bottom:2rem">
      <div style="font-family:var(--codeFont);font-size:0.625rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--gray);margin-bottom:0.75rem">How the trade log works</div>
      <p style="margin:0 0 0.75rem 0;font-size:0.9rem;line-height:1.6;color:var(--darkgray)">
        Trade data is sourced from IBKR via the <strong>Flex Web Service</strong>. The Sonsu Research Streamlit dashboard connects to your account and displays the full trade log with filtering by sector, status, and direction.
      </p>
      <p style="margin:0 0 1rem 0;font-size:0.9rem;line-height:1.6;color:var(--darkgray)">
        To add trades here in the future, export a <strong>Flex Query CSV</strong> from IBKR Account Management, commit it to <code>content/portfolio/trades.csv</code>, and this page will render it automatically.
      </p>
      <a href="https://sonsu-research.streamlit.app" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;font-family:var(--codeFont);font-size:0.75rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--secondary);text-decoration:none">
        Open live dashboard →
      </a>
    </div>
  `

  article.appendChild(container)
  window.addCleanup(() => container.remove())
})

// --- RESEARCH: List ---
document.addEventListener("nav", () => {
  if (document.body.getAttribute("data-slug") !== "portfolio/research") return
  if (document.querySelector(".research-list")) return

  const article = document.querySelector("article")
  if (!article) return

  const items = [
    {
      title: "Memory is the bottleneck, not compute",
      date: "Jun 2026",
      tags: ["AI Infra", "HBM", "Samsung"],
      excerpt: "HBM supply is the real constraint on AI scaling. A look at who captures the pricing power as memory becomes the gating resource.",
    },
    {
      title: "Power as a derivative on AI capex",
      date: "May 2026",
      tags: ["Energy", "IPPs", "Thesis"],
      excerpt: "Independent power producers are an indirect way to own data-center demand without paying the multiple on the chips themselves.",
    },
    {
      title: "The yen, the carry, and Asian tech",
      date: "Apr 2026",
      tags: ["Macro", "FX", "Japan"],
      excerpt: "How a normalizing BOJ reprices the carry trade — and what it means for the equities I hold across the region.",
    },
    {
      title: "Reading the semi-cycle in 2026",
      date: "Mar 2026",
      tags: ["AI Infra", "Cyclical"],
      excerpt: "Inventory, lead times, and capex guidance: a framework for timing exposure to the most reflexive part of the market.",
    },
  ]

  const list = document.createElement("div")
  list.className = "research-list"
  list.innerHTML = items.map(r => `
    <div class="research-item" data-reveal>
      <span class="research-date">${r.date}</span>
      <span class="research-title">${r.title}</span>
      <div class="research-tags">${r.tags.map(t => `<span class="research-tag">${t}</span>`).join("")}</div>
      <span class="research-excerpt">${r.excerpt}</span>
    </div>
  `).join("")

  article.appendChild(list)
  window.addCleanup(() => list.remove())
})

// --- JOURNAL: Timeline ---
document.addEventListener("nav", () => {
  if (document.body.getAttribute("data-slug") !== "portfolio/journal") return
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
      date: "Jun 2026",
      title: "Funded with $1,500",
      text: "Personal capital deployed. The account is live and the process begins in earnest.",
      href: "/portfolio/journal/funded",
    },
  ]

  const timeline = document.createElement("div")
  timeline.className = "journal-timeline"
  timeline.innerHTML = entries.map(e => `
    <a href="${e.href}" class="timeline-entry" data-reveal style="text-decoration:none;display:block">
      <span class="entry-date">${e.date}</span>
      <span class="entry-title">${e.title}</span>
      <span class="entry-text">${e.text}</span>
    </a>
  `).join("")

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
    const fmt = (n: number) =>
      pre + (dec ? n.toFixed(dec) : Math.round(n).toLocaleString()) + suf
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
    timeoutIds.push(window.setTimeout(() => {
      el.style.transition = "width 1.1s cubic-bezier(0.6, 0, 0.2, 1)"
      el.style.width = target
    }, 250))
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
    timeoutIds.push(window.setTimeout(() => {
      path.style.transition = "stroke-dashoffset 2.4s 0.3s cubic-bezier(0.6, 0, 0.2, 1)"
      path.style.strokeDashoffset = "0"
    }, 50))
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
  const auto = Array.from(article.querySelectorAll<HTMLElement>("h2, h3, blockquote, .table-container, figure"))
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

  const observer = new IntersectionObserver(() => {
    let active: HTMLElement | null = null
    for (const h of headings) {
      if (h.getBoundingClientRect().top < window.innerHeight * 0.4) active = h
    }
    tocLinks.forEach((a) => {
      const id = a.getAttribute("href")?.replace("#", "")
      a.classList.toggle("in-view", !!active && active.id === id)
    })
  }, { threshold: 0 })

  headings.forEach((h) => observer.observe(h))
  window.addCleanup(() => observer.disconnect())
})
