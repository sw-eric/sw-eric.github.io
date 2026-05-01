import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// Top-level pages that need no breadcrumbs at all
const isStandalone = (slug: string) =>
  slug === "index" ||
  slug === "about" ||
  slug === "disclaimer" ||
  slug === "investment-mandate" ||
  slug === "portfolio" ||
  slug === "portfolio/index"

// Pages whose breadcrumbs should start from their section root, not Home
const isRootless = (slug: string) => slug.startsWith("portfolio/")

const sidebarNav = Component.SidebarNav({
  links: [
    { label: "Home", href: "/" },
    { label: "Investment Mandate", href: "/investment-mandate" },
    {
      label: "Portfolio",
      href: "/portfolio",
      children: [
        { label: "Trade Log", href: "/portfolio/trades" },
        { label: "Research", href: "/portfolio/research" },
        { label: "Journal", href: "/portfolio/journal" },
        { label: "Live Dashboard", href: "https://sonsu-research.streamlit.app", external: true },
      ],
    },
    { label: "About", href: "/about" },
    { label: "Disclaimer", href: "/disclaimer" },
  ],
})

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [Component.CustomScripts()],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/sw-eric/sw-eric.github.io",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => {
        const slug = page.fileData.slug ?? ""
        return !isStandalone(slug) && !isRootless(slug)
      },
    }),
    Component.ConditionalRender({
      component: Component.Breadcrumbs({ showRoot: false }),
      condition: (page) => isRootless(page.fileData.slug ?? ""),
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    sidebarNav,
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => {
        const slug = page.fileData.slug ?? ""
        return !isStandalone(slug) && !isRootless(slug)
      },
    }),
    Component.ConditionalRender({
      component: Component.Breadcrumbs({ showRoot: false }),
      condition: (page) => isRootless(page.fileData.slug ?? ""),
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    sidebarNav,
  ],
  right: [],
}
