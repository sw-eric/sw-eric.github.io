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
