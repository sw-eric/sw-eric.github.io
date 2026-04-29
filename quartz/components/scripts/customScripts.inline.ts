// Feature 1: Reading progress bar
document.addEventListener("nav", () => {
  let bar = document.getElementById("reading-progress") as HTMLDivElement | null
  if (!bar) {
    bar = document.createElement("div")
    bar.id = "reading-progress"
    document.body.appendChild(bar)
  }

  const barEl = bar

  const update = () => {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
    barEl.style.width = pct + "%"
  }

  window.addEventListener("scroll", update, { passive: true })
  window.addCleanup(() => window.removeEventListener("scroll", update))
  update()
})

// Feature 2: Page fade-in on navigation
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

// Feature 3: Typewriter effect on hero-sub
// Cursor lives in CSS ::after so it is always visible — even on hard reload.
// JS only manipulates textContent, never innerHTML structure.
document.addEventListener("nav", () => {
  const targets = document.querySelectorAll<HTMLElement>(".hero-sub[data-typewriter]")
  const timeoutIds: number[] = []

  targets.forEach((el) => {
    const text = el.getAttribute("data-typewriter") || ""
    el.textContent = ""

    let i = 0
    const type = () => {
      if (i < text.length) {
        el.textContent = text.slice(0, ++i)
        const id = window.setTimeout(type, 28)
        timeoutIds.push(id)
      }
      // done — cursor keeps blinking via CSS ::after
    }

    const startId = window.setTimeout(type, 700)
    timeoutIds.push(startId)
  })

  window.addCleanup(() => timeoutIds.forEach((id) => window.clearTimeout(id)))
})

// Feature 10: Scroll-triggered section reveals
document.addEventListener("nav", () => {
  const article = document.querySelector("article")
  if (!article) return

  const targets = article.querySelectorAll<HTMLElement>("h2, h3, blockquote, .table-container, figure")

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed")
          observer.unobserve(entry.target)
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
