---
title: Map of the AI Compute Stack
date: 2026-06-01
tags: [research, AI Infra, Semiconductors, Thesis]
---

*June 2026 · AI Infrastructure · Semiconductors*

---

The AI compute stack runs from raw silicon up to the model a user actually talks to, and at almost every step a small number of companies control a choke point the layers above cannot easily route around. Reading from the bottom: purified sand becomes wafers, wafers are patterned by lithography tools into chips at a foundry, those chips are paired with high-bandwidth memory, bonded together in advanced packaging, wired into clusters by networking gear, fed power and cooling, financed and operated by hyperscalers, and finally turned into tokens by a handful of model labs. Money flows the other way: hyperscaler capex is the demand signal that pulls everything beneath it. For any company or trade, the useful move is to ask which layer it sits in, who else controls that layer, and the single variable (a price, a yield, a lead time, a policy) that decides who keeps the margin. What follows breaks down each layer on those terms, then steps back to the industries caught in the blast radius and the technologies and demand questions that will shape the next few years.

---

## The compute stack, layer by layer

### 1. Materials and wafers

At the base, refined polysilicon is grown into ingots, sliced into 300mm wafers, and polished to near-atomic flatness. Alongside the wafer sit the ultrapure chemicals every fab consumes: photoresist, etch gases, and slurries. The economic choke point is not the silicon but the qualification barrier. A leading-edge fab will not swap wafer or resist suppliers casually, because one contaminated batch can scrap millions of dollars of in-process wafers, so incumbents hold their positions for years.

Shin-Etsu Chemical and SUMCO, both Japanese, together supply more than half of global 300mm wafer capacity. The next tier is GlobalWafers, Siltronic, and SK Siltron, and the top five hold roughly 82% of revenue. The same Japanese cluster, joined by JSR and Tokyo Ohka, also dominates EUV photoresist, the light-sensitive coating that makes advanced patterning possible. Chinese entrants are growing on mature nodes but are not yet qualified at the leading edge.

The variable to watch is the yen, since these are Japanese exporters pricing into a dollar market: a weak yen flatters their margins and a sharp reversal squeezes them. Underneath that runs the fab capex cycle. Wafer and chemical demand is a derivative of how many new fabs are being equipped, which makes this layer early-cyclical, inflecting before the chips it feeds.

### 2. Wafer fab equipment (WFE)

This is the machinery that builds transistors, depositing films, etching patterns, and printing circuit geometry layer by layer. The pricing power lives in lithography, specifically extreme ultraviolet (EUV) and the newer High-NA EUV, because there is exactly one supplier and nothing below roughly 5nm gets made without it.

ASML holds a 100% monopoly on EUV and is the single most irreplaceable company in the entire stack. Around it sit Applied Materials and Lam Research, which cover deposition and etch; Tokyo Electron, which adds etch, deposition, and about 90% of the world's coater/developer tools; and KLA, which owns inspection and metrology. Together the top five hold roughly 56 to 66% of WFE. ASML is deliberately rationing the future, planning to reach only about 20 High-NA units per year by 2027 to 2028.

Export controls are the dominant force here. Washington's restrictions on selling advanced tools into China reshape these companies' addressable market overnight and turn a commercial business into a geopolitical instrument; a meaningful slice of ASML and Tokyo Electron revenue has historically come from China, so each new rule is a direct earnings input. Beneath that runs the same capex cycle as the wafer layer, amplified, because equipment orders are lumpy and lead the build.

### 3. Foundry

A foundry turns a chip design into physical wafers at a given process node. The frontier is now 2nm, where transistors move to a gate-all-around structure to keep shrinking. The pricing power is concentration plus trust: a leading-edge fab costs tens of billions and takes years, so customers pre-commit capacity, and that pre-commitment is what lets the leader hold price.

TSMC is the layer. It held about 70% of pure-play foundry revenue in Q4 2025 and over 90% at the 3nm and 2nm leading edge, and it fabricates for essentially every major AI chip designer: Nvidia, AMD, Broadcom, Apple. Samsung is a distant second near 7% and is fighting yield problems on its 2nm node; Intel is trying to re-enter contract manufacturing with its 18A process but is sub-scale. Keep one thing straight: "foundry share" depends on the denominator, and pure-play foundry (~70%) reads very differently from total-semiconductor framings, so check which a source means.

This is where AI supply risk meets geopolitics most directly, because the irreplaceable leader sits in Taiwan, within reach of a Chinese contingency that markets periodically try to price. Export controls also bite — which Chinese customers TSMC and Samsung may serve — and the ordinary capex cycle governs how fast capacity expands, with TSMC guiding roughly \$56 billion for 2026.

### 4. Memory (DRAM, HBM, NAND)

Memory feeds the processor. The AI-specific piece is high-bandwidth memory (HBM): stacks of DRAM dies bonded vertically and placed right next to the GPU so data can move fast enough to keep the compute fed. Conventional DDR5 serves CPUs and NAND handles storage. The bottleneck is physical and brutal. An HBM stack consumes roughly three times the wafer of equivalent commodity DRAM, so every wafer redirected to HBM pulls capacity out of ordinary memory, which is why an AI-memory shortage has been dragging up DDR5 and even consumer RAM prices.

SK Hynix leads HBM at roughly 50 to 62% depending on the cut, and is Nvidia's primary supplier. Samsung and Micron contest the rest, with Samsung having stumbled on qualification and Micron rising. On conventional DRAM the order is closer: Samsung around 38% and SK Hynix around 29%. The pricing power is real enough that SK Hynix reported an operating margin near 72% in Q1 2026, reportedly above Nvidia's, and had sold out its 2026 HBM allocation before the year began.

Memory has always been the most violently cyclical corner of semiconductors, boom to glut and back, so the live question is whether AI has made this cycle structural rather than another spike that ends in oversupply. For now demand outruns supply, but the same suppliers are all adding capacity, and memory remains the layer most likely to see a sharp price reversal if the buildout slows. Power is a secondary driver, since HBM runs hot and thermal limits cap how many stacks fit on a package.

### 5. Advanced packaging

Packaging assembles the logic die and the HBM stacks onto a single carrier so they behave as one chip; without it, a cutting-edge GPU die is just loose silicon. TSMC's CoWoS (chip-on-wafer-on-substrate) has been the literal gate on AI hardware. For two years the binding constraint on shipping accelerators was not making the chips but packaging them.

TSMC dominates high-end packaging and is racing to expand it, from roughly 13,000 wafers a month at the end of 2023 to about 75,000 at the end of 2025, targeting 120,000 to 130,000 by the end of 2026. Even with that ramp, capacity stays booked, Nvidia has locked up around 60% of it, and lead times run past a year. The outsourced assemblers Amkor and ASE/SPIL pick up lower-margin steps.

The dominant macro variable is the capex cycle feeding through, since packaging demand is a direct function of how many accelerators the hyperscalers are buying. The structural risk hanging over it is the same Taiwan concentration as the foundry layer, because the world's advanced packaging sits largely in one place.

### 6. Accelerators and GPUs

This is the compute die itself, the GPU or custom chip that does the matrix math. The economic point is that the die is not the moat; the moat is the system around it, software, interconnect, and first claim on scarce memory and packaging.

Nvidia holds roughly 70 to 80% of AI accelerators, down from a peak near 87% in 2024, and its real defenses are CUDA (the software ecosystem developers are locked into), NVLink (its interconnect), and priority access to HBM and CoWoS. AMD is the main merchant alternative at single-digit share, competing on memory capacity and price. The faster-growing threat is custom silicon: Broadcom and Marvell co-design bespoke chips for the hyperscalers (Google's TPU, Amazon's Trainium, Microsoft's Maia, Meta's MTIA), and ASIC shipments are reported growing about 45% a year versus mid-teens for merchant GPUs. The structural tension is that roughly 40% of Nvidia's revenue comes from four customers all building their own chips.

Capex sentiment is the swing factor, because this is the most expensive single line item in a buildout. Export controls are the other force: China is a large but politically gated market for Nvidia and AMD, and rule changes move both their revenue and the competitive field, since restricting US chips gives Chinese designers room to grow.

### 7. Interconnect and networking

Once you have many chips, they have to behave like one machine, and networking is what wires them together. It splits into three tiers: scale-up (inside a rack, the tightest and fastest), scale-out (across a cluster), and scale-across (between buildings). The pricing power concentrates in scale-up, which is still proprietary, and in the optics that increasingly dominate the cost and power of the whole fabric.

Nvidia owns scale-up through NVLink, the high-bandwidth link between GPUs in a rack, which is the hardest piece for rivals to dislodge. Scale-out has tipped to Ethernet, built on Broadcom's switch silicon (its Tomahawk chips) and Arista's switches, which passed the once-dominant InfiniBand in AI back-end networks during 2025. Marvell and the optical-module makers (Coherent, Lumentum, InnoLight) carry scale-across and the transceivers throughout, and those optics can be around 60% of networking cost and 45% of its power in a large cluster.

Capex drives the volume, but power is the quieter constraint here, since transceivers burn a surprising share of a cluster's energy, which is exactly why co-packaged optics is coming. Open standards aimed at breaking Nvidia's scale-up lock — Ultra Ethernet, UALink — are real but a 2027-to-2028 story, so today's deployments still run on whatever is proven.

### 8. Power and cooling

This is the layer that has quietly become the binding constraint. An AI rack now draws 50 to 140 kilowatts, far beyond what air can cool, so direct liquid cooling is becoming mandatory; and the harder problem is getting the electricity to the building at all. The choke point is not generation but delivery: interconnection queues and the multi-year lead times on heavy electrical gear.

The companies that matter here are less familiar to tech investors. Transformers and switchgear come from a tight group — Eaton, Schneider Electric, Siemens Energy, and Hitachi Energy; on-site generation increasingly means gas turbines from GE Vernova, Siemens, and Mitsubishi, which are themselves sold out years ahead; cooling runs through Vertiv and its peers; and the hyperscalers are signing nuclear deals, including small modular reactors, to secure firm power. Electrical equipment is under 10% of data-center cost and close to 100% of the bottleneck.

Power availability is the macro variable, full stop, and it is increasingly local and political. US interconnection queues run into the thousands of gigawatts, transformer lead times stretch to several years, and waits for grid connection reach four to seven years in major hubs. Interest rates matter too, because this is a debt-financed buildout of long-lived assets, and permitting plus community pushback is turning into a genuine gating factor.

### 9. Cloud and hyperscaler capex

This is the demand engine for everything beneath it. The hyperscalers buy the chips, memory, packaging, networking, and power, assemble it into data centers, and rent it back out as cloud and AI services. Their spending is the single number that sets the tempo of the entire stack.

The names are Microsoft, Alphabet/Google, Amazon, and Meta, with Oracle now material. Combined 2026 capex guidance has climbed toward roughly \$725 billion for the big four, up about 77% from 2025, with something like three-quarters tied to AI. The exact total is a moving target depending on which earnings call you use. Crucially, they are increasingly funding this with debt rather than cash flow, which is new behavior for companies of this kind.

Interest rates are the obvious macro variable, since debt-funded capex is sensitive to the cost of that debt, but the deeper one is AI return-on-investment sentiment. The whole edifice rests on the belief that this spending will earn its keep, and the first cracks of doubt are visible: Meta's stock fell about 9% on a single raised-capex guide. When that belief wavers, the demand signal for every layer below weakens at once.

### 10. Models and inference

At the top, the model is trained and then served, which is where compute finally becomes a product someone pays for. The economic puzzle is that the per-token cost of running a model is falling fast while total spend keeps rising, because cheaper tokens invite far heavier use, especially agentic workflows that make many model calls per task.

The frontier is a short list — OpenAI, Anthropic, and Google's Gemini — with open-weight models (Llama, Mistral, DeepSeek) setting a price floor underneath. The pricing power here is the weakest in the stack, because the model layer is commoditizing fastest; the durable edge belongs to whoever controls cost, which is why Google owning its TPUs matters. The labs are still unprofitable on a cash basis: OpenAI lost an estimated \$5 billion on about \$3.7 billion of revenue in 2025, and Anthropic's gross margin was around 40%, pressured by higher-than-expected inference cost.

The macro driver loops back to the bottom of the stack. The cost of inference is ultimately the cost of compute, which is the cost of chips and power, so this layer's economics are hostage to everything beneath it. The capex cycle sets how much capacity exists; the pace of efficiency gains sets whether falling unit prices can outrun rising usage. That race is the whole question of whether the top of the stack ever turns a profit.

---

## Where the blast radius lands: adjacent industries

The buildout is now large enough that its biggest effects show up outside technology.

### Power generation and utilities

AI has turned electricity into a growth industry for the first time in decades. Global data-center electricity demand is on track to roughly double toward more than 1,000 TWh by 2026, about the consumption of Japan, and US utilities are entering their largest capital cycle since postwar electrification. The clearest beneficiaries are firm-power sources: natural gas, expected to meet roughly a fifth of new global power needs, and nuclear, where the AI demand signal has revived uranium and small modular reactors. Microsoft, Google, and Amazon have all signed nuclear deals, and Amazon bought a data-center campus next to a nuclear plant outright.

### Grid hardware and commodities

The constraint runs through unglamorous equipment: transformers, switchgear, and turbines with multi-year backlogs, plus the copper and critical minerals that grid and data-center expansion consume. This is where a lot of non-obvious exposure sits, in companies previously valued as slow industrials that are now growth-adjacent to AI.

### Real estate, construction, water, and communities

US data-center construction spending hit about \$49.5 billion through April 2026, nearly four times the prior-year pace, reshaping land and power markets and the REITs that own the facilities, such as Equinix and Digital Realty. The costs are increasingly visible to households. Areas dense with data centers have seen electricity prices jump sharply, Dominion in Virginia proposed its first base-rate increase since 1992, and a large majority of Americans worry their bills will rise. Water draw for cooling and local opposition are turning permitting into a real brake, with dozens of projects rejected in early 2026. The fight over who pays — ratepayers or the hyperscalers — is itself now a live risk to the buildout.

---

## The next few years: tailwinds and the demand question

### Where the technology is heading

A few shifts are moving from lab to roadmap and are worth tracking as tailwinds. Optical interconnect is the headline one: as copper runs out of room, co-packaged optics brings the light source next to the switch or accelerator, and Nvidia, Broadcom, and Corning have put it on production roadmaps. Closely tied is the move to glass substrates, which handle the warpage and heat of ever-larger packages better than today's organic ones and can carry optical routing directly; commercialization is targeted around 2027, ramping toward 2030. On the chip itself, the roadmap runs through backside power delivery and then CFET transistors toward the 1.4nm generation later this decade. On the power side, silicon-carbide and gallium-nitride electronics and higher-voltage rack designs are emerging to cut conversion losses, while on-site generation including SMRs is the structural answer to the grid wait. Memory is pushing toward HBM4E, custom base dies, and pooling schemes (CXL) that disaggregate memory across a rack.

### Is the demand real, or a loop?

This is the question that decides whether any of the above is a durable tailwind or a bubble, and the direct answer is that it is contested. The worry is "circular financing." A small group of companies are simultaneously each other's investors, suppliers, and customers, and analysts have tallied more than \$800 billion of such arrangements. OpenAI alone has signed something like \$1.15 trillion in multi-year commitments across Broadcom, Oracle, Microsoft, Nvidia, AMD, AWS, and CoreWeave. Nvidia agreed to invest up to \$100 billion in OpenAI, which would spend it on Nvidia chips; AMD handed OpenAI warrants for roughly 10% of its equity tied to purchases. The bear case is the dot-com parallel, when telecom-equipment makers like Nortel and Lucent lent customers the money to buy gear and the revenue evaporated once real usage fell short. The fragility is not hypothetical: the Nvidia-OpenAI investment reportedly stalled in early 2026, with Jensen Huang signaling the full \$100 billion was "not in the cards."

The bull case is that the demand underneath is real and growing from outside the circle. Anthropic's revenue reportedly went from about \$1 billion to \$5 billion in under six months, Google said its AI token consumption nearly tripled between May and October 2025, and enterprises and consumers are paying real money at scale. The deciding test is how much revenue comes from outside the loop. If external, paying demand keeps compounding, the circular deals are ordinary vendor financing greasing a real boom; if it stalls, the same web that amplifies growth on the way up amplifies the unwind on the way down. That single variable — external demand growth — sits above every layer of this map and ultimately prices all of them.
