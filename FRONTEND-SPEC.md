# RDO ONE — Frontend Description

RDO ONE is a single-page trading terminal (Vite + vanilla JS, no framework) that presents **two purpose-built terminals** behind a shared landing page and mode-select screen. It's non-custodial — wallet keys never leave the browser.

## 1. Landing Screen (`#landingScreen`)
Marketing entry point, not a functional terminal.
- Hero with animated heading, "Choose your weapon" mode grid (Insider vs Fundamentals), feature grid (Sniper Engine, X Intelligence, Live Order Book, Non-Custodial, Multi-Chain, PnL Analytics), CTA ("Open Terminal"), footer.
- Purely promotional — clicking through goes to the Welcome/mode-select screen.

## 2. Welcome / Mode Select (`#welcomeScreen`)
Two cards: **Insider** and **Fundamentals**. Connection status indicator, ESC returns here from either terminal.

## 3. Insider Terminal (`#insiderScreen`) — the live, functional one
On-chain alpha-hunting terminal for Solana/ETH/Base/BNB. Built from real modules (`src/`):
- **Network selector** (`network.js`) — switch chains without losing state.
- **Pair discovery** (`pairs.js`, 292 lines) — live trending pairs feed, contract-address paste/search, per-network pair lists.
- **Chart** (`chart.js`) — embedded price chart (GMGN-style) toggle per pair.
- **Wallets** (`wallets.js`, 182 lines) — multi-wallet management, dev-wallet monitoring/add-prompt, per-wallet chain selection.
- **Sniper** (`sniper.js`) — copy-trade engine: fee tier selection, buy-count tracking, toggle on/off, add a new snipe target. (Per the landing copy: custom multipliers, auto TP/SL, honeypot protection, sub-500ms execution via Jito bundles — confirm how much of this is implemented vs. aspirational.)
- **Quick trade** (`trade.js`, 296 lines) — side (buy/sell) and amount selection, quote info, execute trade.
- **Orders/trade feed** (`orders.js`, 144 lines) — live order/trade list, start/stop feed.
- **X/Twitter tracker** (`tweets.js`) — KOL tab switching, live tweet feed.
- **Clock** (`clock.js`) — live UTC clock in the topbar.
- **Resizable panels** (`resizers.js`) — draggable column widths.
- Backed by `api.js` + `/api/data/*` serverless endpoints (native-price, trending/[chain], search, trades/[chain]/[address]).

## 4. Fundamentals Terminal (`#terminalScreen`) — currently a static mockup
Structured market-data / derivatives terminal, **not yet wired to real data or trading**:
- Topbar: OVERVIEW / POSITIONS / ORDERS / HISTORY / ALERTS tabs, SPOT/PERP mode switch, live clock.
- Left panel: watchlist (BTC/ETH/SOL with price + %change).
- Center: (order book / chart — needs live implementation).
- Intended feature set per landing copy: full L2 order book, multi-asset watchlist, portfolio analytics, one-click order entry, leverage controls, limit/market orders, stop-loss & take-profit.
- This is the terminal the **RDO-PERPS-BUILD-PLAN.md** (V4.0) targets: Phantom-wallet-first, LI.FI deposit widget (any token → USDC on HyperEVM), Hyperliquid perps trading (365+ markets, builder-code fee revenue), real-time WebSocket price feed into the existing canvas chart, positions panel with live PnL.

## 5. What's missing to match the full plan
Cross-referencing the build plan against current code:
- [ ] Phantom wallet connect (Solana + EVM mode) wired into Fundamentals terminal
- [ ] LI.FI deposit widget embedded/themed, destination locked to USDC on HyperEVM
- [ ] Hyperliquid REST/WebSocket integration (balance, open/close position, live positions)
- [ ] Builder-code fee registration + treasury wallet wired into every order
- [ ] Top-50 market selector + leverage slider + live liq/fee stats in trade panel
- [ ] Fundamentals order book going from static mockup to live data
- [ ] `rdo-backend` project's role in this (indexer for trade history/leaderboard — Phase 6, optional) needs clarifying

## 6. Known issue observed while running
Dev server logs show `EACCES` proxy errors on `/api/data/native-price` and `/api/data/trending/sol` — the Vite proxy target (likely `rdo-backend`) isn't reachable, so live pricing/trending data isn't loading in the Insider terminal right now.
