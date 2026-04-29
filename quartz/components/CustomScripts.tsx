import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import customScriptsInline from "./scripts/customScripts.inline"

const CustomScripts: QuartzComponent = () => {
  return <></>
}

CustomScripts.afterDOMLoaded = customScriptsInline

export default (() => CustomScripts) satisfies QuartzComponentConstructor
