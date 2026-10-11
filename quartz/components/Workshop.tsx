import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import workshopInline from "./scripts/workshop.inline"

// Renders nothing; ships the client script for the Workshop widget mounts
// (#yield-curve-explorer, #options-pricer).
const Workshop: QuartzComponent = () => {
  return <></>
}

Workshop.afterDOMLoaded = workshopInline

export default (() => Workshop) satisfies QuartzComponentConstructor
