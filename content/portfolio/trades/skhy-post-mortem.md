---
title: "Post-Mortem: SKHY"
date: 2026-10-14
tags:
  - trades
  - post-mortem
  - SKHY
  - memory
  - semiconductors
---

*October 14, 2026*

*Written after exit.*

---

## Result

Sold 2 shares of SKHY at \$149.89 at 11:41 ET on October 14, 2026, through a good-till-cancelled trailing stop set 25% below the highest price since entry. Entry was \$170.74 on August 14. The realized loss is \$42.71 including commissions, or 12.2% on the position, over 61 days. At its high of \$199.87 on September 9 the position was up 17.1%, so the trade gave back all of that and then some.

The price path matters for what follows. SKHY rose to its high within four weeks of entry, then traded between roughly \$175 and \$195 for most of September. From a close of \$195.02 on October 5 it closed lower on six consecutive sessions to \$157.06 on October 13, and kept falling on the morning of October 14. The fill at \$149.89 was 23.1% below the October 5 close. SKHY closed the day at \$147.55. The stop sat at \$149.90, which is exactly 75% of the high, and it filled one cent below.

## What the memo said

The [[skhy-pretrade-memo|pre-trade memo]] rested on one claim: high-bandwidth memory had stopped behaving like commodity memory, and SK Hynix was positioned to capture the difference. The catalyst was the 2027 HBM4 contract round. The thesis was to be invalidated if 2027 HBM4 contracts settled below 2026 levels, if HBM revenue declined for two consecutive quarters, or if conventional DRAM contract prices turned negative quarter over quarter.

None of those three conditions has been met. SK Hynix is still negotiating its 2027 HBM volumes and prices, while Micron has said it completed contracts for the bulk of its 2027 HBM supply ([Seoul Economic Daily, October 1](https://en.sedaily.com/finance/2026/10/01/hbm-prices-to-more-than-double-next-year-as-shortage)). SK Hynix does not report its third quarter until October 28 ([6-K, October 14](https://www.sec.gov/Archives/edgar/data/0002120882/000119312526420934/d413172d6k.htm)). TrendForce's September 30 forecast has conventional DRAM contract prices rising 10 to 15% quarter over quarter in the fourth quarter ([TrendForce](https://www.trendforce.com/presscenter/news/20260930-13258.html)), which is a slowdown but not a decline. The position was closed by price, not by thesis.

## Why it lost

Three things happened, and only one of them was about SK Hynix.

The first was Korea. Between October 2 and October 8, before any memory-specific headline, the KOSPI fell 5.4% from 7,003.74 to 6,625.93, and SKHY fell 13.3% from October 5 to October 9 while Micron fell 3.3% over the same days. By October 14 the KOSPI was down 14.2% from its October 2 close. The memo named the instrument as its largest risk, but it framed the risk as SKHY trading like US memory-complex beta. It traded like Korean equity beta instead, which is the opposite failure and one I did not write down.

The second was CXMT. Its president, Cao Kanyu, said at a Shanghai industry event over the weekend of October 10 that the company had made progress on a denser cell design for server memory and was targeting a product by the end of 2026 ([24/7 Wall St., Oct 12](https://247wallst.com/investing/2026/10/12/memory-stocks-slide-as-chinas-cxmt-flags-denser-chip-design-micron-and-sk-hynix-fall-4-western-digital-drops-2/)). SKHY and Micron each fell 4% on October 12. The memo listed CXMT as the competitive risk and described its July listing as capital attached to the question. The announcement concerned conventional server DRAM rather than HBM, and the market did not make that distinction.

The third was the only company-specific news. On October 13 a Korean outlet reported that some of SK Hynix's HBM4 back-end equipment orders planned for the second half of 2026 may slip into 2027, and the company did not comment ([24/7 Wall St., Oct 14](https://247wallst.com/investing/2026/10/14/sk-hynix-delays-hbm4-equipment-orders-as-its-stock-falls-5-days-straight/)). That report touches the HBM4 ramp the thesis depended on. It is unconfirmed, and it arrived after the stock had already fallen 19.5% from October 5.

The currency did not cause the loss. The won strengthened from 1,414.9 to 1,340.5 per dollar over the holding period, about 5.6%, which helped the ADR in dollar terms. The local share price did worse than the ADR, not better.

From October 5 to October 13, SKHY fell 19.5% against 10.4% for Micron, nearly twice as far. Whatever the reason SK Hynix should have outperformed Micron, it did not show up in the price when the sector sold off.

## Entry

The memo said the momentum into August 14 was not favorable for entry and that I was buying anyway. The stock had risen 27.7% from its August 6 close, and the KOSPI closed at a record that day. The fill was \$170.74 against a pre-market reference of \$166.19, 2.7% higher and near the top of that day's range. A better entry would not have changed the outcome much, since the exit was set by the high and not by the entry. It does account for \$9 of the \$42.71.

## The stop

The [[investment-mandate]] and the pre-trade memo set a 25% trailing stop from the highest price since entry, and that is the rule that closed the position. The high was \$199.87 on September 9, so the stop sat at \$149.90 from that day on and did not move again while the stock traded sideways through September.

The rule did what it was meant to do. A position that was up 17.1% at its high closed down 12.2%, which is about half of the loss a fixed 25% stop from entry would have allowed. It also sold the position on a seventh consecutive down day, on news that does not touch any of the three conditions the memo set for invalidating the thesis. A price rule cannot tell those two situations apart, and it is not meant to.

## What I take from it

The memo spent its risk section on the right categories and still missed how the trade would actually lose. I flagged the instrument, but I guessed the wrong correlation. I flagged CXMT, but as a slow competitive threat to HBM rather than a headline that could move every memory name in a day. Neither omission was about SK Hynix's fundamentals, and the thesis may still be right.

The process lesson is about the risk section itself. Each named risk should say how it would show up in the price, over what period, and against which comparison, so that a post-mortem can check it. "The instrument may not track the thesis" was true and did not tell me which way it would fail.
