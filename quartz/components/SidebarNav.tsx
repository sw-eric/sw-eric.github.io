import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface SidebarNavLink {
  label: string
  href: string
}

interface SidebarNavOptions {
  links: SidebarNavLink[]
}

export default ((opts: SidebarNavOptions) => {
  const SidebarNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const currentSlug = fileData.slug ?? ""

    return (
      <nav class="sidebar-nav">
        <ul>
          {opts.links.map(({ label, href }) => {
            // Normalise href to a slug for active matching (strip leading ./ or /)
            const hrefSlug = href.replace(/^\.?\//, "").replace(/\/$/, "") || "index"
            const isActive = currentSlug === hrefSlug
            return (
              <li>
                <a href={href} class={isActive ? "sidebar-nav-link active" : "sidebar-nav-link"}>
                  {label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }

  return SidebarNav
}) satisfies QuartzComponentConstructor
