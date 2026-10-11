import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import marketDeskInline from "./scripts/marketDesk.inline"

// Renders nothing; ships the client script that fills #market-desk on /desk.
const MarketDesk: QuartzComponent = () => {
  return <></>
}

MarketDesk.afterDOMLoaded = marketDeskInline

export default (() => MarketDesk) satisfies QuartzComponentConstructor
