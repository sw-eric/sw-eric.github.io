import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const PageTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const baseDir = pathToRoot(fileData.slug!)
  return (
    <div class={classNames(displayClass, "page-title")}>
      <a href={baseDir}>
        <span class="page-title-monogram">S</span>
        <span class="page-title-text">
          <span class="page-title-name">Sonsu Research</span>
          <span class="page-title-sub">Trading Journal</span>
        </span>
      </a>
    </div>
  )
}

PageTitle.css = `
.page-title a {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}
.page-title-monogram {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  border: 1px solid var(--secondary);
  color: var(--secondary);
  font-family: var(--headerFont);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
}
.page-title-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  line-height: 1;
}
.page-title-name {
  font-family: var(--headerFont);
  font-size: 22px;
  font-weight: 600;
  color: var(--dark);
}
.page-title-sub {
  font-family: var(--codeFont);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gray);
  font-weight: 400;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
