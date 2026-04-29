import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface SidebarNavLink {
  label: string
  href: string
  external?: boolean
  children?: SidebarNavLink[]
}

interface SidebarNavOptions {
  links: SidebarNavLink[]
}

export default ((opts: SidebarNavOptions) => {
  const SidebarNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const currentSlug = fileData.slug ?? ""

    const isActive = (href: string) => {
      const slug = href.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").replace(/\/$/, "") || "index"
      return currentSlug === slug
    }

    const isParentActive = (link: SidebarNavLink) =>
      link.children?.some((child) => isActive(child.href)) || isActive(link.href)

    const renderLink = (link: SidebarNavLink) => (
      <li class={link.children ? "has-children" : ""}>
        <a
          href={link.href}
          class={`sidebar-nav-link${isActive(link.href) ? " active" : ""}${isParentActive(link) && link.children ? " parent-active" : ""}`}
          {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {link.label}
        </a>
        {link.children && (
          <ul class="sidebar-nav-children">
            {link.children.map((child) => (
              <li>
                <a
                  href={child.href}
                  class={`sidebar-nav-link child-link${isActive(child.href) ? " active" : ""}`}
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
        <ul>{opts.links.map(renderLink)}</ul>
      </nav>
    )
  }

  return SidebarNav
}) satisfies QuartzComponentConstructor
