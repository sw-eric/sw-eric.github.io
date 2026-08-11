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
      excerpt: "Two markets levered to the same memory cycle moved in opposite directions the same week — record earnings that missed consensus, a Fed hold under its most one-directional dissent in years, and two landmark IPOs funding the next leg of HBM supply.",
      href: "/portfolio/research/four-months-two-markets",
    },
    {
      title: "Map of the AI Compute Stack",
      date: "Jun 2026",
      tags: ["AI Infra", "Semiconductors", "Thesis"],
      excerpt: "From purified sand to model inference — a layer-by-layer breakdown of who controls each choke point, what variable decides the margin, and where the blast radius lands in adjacent industries.",
      href: "/portfolio/research/ai-compute-stack",
    },
  ]

  const list = document.createElement("div")
  list.className = "research-list"
  list.innerHTML = items.map(r => `
    <a href="${r.href}" class="research-item" data-reveal style="text-decoration:none;display:block">
      <span class="research-date">${r.date}</span>
      <span class="research-title">${r.title}</span>
      <div class="research-tags">${r.tags.map(t => `<span class="research-tag">${t}</span>`).join("")}</div>
      <span class="research-excerpt">${r.excerpt}</span>
    </a>
  `).join("")

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
  timeline.innerHTML = entries.map(e => `
    <a href="${e.href}" class="timeline-entry" data-reveal>
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
