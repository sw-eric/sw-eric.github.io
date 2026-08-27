import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface SidebarNavLink {
  label: string
  href?: string
  external?: boolean
  children?: SidebarNavLink[]
}

interface SidebarNavOptions {
  links: SidebarNavLink[]
}

export default ((opts: SidebarNavOptions) => {
  // Active state is set client-side (see customScripts.inline.ts) so that
  // every page produces identical sidebar HTML — prevents Quartz's SPA morph
  // algorithm from reordering items when classes differ between pages.
  const SidebarNav: QuartzComponent = (_props: QuartzComponentProps) => {
    const renderLink = (link: SidebarNavLink) => (
      <li class={link.children ? "has-children" : ""}>
        {link.href ? (
          <a
            href={link.href}
            class="sidebar-nav-link"
            {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {link.label}
          </a>
        ) : (
          <span class="sidebar-nav-link sidebar-nav-section">{link.label}</span>
        )}
        {link.children && (
          <ul class="sidebar-nav-children">
            {link.children.map((child) => (
              <li>
                <a
                  href={child.href}
                  class="sidebar-nav-link child-link"
                  {...(child.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {child.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </li>
    )

    return (
      <nav class="sidebar-nav">
        {/* Mobile-only: collapses the list below into an accordion.
            Hidden entirely on desktop via CSS (see custom.scss). */}
        <button
          type="button"
          class="sidebar-nav-toggle"
          aria-expanded="false"
          aria-controls="sidebar-nav-list"
        >
          <span class="sidebar-nav-toggle-label">Menu</span>
          <span class="sidebar-nav-toggle-icon" aria-hidden="true">
            <span></span>
          </span>
        </button>
        <ul id="sidebar-nav-list">{opts.links.map(renderLink)}</ul>
      </nav>
    )
  }

  return SidebarNav
}) satisfies QuartzComponentConstructor<SidebarNavOptions>
