import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const NotFound: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  // If baseUrl contains a pathname after the domain, use this as the home link
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname

  return (
    <article class="popover-hint">
      <p class="error-eyebrow">404</p>
      <h1>Position Closed</h1>
      <p>This page doesn't exist — or the position has been closed.</p>
      <a href={baseDir}>← Return to Sonsu Capital</a>
    </article>
  )
}

export default (() => NotFound) satisfies QuartzComponentConstructor
