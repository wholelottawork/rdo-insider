// RDO ONE — Fundamentals app, ported from Claude Design "RDO ONE Terminal.dc.html".
// Loaded as an ES module (needs `import` for Hyperliquid signing) but still attaches
// window.rdoXxx handlers for the inline onclick="" attributes, same as the rest of index.html.
import * as HL from './hyperliquid.js';

(function () {
  'use strict';

  var ACCENT = '#FF5C00';
  var LIVE_COIN = 'BTC';

  // Real account state — populated once a wallet is connected. Terminal page reads this
  // instead of a hardcoded balance; PNL/Markets/News stay on their existing mock data.
  var WALLET = { address: null, connecting: false };
  var ACCOUNT = { balance: null, positions: [], openOrders: [], fills: [] };
  function currentBalance() { return ACCOUNT.balance !== null ? ACCOUNT.balance : 0; }

  function rng(seed) {
    var a = seed;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fmt$(n, dec) {
    dec = dec === undefined ? 2 : dec;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtSigned$(n, dec) {
    dec = dec === undefined ? 2 : dec;
    var s = n >= 0 ? '+' : '-';
    return s + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtCompact$(n) {
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    return fmt$(n, 2);
  }
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function styleStr(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return Object.keys(obj).map(function (k) {
      var cssKey = k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
      return cssKey + ':' + obj[k];
    }).join(';');
  }

  /* ── shared style-object builders (ported from design's _navBtn/_pillBtn/_smallTab/_newsChip) ── */
  function navBtn(active, color) {
    color = color || ACCENT;
    return active
      ? { padding: '7px 14px', background: 'rgba(255,92,0,0.12)', color: color, border: '1px solid rgba(255,92,0,0.35)', borderRadius: '3px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer' }
      : { padding: '7px 14px', background: 'transparent', color: '#6b6b63', border: '1px solid transparent', borderRadius: '3px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer' };
  }
  function pillBtn(active, color) {
    return active
      ? { flex: 1, padding: '10px', background: color, color: '#0A0A0A', border: 'none', borderRadius: '4px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer' }
      : { flex: 1, padding: '10px', background: '#161616', color: '#6b6b63', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', cursor: 'pointer' };
  }
  function smallTab(active) {
    return active
      ? { padding: '6px 12px', background: '#1b1b1b', color: '#F5F1EA', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', letterSpacing: '1px', cursor: 'pointer' }
      : { padding: '6px 12px', background: 'transparent', color: '#6b6b63', border: '1px solid transparent', borderRadius: '3px', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', letterSpacing: '1px', cursor: 'pointer' };
  }
  function newsChip(active) {
    return active
      ? { padding: '7px 14px', background: ACCENT, color: '#0A0A0A', border: '1px solid ' + ACCENT, borderRadius: '20px', fontFamily: "'JetBrains Mono',monospace", fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px', cursor: 'pointer' }
      : { padding: '7px 14px', background: 'transparent', color: '#a8a89f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', fontFamily: "'JetBrains Mono',monospace", fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px', cursor: 'pointer' };
  }

  /* ══════════════════════════════════════════════════════════
     DATA GENERATION (seeded/deterministic, ported verbatim)
     ══════════════════════════════════════════════════════ */
  var MARKET = null, PNL = null, MARKETS_DATA = null, NEWS_DATA = null;

  function genMarketData() {
    var rand = rng(918273);
    var N = 72;
    var CHART_W = 1200, CHART_H = 460, PAD_T = 24, PAD_B = 28, AXIS_R = 64;
    var plotW = CHART_W - AXIS_R;
    var slot = plotW / N;
    var bodyW = slot * 0.56;

    var price = 64180;
    var raw = [];
    for (var i = 0; i < N; i++) {
      var open = price;
      var drift = (rand() - 0.465) * 260;
      var close = Math.max(100, open + drift);
      var high = Math.max(open, close) + rand() * 130;
      var low = Math.min(open, close) - rand() * 130;
      raw.push({ open: open, close: close, high: high, low: low, vol: 30 + rand() * 100 });
      price = close;
    }
    var markPrice = raw[raw.length - 1].close;
    var openPrice24h = raw[Math.max(0, raw.length - 24)].open;
    var changePct = ((markPrice - openPrice24h) / openPrice24h) * 100;

    var maxP = Math.max.apply(null, raw.map(function (c) { return c.high; })) * 1.002;
    var minP = Math.min.apply(null, raw.map(function (c) { return c.low; })) * 0.998;
    function priceToY(p) { return PAD_T + ((maxP - p) / (maxP - minP)) * (CHART_H - PAD_T - PAD_B); }

    var candles = raw.map(function (c, i2) {
      var cx = i2 * slot + slot / 2;
      var up = c.close >= c.open;
      return {
        wickX: cx.toFixed(2),
        wickY1: priceToY(c.high).toFixed(2),
        wickY2: priceToY(c.low).toFixed(2),
        bodyX: (cx - bodyW / 2).toFixed(2),
        bodyY: priceToY(Math.max(c.open, c.close)).toFixed(2),
        bodyW: bodyW.toFixed(2),
        bodyH: Math.max(1.4, Math.abs(priceToY(c.open) - priceToY(c.close))).toFixed(2),
        color: up ? '#1FC47C' : '#FF4757',
      };
    });

    var closesPath = raw.map(function (c, i2) {
      var cx = i2 * slot + slot / 2;
      var y = priceToY(c.close);
      return (i2 === 0 ? 'M' : 'L') + cx.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var lastX = ((N - 1) * slot + slot / 2).toFixed(1);
    var areaLinePath = closesPath;
    var areaFillPath = closesPath + ' L' + lastX + ',' + CHART_H + ' L' + (slot / 2).toFixed(1) + ',' + CHART_H + ' Z';

    var maxVol = Math.max.apply(null, raw.map(function (c) { return c.vol; }));
    var volumeBars = raw.map(function (c, i2) {
      var cx = i2 * slot + slot / 2;
      var h = (c.vol / maxVol) * 78;
      return {
        x: (cx - bodyW / 2).toFixed(2),
        y: (92 - h).toFixed(2),
        w: bodyW.toFixed(2),
        h: h.toFixed(2),
        color: c.close >= c.open ? 'rgba(31,196,124,0.55)' : 'rgba(255,71,87,0.5)',
      };
    });

    var gridCount = 5;
    var priceGridLines = [];
    for (var gi = 0; gi <= gridCount; gi++) {
      var pv = minP + ((maxP - minP) * gi) / gridCount;
      var y2 = priceToY(pv);
      priceGridLines.push({ y: y2.toFixed(2), yLabel: (y2 + 4).toFixed(2), label: '$' + pv.toLocaleString('en-US', { maximumFractionDigits: 0 }) });
    }

    var rsiRand = rng(55221);
    var rv = 50;
    var rsiPts = raw.map(function (c, i2) {
      rv += (rsiRand() - 0.5) * 14;
      rv = Math.max(8, Math.min(92, rv));
      var cx = i2 * slot + slot / 2;
      var y3 = 65 - (rv / 100) * 56;
      return (i2 === 0 ? 'M' : 'L') + cx.toFixed(1) + ',' + y3.toFixed(1);
    });

    var obRand = rng(77123);
    var spreadStep = markPrice * 0.00006;
    var cum = 0;
    var asksRaw = [];
    for (var ai = 0; ai < 15; ai++) {
      var size = 0.04 + obRand() * 2.1;
      cum += size;
      asksRaw.push({ price: markPrice + spreadStep * (ai + 1), size: size, cum: cum });
    }
    var maxCum = Math.max.apply(null, asksRaw.map(function (a) { return a.cum; }));
    var asks = asksRaw.slice().reverse().map(function (a) {
      return {
        price: '$' + a.price.toLocaleString('en-US', { maximumFractionDigits: 1 }),
        size: a.size.toFixed(3),
        total: a.cum.toFixed(2),
        barPct: ((a.cum / maxCum) * 100).toFixed(0) + '%',
      };
    });

    var cumB = 0;
    var bidsRaw = [];
    for (var bi = 0; bi < 15; bi++) {
      var sizeB = 0.04 + obRand() * 2.1;
      cumB += sizeB;
      bidsRaw.push({ price: markPrice - spreadStep * (bi + 1), size: sizeB, cum: cumB });
    }
    var maxCumB = Math.max.apply(null, bidsRaw.map(function (a) { return a.cum; }));
    var bids = bidsRaw.map(function (a) {
      return {
        price: '$' + a.price.toLocaleString('en-US', { maximumFractionDigits: 1 }),
        size: a.size.toFixed(3),
        total: a.cum.toFixed(2),
        barPct: ((a.cum / maxCumB) * 100).toFixed(0) + '%',
      };
    });

    MARKET = {
      markPrice: markPrice, changePct: changePct,
      candles: candles, volumeBars: volumeBars, priceGridLines: priceGridLines,
      rsiPath: rsiPts.join(' '),
      lastPriceY: priceToY(markPrice).toFixed(2),
      areaFillPath: areaFillPath, areaLinePath: areaLinePath,
      asks: asks, bids: bids,
      spread: spreadStep,
    };
  }

  /* ══════════════════════════════════════════════════════════
     REAL HYPERLIQUID TESTNET DATA (Terminal page only)
     ══════════════════════════════════════════════════════ */
  function calcRSI(closes, period) {
    period = period || 14;
    var out = new Array(closes.length).fill(null);
    if (closes.length <= period) return out;
    var gains = 0, losses = 0, i;
    for (i = 1; i <= period; i++) {
      var d0 = closes[i] - closes[i - 1];
      if (d0 > 0) gains += d0; else losses -= d0;
    }
    gains /= period; losses /= period;
    out[period] = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
    for (i = period + 1; i < closes.length; i++) {
      var d = closes[i] - closes[i - 1];
      var g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
      gains = (gains * (period - 1) + g) / period;
      losses = (losses * (period - 1) + l) / period;
      out[i] = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
    }
    return out;
  }

  // Same geometry math as genMarketData(), but driven by real candle/order-book data
  // instead of the seeded RNG. Kept separate from genMarketData so the synthetic
  // placeholder (used for the very first paint, before the network call resolves)
  // can't be accidentally broken by this.
  function buildRealMarket(rawCandles, l2Book) {
    var N = rawCandles.length;
    var CHART_W = 1200, CHART_H = 460, PAD_T = 24, PAD_B = 28, AXIS_R = 64;
    var plotW = CHART_W - AXIS_R;
    var slot = plotW / N;
    var bodyW = slot * 0.56;

    var markPrice = rawCandles[N - 1].close;
    var refIdx = Math.max(0, N - 24);
    var openPrice24h = rawCandles[refIdx].open;
    var changePct = ((markPrice - openPrice24h) / openPrice24h) * 100;

    var maxP = Math.max.apply(null, rawCandles.map(function (c) { return c.high; })) * 1.002;
    var minP = Math.min.apply(null, rawCandles.map(function (c) { return c.low; })) * 0.998;
    function priceToY(p) { return PAD_T + ((maxP - p) / (maxP - minP)) * (CHART_H - PAD_T - PAD_B); }

    var candles = rawCandles.map(function (c, i2) {
      var cx = i2 * slot + slot / 2;
      var up = c.close >= c.open;
      return {
        wickX: cx.toFixed(2), wickY1: priceToY(c.high).toFixed(2), wickY2: priceToY(c.low).toFixed(2),
        bodyX: (cx - bodyW / 2).toFixed(2), bodyY: priceToY(Math.max(c.open, c.close)).toFixed(2),
        bodyW: bodyW.toFixed(2), bodyH: Math.max(1.4, Math.abs(priceToY(c.open) - priceToY(c.close))).toFixed(2),
        color: up ? '#1FC47C' : '#FF4757',
      };
    });

    var closesPath = rawCandles.map(function (c, i2) {
      var cx = i2 * slot + slot / 2;
      return (i2 === 0 ? 'M' : 'L') + cx.toFixed(1) + ',' + priceToY(c.close).toFixed(1);
    }).join(' ');
    var lastX = ((N - 1) * slot + slot / 2).toFixed(1);
    var areaLinePath = closesPath;
    var areaFillPath = closesPath + ' L' + lastX + ',' + CHART_H + ' L' + (slot / 2).toFixed(1) + ',' + CHART_H + ' Z';

    var maxVol = Math.max.apply(null, rawCandles.map(function (c) { return c.vol || 0.0001; }));
    var volumeBars = rawCandles.map(function (c, i2) {
      var cx = i2 * slot + slot / 2;
      var h = ((c.vol || 0) / maxVol) * 78;
      return { x: (cx - bodyW / 2).toFixed(2), y: (92 - h).toFixed(2), w: bodyW.toFixed(2), h: h.toFixed(2), color: c.close >= c.open ? 'rgba(31,196,124,0.55)' : 'rgba(255,71,87,0.5)' };
    });

    var gridCount = 5;
    var priceGridLines = [];
    for (var gi = 0; gi <= gridCount; gi++) {
      var pv = minP + ((maxP - minP) * gi) / gridCount;
      var y2 = priceToY(pv);
      priceGridLines.push({ y: y2.toFixed(2), yLabel: (y2 + 4).toFixed(2), label: '$' + pv.toLocaleString('en-US', { maximumFractionDigits: 0 }) });
    }

    var closes = rawCandles.map(function (c) { return c.close; });
    var rsiArr = calcRSI(closes, 14);
    var rsiPts = [];
    rsiArr.forEach(function (rv, i2) {
      if (rv === null) return;
      var cx = i2 * slot + slot / 2;
      var y3 = 65 - (rv / 100) * 56;
      rsiPts.push((rsiPts.length === 0 ? 'M' : 'L') + cx.toFixed(1) + ',' + y3.toFixed(1));
    });

    function levelsToRows(levels) {
      var cum = 0;
      var rows = levels.map(function (lv) {
        var px = parseFloat(lv.px), sz = parseFloat(lv.sz);
        cum += sz;
        return { price: px, size: sz, cum: cum };
      });
      var maxCum = Math.max.apply(null, rows.map(function (r) { return r.cum; }).concat([0.0001]));
      return rows.map(function (r) {
        return {
          price: '$' + r.price.toLocaleString('en-US', { maximumFractionDigits: 1 }),
          size: r.size.toFixed(3),
          total: r.cum.toFixed(2),
          barPct: ((r.cum / maxCum) * 100).toFixed(0) + '%',
        };
      });
    }
    var bidLevels = (l2Book && l2Book.levels && l2Book.levels[0]) || [];
    var askLevels = (l2Book && l2Book.levels && l2Book.levels[1]) || [];
    var asks = levelsToRows(askLevels.slice(0, 15)).reverse();
    var bids = levelsToRows(bidLevels.slice(0, 15));
    var spread = askLevels.length && bidLevels.length ? (parseFloat(askLevels[0].px) - parseFloat(bidLevels[0].px)) : 0;

    return {
      markPrice: markPrice, changePct: changePct,
      candles: candles, volumeBars: volumeBars, priceGridLines: priceGridLines,
      rsiPath: rsiPts.join(' '),
      lastPriceY: priceToY(markPrice).toFixed(2),
      areaFillPath: areaFillPath, areaLinePath: areaLinePath,
      asks: asks, bids: bids,
      spread: spread,
    };
  }

  var liveMarketFailed = false;
  async function loadMarketData() {
    try {
      var now = Date.now();
      var startTime = now - 100 * 60 * 60 * 1000; // ~100 hourly candles
      var candlesResp = await HL.fetchCandles(LIVE_COIN, '1h', startTime, now);
      var l2Resp = await HL.fetchL2Book(LIVE_COIN);
      if (!candlesResp || !candlesResp.length) throw new Error('Hyperliquid returned no candles');
      var rawCandles = candlesResp.map(function (c) {
        return { open: parseFloat(c.o), close: parseFloat(c.c), high: parseFloat(c.h), low: parseFloat(c.l), vol: parseFloat(c.v) };
      });
      MARKET = buildRealMarket(rawCandles, l2Resp);
      liveMarketFailed = false;
    } catch (e) {
      console.error('[hyperliquid] market data load failed — keeping last known data', e);
      liveMarketFailed = true;
      if (!MARKET) genMarketData(); // absolute fallback so the page never renders on null data
    }
    if (WALLET.address) await loadAccountData(); // positions' mark price depends on MARKET
    if (STATE.page === 'terminal') render();
  }

  var _marketPollTimer = null;
  function startMarketPolling() {
    if (_marketPollTimer) return;
    loadMarketData();
    _marketPollTimer = setInterval(loadMarketData, 5000);
  }

  async function loadAccountData() {
    if (!WALLET.address) return;
    try {
      var state = await HL.fetchClearinghouseState(WALLET.address);
      ACCOUNT.balance = parseFloat((state.marginSummary && state.marginSummary.accountValue) || 0);
      ACCOUNT.positions = (state.assetPositions || [])
        .filter(function (p) { return parseFloat(p.position.szi) !== 0; })
        .map(function (p) {
          var pos = p.position;
          var szi = parseFloat(pos.szi);
          var isLong = szi > 0;
          var entry = parseFloat(pos.entryPx);
          var mark = MARKET ? MARKET.markPrice : entry;
          var sizeAbs = Math.abs(szi);
          var sizeUsd = sizeAbs * mark;
          var margin = parseFloat(pos.marginUsed || 0);
          var pnl = parseFloat(pos.unrealizedPnl || 0);
          var pnlPct = margin ? (pnl / margin) * 100 : 0;
          var lev = (pos.leverage && pos.leverage.value) || 1;
          return {
            market: pos.coin + '-PERP',
            sideLabel: ' ' + lev + 'x ' + (isLong ? 'LONG' : 'SHORT'),
            sideColor: isLong ? '#1FC47C' : '#FF4757',
            size: fmt$(sizeUsd, 0),
            entry: fmt$(entry, entry < 1000 ? 2 : 0),
            mark: fmt$(mark, mark < 1000 ? 2 : 0),
            pnlLabel: fmtSigned$(pnl, 2) + ' (' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%)',
            pnlColor: pnl >= 0 ? '#1FC47C' : '#FF4757',
            liq: pos.liquidationPx ? fmt$(parseFloat(pos.liquidationPx), 2) : '—',
            margin: fmt$(margin, 0),
            coin: pos.coin, isLong: isLong, sizeAbs: sizeAbs,
          };
        });

      var orders = await HL.fetchOpenOrders(WALLET.address);
      ACCOUNT.openOrders = (orders || []).map(function (o) {
        var isBuy = o.side === 'B';
        return {
          market: o.coin + '-PERP', typeLabel: 'LIMIT',
          sideLabel: isBuy ? 'BUY' : 'SELL', sideColor: isBuy ? '#1FC47C' : '#FF4757',
          price: fmt$(parseFloat(o.limitPx), 2), size: fmt$(parseFloat(o.sz), 3),
        };
      });

      var fills = await HL.fetchUserFills(WALLET.address);
      ACCOUNT.fills = (fills || []).slice(0, 20).map(function (f) {
        var isBuy = f.side === 'B';
        return {
          time: new Date(f.time).toLocaleString(),
          market: f.coin + '-PERP',
          sideLabel: isBuy ? 'BUY' : 'SELL', sideColor: isBuy ? '#1FC47C' : '#FF4757',
          price: fmt$(parseFloat(f.px), 2), size: fmt$(parseFloat(f.sz), 3), fee: fmt$(parseFloat(f.fee || 0), 2),
        };
      });
    } catch (e) {
      console.error('[hyperliquid] account data load failed', e);
    }
  }

  window.rdoConnectWallet = async function () {
    if (WALLET.connecting || WALLET.address) return;
    WALLET.connecting = true;
    render();
    try {
      var addr = await HL.connectWallet();
      WALLET.address = addr;
      await loadAccountData();
    } catch (e) {
      console.error('[hyperliquid] wallet connect failed', e);
      alert('Wallet connect failed: ' + e.message);
    } finally {
      WALLET.connecting = false;
      render();
    }
  };

  window.rdoSubmitOrder = async function () {
    if (!WALLET.address) { alert('Connect your wallet first.'); return; }
    if (!MARKET) { alert('Market data has not loaded yet — try again in a moment.'); return; }
    var st = computeTradeStats();
    if (!st.collateral || st.size <= 0) { alert('Enter a collateral amount first.'); return; }
    var btn = document.getElementById('submitBtn');
    var origText = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'CONFIRM IN WALLET…'; btn.disabled = true; }
    try {
      var sizeSz = st.size / MARKET.markPrice;
      var result;
      if (st.isLimit) {
        result = await HL.placeOrder({ coin: LIVE_COIN, isBuy: st.isLong, sizeSz: sizeSz, limitPx: st.price, tif: 'Gtc' });
      } else {
        result = await HL.placeMarketOrder({ coin: LIVE_COIN, isBuy: st.isLong, sizeSz: sizeSz, refPx: MARKET.markPrice });
      }
      console.log('[hyperliquid] order result', result);
      if (result && result.status === 'ok') alert('Order placed on Hyperliquid testnet.');
      else alert('Hyperliquid responded: ' + JSON.stringify(result));
      await loadAccountData();
      render();
    } catch (e) {
      console.error('[hyperliquid] order failed', e);
      alert('Order failed: ' + e.message);
    } finally {
      if (btn) { btn.textContent = origText; btn.disabled = false; }
    }
  };

  window.rdoClosePosition = async function (coin, isLong, sizeAbs) {
    if (!WALLET.address || !MARKET) return;
    if (!confirm('Close ' + coin + '-PERP ' + (isLong ? 'LONG' : 'SHORT') + ' position?')) return;
    try {
      await HL.placeMarketOrder({ coin: coin, isBuy: !isLong, sizeSz: sizeAbs, refPx: MARKET.markPrice, reduceOnly: true });
      await loadAccountData();
      render();
    } catch (e) {
      console.error('[hyperliquid] close position failed', e);
      alert('Close failed: ' + e.message);
    }
  };

  function genPnlData() {
    var r = rng(4471);
    var N = 30;
    var cum = 0;
    var pts = [];
    for (var i = 0; i < N; i++) {
      var delta = (r() - 0.42) * 3200;
      cum += delta;
      pts.push(cum);
    }
    var scale = 48320.55 / pts[pts.length - 1];
    var series = pts.map(function (v) { return v * scale; });
    var maxV = Math.max.apply(null, series.concat([0]));
    var minV = Math.min.apply(null, series.concat([0]));
    var W = 1100, H = 260, PAD = 16;
    function x(i2) { return (i2 / (N - 1)) * W; }
    function y(v) { return PAD + ((maxV - v) / ((maxV - minV) || 1)) * (H - PAD * 2); }
    var linePts = series.map(function (v, i2) { return (i2 === 0 ? 'M' : 'L') + x(i2).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
    var areaPts = linePts + ' L' + x(N - 1).toFixed(1) + ',' + H + ' L' + x(0).toFixed(1) + ',' + H + ' Z';

    var sparkW = 260, sparkH = 60, sparkPad = 4;
    function sy(v) { return sparkPad + ((maxV - v) / ((maxV - minV) || 1)) * (sparkH - sparkPad * 2); }
    var sparkPath = series.map(function (v, i2) { return (i2 === 0 ? 'M' : 'L') + ((i2 / (N - 1)) * sparkW).toFixed(1) + ',' + sy(v).toFixed(1); }).join(' ');

    PNL = {
      cumPath: linePts,
      cumArea: areaPts,
      cumZeroY: y(0).toFixed(1),
      sparkPath: sparkPath,
      distBuckets: [
        { label: '> +200%', count: 22, pct: 7.7 },
        { label: '+50% to +200%', count: 61, pct: 21.5 },
        { label: '0% to +50%', count: 98, pct: 34.5 },
        { label: '-50% to 0%', count: 71, pct: 25.0 },
        { label: '< -50%', count: 32, pct: 11.3 },
      ],
      history: [
        { token: 'WIF-PERP', isLong: true, entry: 2.14, exit: 3.82, size: 1200, pnl: 942.40, pnlPct: 78.5, hold: '2h 14m', date: 'Jun 28' },
        { token: 'BONK-PERP', isLong: false, entry: 0.0000182, exit: 0.0000175, size: 800, pnl: 30.80, pnlPct: 3.8, hold: '45m', date: 'Jun 27' },
        { token: 'PEPE-PERP', isLong: true, entry: 0.0000091, exit: 0.0000067, size: 500, pnl: -131.90, pnlPct: -26.4, hold: '6h 02m', date: 'Jun 26' },
        { token: 'JUP-PERP', isLong: true, entry: 0.87, exit: 1.42, size: 2000, pnl: 1264.40, pnlPct: 63.2, hold: '1d 3h', date: 'Jun 24' },
        { token: 'TIA-PERP', isLong: false, entry: 5.20, exit: 5.61, size: 600, pnl: -47.30, pnlPct: -7.9, hold: '3h 40m', date: 'Jun 23' },
        { token: 'SUI-PERP', isLong: true, entry: 1.02, exit: 1.98, size: 1500, pnl: 1411.80, pnlPct: 94.1, hold: '5h 18m', date: 'Jun 21' },
        { token: 'INJ-PERP', isLong: false, entry: 22.40, exit: 21.10, size: 900, pnl: 52.20, pnlPct: 5.8, hold: '22m', date: 'Jun 20' },
        { token: 'FLOKI-PERP', isLong: true, entry: 0.000098, exit: 0.000041, size: 400, pnl: -232.65, pnlPct: -58.2, hold: '12h 05m', date: 'Jun 18' },
      ],
    };
  }

  function genCalendarMonth(offset) {
    var base = new Date(2026, 6, 1); // "today" = Jul 1, 2026
    var d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    var year = d.getFullYear();
    var month = d.getMonth();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var isCurrentMonth = offset === 0;
    var r = rng(year * 137 + month * 31 + 9001);

    var days = [];
    for (var day = 1; day <= daysInMonth; day++) {
      var pnl = 0, hasTrade = false;
      if (isCurrentMonth) {
        if (day === 1) { pnl = -142.30; hasTrade = true; }
      } else {
        var roll = r();
        if (roll > 0.42) {
          hasTrade = true;
          var win = r() > 0.4;
          pnl = win ? 60 + r() * 1450 : -(40 + r() * 780);
        }
      }
      days.push({ day: day, pnl: pnl, hasTrade: hasTrade });
    }

    var winDays = 0, winTotal = 0, lossDays = 0, lossTotal = 0, totalPnl = 0;
    var bestStreak = 0, run = 0;
    days.forEach(function (dd) {
      if (dd.hasTrade) {
        totalPnl += dd.pnl;
        if (dd.pnl > 0) { winDays++; winTotal += dd.pnl; run++; bestStreak = Math.max(bestStreak, run); }
        else { lossDays++; lossTotal += dd.pnl; run = 0; }
      } else {
        run = 0;
      }
    });
    var currentStreak = 0;
    for (var i = days.length - 1; i >= 0; i--) {
      if (days[i].hasTrade && days[i].pnl > 0) currentStreak++;
      else break;
    }

    return {
      monthLabel: monthNames[month] + ' ' + year,
      monthShort: monthNames[month],
      daysInMonth: daysInMonth, firstWeekday: firstWeekday, days: days,
      totalPnl: totalPnl, winDays: winDays, winTotal: winTotal, lossDays: lossDays, lossTotal: lossTotal,
      currentStreak: currentStreak, bestStreak: bestStreak,
    };
  }

  function genMarketsData() {
    var rand = rng(310771);
    function hue(i) { return 'hsl(' + ((i * 47) % 360) + ',62%,48%)'; }

    var coinDefs = [
      { name: 'Bitcoin', symbol: 'BTC', mono: 'B', price: 71240, mcapB: 1410 },
      { name: 'Ethereum', symbol: 'ETH', mono: 'E', price: 4218, mcapB: 195 },
      { name: 'Tether', symbol: 'USDT', mono: 'T', price: 1.0002, mcapB: 184 },
      { name: 'Solana', symbol: 'SOL', mono: 'S', price: 198.40, mcapB: 105 },
      { name: 'XRP', symbol: 'XRP', mono: 'X', price: 1.842, mcapB: 102 },
      { name: 'BNB', symbol: 'BNB', mono: 'B', price: 642.30, mcapB: 98 },
      { name: 'USD Coin', symbol: 'USDC', mono: 'U', price: 0.9998, mcapB: 73 },
      { name: 'Dogecoin', symbol: 'DOGE', mono: 'D', price: 0.2190, mcapB: 32 },
      { name: 'TRON', symbol: 'TRX', mono: 'T', price: 0.2841, mcapB: 30 },
      { name: 'Cardano', symbol: 'ADA', mono: 'A', price: 0.7120, mcapB: 25 },
      { name: 'Toncoin', symbol: 'TON', mono: 'T', price: 6.72, mcapB: 17 },
      { name: 'Avalanche', symbol: 'AVAX', mono: 'A', price: 41.20, mcapB: 16 },
      { name: 'Chainlink', symbol: 'LINK', mono: 'L', price: 24.80, mcapB: 15 },
      { name: 'Sui', symbol: 'SUI', mono: 'S', price: 4.86, mcapB: 14 },
      { name: 'Hyperliquid', symbol: 'HYPE', mono: 'H', price: 38.60, mcapB: 13 },
      { name: 'Polkadot', symbol: 'DOT', mono: 'P', price: 8.94, mcapB: 11 },
    ].sort(function (a, b) { return b.mcapB - a.mcapB; });

    var coins = coinDefs.map(function (c, i) {
      var change24 = (rand() - 0.42) * 8.5;
      var change7 = (rand() - 0.44) * 24;
      var volB = c.mcapB * (0.01 + rand() * 0.32);
      var barColor = change7 >= 0 ? '#1FC47C' : '#FF4757';
      var trendBars = [];
      for (var b = 0; b < 7; b++) {
        var h = 6 + rand() * 16;
        trendBars.push({ x: (b * 10).toFixed(1), y: (24 - h).toFixed(1), w: '7', h: h.toFixed(1), color: barColor });
      }
      var dec = c.price < 1 ? (c.price < 0.01 ? 6 : 4) : 2;
      return {
        rank: i + 1,
        name: c.name, symbol: c.symbol, mono: c.mono, color: hue(i),
        priceLabel: fmt$(c.price, dec),
        change24Label: (change24 >= 0 ? '▲ ' : '▼ ') + Math.abs(change24).toFixed(2) + '%',
        change24Style: 'color:' + (change24 >= 0 ? '#1FC47C' : '#FF4757') + ';font-weight:600;',
        change7Label: (change7 >= 0 ? '▲ ' : '▼ ') + Math.abs(change7).toFixed(2) + '%',
        change7Style: 'color:' + (change7 >= 0 ? '#1FC47C' : '#FF4757') + ';font-weight:600;',
        mcapLabel: fmtCompact$(c.mcapB * 1e9),
        volLabel: fmtCompact$(volB * 1e9),
        volPctLabel: ((volB / c.mcapB) * 100).toFixed(1) + '% mcap',
        trendBars: trendBars,
        _price: c.price, _change24: change24, _change7: change7,
      };
    });

    var trendingDefs = [
      { name: 'Aster', mono: 'A', price: 12.94, change: 17.2 },
      { name: 'Bitcoin', mono: 'B', price: coins[0]._price, change: coins[0]._change24 },
      { name: 'Solana', mono: 'S', price: coins.filter(function (c) { return c.symbol === 'SOL'; })[0]._price, change: coins.filter(function (c) { return c.symbol === 'SOL'; })[0]._change24 },
      { name: 'Jupiter', mono: 'J', price: 0.7840, change: 13.6 },
      { name: 'Pudgy Penguins', mono: 'P', price: 0.00641, change: 5.9 },
    ];
    var adaPrice = coins.filter(function (c) { return c.symbol === 'ADA'; })[0]._price;
    var gainersDefs = [
      { name: 'Plasma', mono: 'P', price: 1.284, change: 91.4 },
      { name: 'Stellar', mono: 'S', price: 0.2041, change: 16.8 },
      { name: 'Aptos', mono: 'A', price: 6.72, change: 12.1 },
      { name: 'Cardano', mono: 'A', price: adaPrice, change: 7.9 },
      { name: 'Bitcoin Cash', mono: 'B', price: 221.30, change: 6.4 },
    ];

    function mk(defs, offset) {
      return defs.map(function (d, i) {
        return {
          name: d.name, mono: d.mono, color: hue(i + offset),
          priceLabel: fmt$(d.price, d.price < 1 ? 4 : 2),
          changeLabel: (d.change >= 0 ? '+' : '') + d.change.toFixed(1) + '%',
          changeStyle: 'font-size:11px;font-weight:700;color:' + (d.change >= 0 ? '#1FC47C' : '#FF4757') + ';',
        };
      });
    }

    var sparkRng = rng(88123);
    function spark() {
      var v = 20;
      var pts = [];
      for (var i = 0; i < 20; i++) {
        v += (sparkRng() - 0.45) * 6;
        v = Math.max(4, Math.min(36, v));
        pts.push((i === 0 ? 'M' : 'L') + (i * 120 / 19).toFixed(1) + ',' + (40 - v).toFixed(1));
      }
      return pts.join(' ');
    }

    var totalMcap = 2.31e12;
    var totalVol = 91.4e9;
    var btc = coins[0];

    MARKETS_DATA = {
      totalMcap: totalMcap, totalVol: totalVol,
      mcapChange: 1.8, volChange: 6.2,
      btcDominance: 54.2,
      fearGreedValue: 62,
      marketCapSpark: spark(),
      volumeSpark: spark(),
      trending: mk(trendingDefs, 0),
      topGainers: mk(gainersDefs, 5),
      coins: coins,
      btcPrice: btc._price,
      ethPrice: coins.filter(function (c) { return c.symbol === 'ETH'; })[0]._price,
      btcMcapB: coinDefs.filter(function (c) { return c.symbol === 'BTC'; })[0].mcapB,
    };
  }

  function genNewsData() {
    var tagGradient = {
      Breaking: ['#FF5C00', '#3a1500'],
      Bitcoin: ['#F7931A', '#5a3400'],
      Ethereum: ['#7C8BF0', '#1c2560'],
      Solana: ['#9945FF', '#0f6b4a'],
      DeFi: ['#2A6FDB', '#0c2350'],
      Regulation: ['#7a7a72', '#1a1a1a'],
    };
    var tagMono = { Breaking: 'BRK', Bitcoin: 'BTC', Ethereum: 'ETH', Solana: 'SOL', DeFi: 'DFI', Regulation: 'REG' };

    var items = [
      { source: 'CHAINWIRE', time: '11m ago', tag: 'Bitcoin', title: 'Bitcoin Reclaims $71K as Rate-Cut Bets Firm Up', body: 'BTC bounced off a two-week low after softer jobs data revived hopes the Fed’s tightening cycle is done.' },
      { source: 'ONCHAIN DAILY', time: '24m ago', tag: 'Ethereum', title: 'Ethereum Foundation Backs New Institutional Custody Standard', body: 'The proposal aims to give banks and asset managers a common framework for holding ETH and staked derivatives.' },
      { source: 'LEDGER REPORT', time: '38m ago', tag: 'Solana', title: 'Solana Validators Approve Fee Market Upgrade Ahead of Mainnet', body: 'The change introduces localized fee markets meant to curb congestion during high-demand token launches.' },
      { source: 'BLOCK WIRE', time: '52m ago', tag: 'Regulation', title: 'Stablecoin Issuers Face New Reserve Disclosure Rules in EU', body: 'Issuers operating in the bloc will need to publish monthly attestations starting next quarter.' },
      { source: 'DEPIN TIMES', time: '1h ago', tag: 'DeFi', title: 'DeFi Lending TVL Crosses $140B as Rates Compress', body: 'Falling borrow rates across major money markets haven’t slowed deposit growth, data shows.' },
      { source: 'CHAINWIRE', time: '1h ago', tag: 'Breaking', title: 'Perp DEX Volumes Hit Record as Builder Codes Proliferate', body: 'Builder-fee programs are pulling volume away from centralized venues at the fastest pace this year.' },
      { source: 'ONCHAIN DAILY', time: '2h ago', tag: 'Breaking', title: 'Major Exchange Adds Native HyperEVM Deposit Support', body: 'The integration lets users bridge directly into perp collateral without leaving their wallet of choice.' },
      { source: 'LEDGER REPORT', time: '2h ago', tag: 'Bitcoin', title: 'Bitcoin Miners Report Lowest Hashprice in Six Months', body: 'Thinner margins are pushing smaller operators to renegotiate power contracts or shut down rigs.' },
      { source: 'BLOCK WIRE', time: '3h ago', tag: 'Ethereum', title: 'Layer-2 Bridges See Renewed Inflows After Fee Cuts', body: 'Sequencer fee reductions across two major rollups coincided with a jump in weekly bridge deposits.' },
      { source: 'DEPIN TIMES', time: '4h ago', tag: 'Regulation', title: 'Regulators Signal Lighter Touch on Spot Token ETFs', body: 'Comments from a senior official suggest a faster review timeline for pending spot-asset filings.' },
    ].map(function (n, i) {
      return {
        source: n.source, time: n.time, tag: n.tag, title: n.title, body: n.body,
        gradA: tagGradient[n.tag][0], gradB: tagGradient[n.tag][1],
        mono: tagMono[n.tag],
      };
    });

    NEWS_DATA = { items: items };
  }

  /* ══════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════ */
  var STATE = {
    page: 'terminal',
    timeframe: '1H',
    side: 'long',
    orderType: 'market',
    collateral: '500',
    limitPrice: '65000',
    leverage: 10,
    bottomTab: 'positions',
    pnlRange: '30D',
    calendarOpen: false,
    calendarMonthOffset: 0,
    convAmount: '1',
    convDirection: 'toUsd',
    newsFilter: 'All',
  };

  function root() { return document.getElementById('fundamentalsRoot'); }

  /* ══════════════════════════════════════════════════════════
     HEADER
     ══════════════════════════════════════════════════════ */
  function renderHeader() {
    var m = MARKET;
    var isTerminal = STATE.page === 'terminal';
    var isPnl = STATE.page === 'pnl';
    var isMarkets = STATE.page === 'markets';
    var isNews = STATE.page === 'news';
    var changeColor = m.changePct >= 0 ? '#1FC47C' : '#FF4757';

    return (
      '<div style="height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:#0F0F0F;border-bottom:1px solid rgba(255,255,255,0.07);">' +
        '<div style="display:flex;align-items:center;gap:26px;">' +
          '<div style="display:flex;align-items:center;gap:9px;">' +
            '<div style="width:7px;height:7px;border-radius:50%;background:' + ACCENT + ';animation:rdoPulse 2s ease-in-out infinite;"></div>' +
            '<span style="font:800 15px \'JetBrains Mono\',monospace;letter-spacing:2px;color:#F5F1EA;">RDO<span style="color:' + ACCENT + ';">ONE</span></span>' +
          '</div>' +
          '<nav style="display:flex;gap:4px;">' +
            '<button onclick="window.rdoGoPage(\'terminal\')" style="' + styleStr(navBtn(isTerminal)) + '">TERMINAL</button>' +
            '<button onclick="window.rdoGoPage(\'pnl\')" style="' + styleStr(navBtn(isPnl)) + '">PNL</button>' +
            '<button onclick="window.rdoGoPage(\'markets\')" style="' + styleStr(navBtn(isMarkets)) + '">MARKETS</button>' +
            '<button onclick="window.rdoGoPage(\'news\')" style="' + styleStr(navBtn(isNews)) + '">NEWS</button>' +
          '</nav>' +
        '</div>' +
        (isTerminal ?
        '<div style="display:flex;align-items:center;gap:20px;">' +
          '<div style="display:flex;align-items:center;gap:7px;padding:6px 10px;background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:4px;cursor:pointer;">' +
            '<span style="width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#F7931A,#FFC26E);display:inline-block;flex-shrink:0;"></span>' +
            '<span style="color:#F5F1EA;font-size:12px;font-weight:700;">BTC-PERP</span>' +
            '<span style="color:#55554e;font-size:8px;">&#9662;</span>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:1px;"><span style="color:#55554e;font-size:8.5px;letter-spacing:1px;">MARK</span><span style="color:#F5F1EA;font-size:14px;font-weight:700;">' + fmt$(m.markPrice, 1) + '</span></div>' +
          '<div style="display:flex;flex-direction:column;gap:1px;"><span style="color:#55554e;font-size:8.5px;letter-spacing:1px;">24H CHG</span><span style="font-size:12px;font-weight:700;color:' + changeColor + ';">' + (m.changePct >= 0 ? '+' : '') + m.changePct.toFixed(2) + '%</span></div>' +
          '<div style="display:flex;flex-direction:column;gap:1px;"><span style="color:#55554e;font-size:8.5px;letter-spacing:1px;">24H VOL</span><span style="color:#a8a89f;font-size:11px;">$1.24B</span></div>' +
          '<div style="display:flex;flex-direction:column;gap:1px;"><span style="color:#55554e;font-size:8.5px;letter-spacing:1px;">OPEN INT</span><span style="color:#a8a89f;font-size:11px;">$412.6M</span></div>' +
          '<div style="display:flex;flex-direction:column;gap:1px;"><span style="color:#55554e;font-size:8.5px;letter-spacing:1px;">FUNDING 1H</span><span style="color:#1FC47C;font-size:11px;">+0.0021%</span></div>' +
        '</div>' : '') +
        '<div style="display:flex;align-items:center;gap:10px;margin-left:' + (isTerminal ? '0' : 'auto') + ';">' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;"><span style="color:#55554e;font-size:8.5px;letter-spacing:1px;">BALANCE</span><span style="color:#F5F1EA;font-size:12px;">' + (WALLET.address ? fmt$(currentBalance(), 2) : '—') + '</span></div>' +
          '<button style="font:700 10px \'JetBrains Mono\',monospace;letter-spacing:1.5px;padding:8px 14px;background:' + ACCENT + ';border:none;border-radius:3px;color:#0A0A0A;cursor:pointer;">DEPOSIT</button>' +
          '<button onclick="window.rdoConnectWallet()" style="font:700 10px \'JetBrains Mono\',monospace;letter-spacing:1.5px;padding:8px 14px;background:transparent;border:1px solid rgba(255,92,0,0.4);border-radius:3px;color:' + ACCENT + ';cursor:pointer;">' + (WALLET.connecting ? 'CONNECTING…' : (WALLET.address ? (WALLET.address.slice(0, 6) + '...' + WALLET.address.slice(-4)) : 'CONNECT WALLET')) + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  window.rdoGoPage = function (p) { STATE.page = p; render(); };

  /* ══════════════════════════════════════════════════════════
     TERMINAL PAGE — chart column
     ══════════════════════════════════════════════════════ */
  function renderChartColumn() {
    var m = MARKET;
    var gridLines = m.priceGridLines.map(function (g) {
      return '<line x1="0" y1="' + g.y + '" x2="1136" y2="' + g.y + '" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>' +
        '<text x="1144" y="' + g.yLabel + '" fill="#55554e" font-size="15" font-family="\'JetBrains Mono\',monospace">' + g.label + '</text>';
    }).join('');
    var candlesHtml = m.candles.map(function (c) {
      return '<line x1="' + c.wickX + '" y1="' + c.wickY1 + '" x2="' + c.wickX + '" y2="' + c.wickY2 + '" stroke="' + c.color + '" stroke-width="1.4"/>' +
        '<rect x="' + c.bodyX + '" y="' + c.bodyY + '" width="' + c.bodyW + '" height="' + c.bodyH + '" fill="' + c.color + '"/>';
    }).join('');
    var volHtml = m.volumeBars.map(function (v) {
      return '<rect x="' + v.x + '" y="' + v.y + '" width="' + v.w + '" height="' + v.h + '" fill="' + v.color + '"/>';
    }).join('');
    var tfDefs = ['1m', '5m', '15m', '1H', '4H', '1D'];
    var tfHtml = tfDefs.map(function (tf) {
      return '<button onclick="window.rdoSetTimeframe(this,\'' + tf + '\')" style="' + styleStr(smallTab(STATE.timeframe === tf)) + '">' + tf + '</button>';
    }).join('');

    return (
      '<div style="flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid rgba(255,255,255,0.07);">' +
        '<div style="height:38px;flex-shrink:0;display:flex;align-items:center;gap:4px;padding:0 12px;border-bottom:1px solid rgba(255,255,255,0.06);">' + tfHtml + '<div style="flex:1;"></div><span style="color:#4a4a45;font-size:9.5px;letter-spacing:1px;">VOL &middot; RSI(14)</span></div>' +
        '<div style="flex:2.4;min-height:0;position:relative;">' +
          '<svg viewBox="0 0 1200 460" preserveAspectRatio="none" width="100%" height="100%" style="display:block;">' +
            gridLines +
            '<line x1="0" y1="' + m.lastPriceY + '" x2="1136" y2="' + m.lastPriceY + '" stroke="' + ACCENT + '" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>' +
            '<text x="1144" y="' + (parseFloat(m.lastPriceY) + 4).toFixed(2) + '" fill="' + ACCENT + '" font-size="15" font-weight="700" font-family="\'JetBrains Mono\',monospace">' + fmt$(m.markPrice, 0) + '</text>' +
            candlesHtml +
          '</svg>' +
        '</div>' +
        '<div style="flex:0.55;min-height:0;border-top:1px solid rgba(255,255,255,0.05);"><svg viewBox="0 0 1200 92" preserveAspectRatio="none" width="100%" height="100%" style="display:block;">' + volHtml + '</svg></div>' +
        '<div style="flex:0.5;min-height:0;border-top:1px solid rgba(255,255,255,0.05);position:relative;">' +
          '<span style="position:absolute;top:3px;left:8px;color:#4a4a45;font-size:9px;letter-spacing:1px;z-index:1;">RSI 14</span>' +
          '<svg viewBox="0 0 1200 70" preserveAspectRatio="none" width="100%" height="100%" style="display:block;">' +
            '<line x1="0" y1="23" x2="1200" y2="23" stroke="rgba(255,71,87,0.25)" stroke-width="1" stroke-dasharray="3,3"/>' +
            '<line x1="0" y1="47" x2="1200" y2="47" stroke="rgba(31,196,124,0.25)" stroke-width="1" stroke-dasharray="3,3"/>' +
            '<path d="' + m.rsiPath + '" fill="none" stroke="#8a8ade" stroke-width="1.6"/>' +
          '</svg>' +
        '</div>' +
      '</div>'
    );
  }

  window.rdoSetTimeframe = function (el, tf) {
    STATE.timeframe = tf;
    var bar = el.parentElement;
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
      b.setAttribute('style', styleStr(smallTab(false)));
    });
    el.setAttribute('style', styleStr(smallTab(true)));
  };

  /* ── order book column ── */
  function renderOrderBookColumn() {
    var m = MARKET;
    function rowHtml(entry, barColor, priceColor) {
      return '<div style="position:relative;display:flex;padding:4.5px 6px;font-size:10.5px;">' +
        '<div style="position:absolute;right:0;top:0;bottom:0;width:' + entry.barPct + ';background:' + barColor + ';"></div>' +
        '<span style="flex:1;color:' + priceColor + ';position:relative;">' + entry.price + '</span>' +
        '<span style="flex:1;text-align:right;color:#a8a89f;position:relative;">' + entry.size + '</span>' +
        '<span style="flex:1;text-align:right;color:#6b6b63;position:relative;">' + entry.total + '</span>' +
      '</div>';
    }
    var asksHtml = m.asks.map(function (a) { return rowHtml(a, 'rgba(255,71,87,0.09)', '#FF4757'); }).join('');
    var bidsHtml = m.bids.map(function (b) { return rowHtml(b, 'rgba(31,196,124,0.09)', '#1FC47C'); }).join('');
    return (
      '<div style="width:290px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,0.07);overflow:hidden;">' +
        '<div style="height:38px;flex-shrink:0;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;">ORDER BOOK</span></div>' +
        '<div style="display:flex;padding:6px 12px 4px;color:#4a4a45;font-size:9px;letter-spacing:0.5px;"><span style="flex:1;">PRICE</span><span style="flex:1;text-align:right;">SIZE</span><span style="flex:1;text-align:right;">TOTAL</span></div>' +
        '<div style="flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:0 6px;">' + asksHtml + '</div>' +
        '<div style="padding:8px 12px;text-align:center;background:#111;border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:' + ACCENT + ';font-size:12px;font-weight:700;">' + fmt$(m.markPrice, 1) + '</span><span style="color:#4a4a45;font-size:9px;margin-left:8px;">SPREAD $' + m.spread.toFixed(1) + '</span></div>' +
        '<div style="flex:1;overflow:hidden;padding:0 6px;">' + bidsHtml + '</div>' +
      '</div>'
    );
  }

  /* ── trade panel ── */
  function computeTradeStats() {
    var isLong = STATE.side === 'long';
    var isLimit = STATE.orderType === 'limit';
    var collateral = parseFloat(STATE.collateral) || 0;
    var leverage = STATE.leverage;
    var size = collateral * leverage;
    var price = isLimit ? (parseFloat(STATE.limitPrice) || MARKET.markPrice) : MARKET.markPrice;
    var liqMove = Math.min(0.92, 0.9 / leverage);
    var liqPrice = isLong ? price * (1 - liqMove) : price * (1 + liqMove);
    var fee = size * 0.001;
    return { isLong: isLong, isLimit: isLimit, collateral: collateral, leverage: leverage, size: size, price: price, liqPrice: liqPrice, fee: fee };
  }

  function renderTradePanelInner() {
    var st = computeTradeStats();
    var submitBg = st.isLong ? '#1FC47C' : '#FF4757';
    var submitLabel = (st.isLong ? 'OPEN LONG' : 'OPEN SHORT') + ' BTC-PERP';

    return (
      '<div style="display:flex;gap:6px;">' +
        '<button onclick="window.rdoSetSide(\'long\')" style="' + styleStr(pillBtn(st.isLong, '#1FC47C')) + '">LONG</button>' +
        '<button onclick="window.rdoSetSide(\'short\')" style="' + styleStr(pillBtn(!st.isLong, '#FF4757')) + '">SHORT</button>' +
      '</div>' +
      '<div style="display:flex;gap:4px;border-bottom:1px solid rgba(255,255,255,0.07);padding-bottom:10px;">' +
        '<button onclick="window.rdoSetOrderType(\'market\')" style="' + styleStr(smallTab(!st.isLimit)) + '">MARKET</button>' +
        '<button onclick="window.rdoSetOrderType(\'limit\')" style="' + styleStr(smallTab(st.isLimit)) + '">LIMIT</button>' +
      '</div>' +
      (st.isLimit ?
        '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#6b6b63;font-size:9.5px;letter-spacing:1px;">LIMIT PRICE</span></div>' +
          '<input type="text" id="limitPriceInput" value="' + escAttr(STATE.limitPrice) + '" oninput="window.rdoOnLimitPriceInput(this.value)" style="width:100%;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#F5F1EA;font-family:\'JetBrains Mono\',monospace;font-size:13px;padding:10px 12px;outline:none;"/>' +
        '</div>' : '') +
      '<div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#6b6b63;font-size:9.5px;letter-spacing:1px;">COLLATERAL (USDC)</span><span style="color:#6b6b63;font-size:9.5px;">AVAIL ' + (WALLET.address ? fmt$(currentBalance(), 2) : '— connect wallet') + '</span></div>' +
        '<div style="position:relative;">' +
          '<input type="text" inputmode="decimal" id="collateralInput" value="' + escAttr(STATE.collateral) + '" oninput="window.rdoOnCollateralInput(this.value)" style="width:100%;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#F5F1EA;font-family:\'JetBrains Mono\',monospace;font-size:13px;padding:10px 46px 10px 12px;outline:none;"/>' +
          '<button onclick="window.rdoOnMaxCollateral()" style="position:absolute;right:6px;top:6px;bottom:6px;padding:0 8px;background:rgba(255,255,255,0.06);border:none;border-radius:3px;color:#a8a89f;font-size:9px;font-weight:700;letter-spacing:0.5px;cursor:pointer;">MAX</button>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#6b6b63;font-size:9.5px;letter-spacing:1px;">LEVERAGE</span><span id="levLabel" style="color:' + ACCENT + ';font-size:11px;font-weight:700;">' + st.leverage + 'x</span></div>' +
        '<input type="range" min="1" max="50" value="' + st.leverage + '" oninput="window.rdoOnLeverageInput(this.value)" style="width:100%;"/>' +
        '<div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="color:#4a4a45;font-size:9px;">1x</span><span style="color:#4a4a45;font-size:9px;">10x</span><span style="color:#4a4a45;font-size:9px;">25x</span><span style="color:#4a4a45;font-size:9px;">50x</span></div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:7px;padding:12px;background:#111;border:1px solid rgba(255,255,255,0.06);border-radius:4px;">' +
        '<div style="display:flex;justify-content:space-between;"><span style="color:#6b6b63;font-size:10.5px;">Position Size</span><span id="statSize" style="color:#c9c9c0;font-size:11px;">' + fmt$(st.size, 0) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;"><span style="color:#6b6b63;font-size:10.5px;">Liquidation Price</span><span id="statLiq" style="color:#c9c9c0;font-size:11px;">' + fmt$(st.liqPrice, st.liqPrice < 1000 ? 2 : 0) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;"><span style="color:#6b6b63;font-size:10.5px;">Margin Required</span><span id="statMargin" style="color:#c9c9c0;font-size:11px;">' + fmt$(st.collateral, 2) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;"><span style="color:#6b6b63;font-size:10.5px;">Est. Fee (0.10%)</span><span id="statFee" style="color:#c9c9c0;font-size:11px;">' + fmt$(st.fee, 2) + '</span></div>' +
      '</div>' +
      '<button id="submitBtn" onclick="' + (WALLET.address ? 'window.rdoSubmitOrder()' : 'window.rdoConnectWallet()') + '" style="width:100%;padding:13px;background:' + submitBg + ';border:none;border-radius:4px;color:#0A0A0A;font-family:\'JetBrains Mono\',monospace;font-size:11.5px;font-weight:700;letter-spacing:1.5px;cursor:pointer;">' + (WALLET.address ? submitLabel : 'CONNECT WALLET TO TRADE') + '</button>'
    );
  }

  function renderTradePanel() {
    var elp = document.getElementById('tradePanelRoot');
    if (elp) elp.innerHTML = renderTradePanelInner();
  }

  function updateTradeStats() {
    var st = computeTradeStats();
    var sizeEl = document.getElementById('statSize');
    var liqEl = document.getElementById('statLiq');
    var marginEl = document.getElementById('statMargin');
    var feeEl = document.getElementById('statFee');
    if (sizeEl) sizeEl.textContent = fmt$(st.size, 0);
    if (liqEl) liqEl.textContent = fmt$(st.liqPrice, st.liqPrice < 1000 ? 2 : 0);
    if (marginEl) marginEl.textContent = fmt$(st.collateral, 2);
    if (feeEl) feeEl.textContent = fmt$(st.fee, 2);
  }

  window.rdoSetSide = function (side) { STATE.side = side; renderTradePanel(); };
  window.rdoSetOrderType = function (t) { STATE.orderType = t; renderTradePanel(); };
  window.rdoOnCollateralInput = function (v) { STATE.collateral = v; updateTradeStats(); };
  window.rdoOnLimitPriceInput = function (v) { STATE.limitPrice = v; updateTradeStats(); };
  window.rdoOnMaxCollateral = function () {
    STATE.collateral = currentBalance().toFixed(2);
    var inp = document.getElementById('collateralInput');
    if (inp) inp.value = STATE.collateral;
    updateTradeStats();
  };
  window.rdoOnLeverageInput = function (v) {
    STATE.leverage = parseInt(v, 10) || 1;
    var lbl = document.getElementById('levLabel');
    if (lbl) lbl.textContent = STATE.leverage + 'x';
    updateTradeStats();
  };

  /* ── bottom panel: real positions / open orders / trade history from Hyperliquid ── */
  function emptyStateRow(colSpan, text) {
    return '<tr><td colspan="' + colSpan + '" style="padding:24px 14px;text-align:center;color:#4a4a45;font-size:11px;">' + text + '</td></tr>';
  }

  function renderBottomPanelInner() {
    var tabDefs = [
      { key: 'positions', label: 'POSITIONS (' + ACCOUNT.positions.length + ')' },
      { key: 'orders', label: 'OPEN ORDERS (' + ACCOUNT.openOrders.length + ')' },
      { key: 'history', label: 'TRADE HISTORY' },
    ];
    var tabsHtml = tabDefs.map(function (bt) {
      return '<button onclick="window.rdoSetBottomTab(\'' + bt.key + '\')" style="' + styleStr(smallTab(STATE.bottomTab === bt.key)) + '">' + bt.label + '</button>';
    }).join('');

    var notConnected = !WALLET.address;
    var body;
    if (STATE.bottomTab === 'positions') {
      var rows = notConnected ? emptyStateRow(8, 'Connect your wallet to see open positions')
        : (ACCOUNT.positions.length ? ACCOUNT.positions.map(function (p) {
          return '<tr style="border-top:1px solid rgba(255,255,255,0.05);">' +
            '<td style="padding:9px 14px;color:#F5F1EA;font-weight:700;">' + p.market + '<span style="margin-left:6px;font-size:9.5px;font-weight:700;color:' + p.sideColor + ';">' + p.sideLabel + '</span></td>' +
            '<td style="padding:9px 14px;color:#c9c9c0;">' + p.size + '</td>' +
            '<td style="padding:9px 14px;color:#c9c9c0;">' + p.entry + '</td>' +
            '<td style="padding:9px 14px;color:#c9c9c0;">' + p.mark + '</td>' +
            '<td style="padding:9px 14px;color:' + p.pnlColor + ';font-weight:700;">' + p.pnlLabel + '</td>' +
            '<td style="padding:9px 14px;color:#8a8a82;">' + p.liq + '</td>' +
            '<td style="padding:9px 14px;color:#8a8a82;">' + p.margin + '</td>' +
            '<td style="padding:9px 14px;"><button onclick="window.rdoClosePosition(\'' + p.coin + '\',' + p.isLong + ',' + p.sizeAbs + ')" style="background:transparent;border:1px solid rgba(255,255,255,0.12);color:#8a8a82;font-size:9px;letter-spacing:1px;padding:5px 10px;border-radius:3px;cursor:pointer;">CLOSE</button></td>' +
          '</tr>';
        }).join('') : emptyStateRow(8, 'No open positions'));
      body = '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:#4a4a45;font-size:9px;letter-spacing:0.5px;text-align:left;">' +
        '<th style="font-weight:600;padding:8px 14px;">MARKET</th><th style="font-weight:600;padding:8px 14px;">SIZE</th><th style="font-weight:600;padding:8px 14px;">ENTRY</th><th style="font-weight:600;padding:8px 14px;">MARK</th><th style="font-weight:600;padding:8px 14px;">PNL</th><th style="font-weight:600;padding:8px 14px;">LIQ.</th><th style="font-weight:600;padding:8px 14px;">MARGIN</th><th style="padding:8px 14px;"></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>';
    } else if (STATE.bottomTab === 'orders') {
      var orows = notConnected ? emptyStateRow(6, 'Connect your wallet to see open orders')
        : (ACCOUNT.openOrders.length ? ACCOUNT.openOrders.map(function (o) {
          return '<tr style="border-top:1px solid rgba(255,255,255,0.05);">' +
            '<td style="padding:9px 14px;color:#F5F1EA;font-weight:700;">' + o.market + '</td>' +
            '<td style="padding:9px 14px;color:#8a8a82;">' + o.typeLabel + '</td>' +
            '<td style="padding:9px 14px;color:' + o.sideColor + ';font-weight:700;">' + o.sideLabel + '</td>' +
            '<td style="padding:9px 14px;color:#c9c9c0;">' + o.price + '</td>' +
            '<td style="padding:9px 14px;color:#c9c9c0;">' + o.size + '</td>' +
            '<td style="padding:9px 14px;"><button style="background:transparent;border:1px solid rgba(255,255,255,0.12);color:#8a8a82;font-size:9px;letter-spacing:1px;padding:5px 10px;border-radius:3px;cursor:pointer;">CANCEL</button></td>' +
          '</tr>';
        }).join('') : emptyStateRow(6, 'No open orders'));
      body = '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:#4a4a45;font-size:9px;letter-spacing:0.5px;text-align:left;">' +
        '<th style="font-weight:600;padding:8px 14px;">MARKET</th><th style="font-weight:600;padding:8px 14px;">TYPE</th><th style="font-weight:600;padding:8px 14px;">SIDE</th><th style="font-weight:600;padding:8px 14px;">PRICE</th><th style="font-weight:600;padding:8px 14px;">SIZE</th><th style="padding:8px 14px;"></th>' +
        '</tr></thead><tbody>' + orows + '</tbody></table>';
    } else {
      var frows = notConnected ? emptyStateRow(6, 'Connect your wallet to see trade history')
        : (ACCOUNT.fills.length ? ACCOUNT.fills.map(function (f) {
          return '<tr style="border-top:1px solid rgba(255,255,255,0.05);">' +
            '<td style="padding:9px 14px;color:#6b6b63;">' + f.time + '</td>' +
            '<td style="padding:9px 14px;color:#F5F1EA;font-weight:700;">' + f.market + '</td>' +
            '<td style="padding:9px 14px;color:' + f.sideColor + ';font-weight:700;">' + f.sideLabel + '</td>' +
            '<td style="padding:9px 14px;color:#c9c9c0;">' + f.price + '</td>' +
            '<td style="padding:9px 14px;color:#c9c9c0;">' + f.size + '</td>' +
            '<td style="padding:9px 14px;color:#6b6b63;">' + f.fee + '</td>' +
          '</tr>';
        }).join('') : emptyStateRow(6, 'No trade history yet'));
      body = '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:#4a4a45;font-size:9px;letter-spacing:0.5px;text-align:left;">' +
        '<th style="font-weight:600;padding:8px 14px;">TIME</th><th style="font-weight:600;padding:8px 14px;">MARKET</th><th style="font-weight:600;padding:8px 14px;">SIDE</th><th style="font-weight:600;padding:8px 14px;">PRICE</th><th style="font-weight:600;padding:8px 14px;">SIZE</th><th style="font-weight:600;padding:8px 14px;">FEE</th>' +
        '</tr></thead><tbody>' + frows + '</tbody></table>';
    }

    return '<div style="height:36px;flex-shrink:0;display:flex;align-items:center;gap:4px;padding:0 12px;border-bottom:1px solid rgba(255,255,255,0.06);">' + tabsHtml + '</div>' +
      '<div style="flex:1;overflow-y:auto;">' + body + '</div>';
  }

  window.rdoSetBottomTab = function (key) {
    STATE.bottomTab = key;
    var elp = document.getElementById('bottomPanelRoot');
    if (elp) elp.innerHTML = renderBottomPanelInner();
  };

  function renderTerminalPage() {
    return (
      '<div style="flex:1;display:flex;flex-direction:column;min-height:0;">' +
        '<div style="flex:1;display:flex;min-height:0;">' +
          renderChartColumn() +
          renderOrderBookColumn() +
          '<div id="tradePanelRoot" style="width:320px;flex-shrink:0;display:flex;flex-direction:column;padding:16px;gap:14px;overflow-y:auto;">' + renderTradePanelInner() + '</div>' +
        '</div>' +
        '<div style="height:250px;flex-shrink:0;border-top:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;background:#0c0c0c;">' +
          '<div id="bottomPanelRoot" style="display:flex;flex-direction:column;flex:1;min-height:0;">' + renderBottomPanelInner() + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ══════════════════════════════════════════════════════════
     PNL PAGE
     ══════════════════════════════════════════════════════ */
  function renderPnlPage() {
    var p = PNL;
    var rangeDefs = ['24H', '7D', '30D', 'ALL'];
    var rangeTabsHtml = rangeDefs.map(function (r) {
      return '<button onclick="window.rdoSetPnlRange(\'' + r + '\')" style="' + styleStr(smallTab(STATE.pnlRange === r)) + '">' + r + '</button>';
    }).join('');

    var maxBucketPct = Math.max.apply(null, p.distBuckets.map(function (b) { return b.pct; }));
    var distHtml = p.distBuckets.map(function (b) {
      var barColor = (b.label.indexOf('-') === 0 || b.label.indexOf('<') === 0) ? '#FF4757' : (b.label === '0% to +50%' ? '#8a8a3f' : '#1FC47C');
      var barWidth = ((b.pct / maxBucketPct) * 100).toFixed(0) + '%';
      return '<div style="display:flex;flex-direction:column;gap:4px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:10.5px;"><span style="color:#a8a89f;">' + b.label + '</span><span style="color:#6b6b63;">' + b.count + ' &middot; ' + b.pct.toFixed(1) + '%</span></div>' +
        '<div style="height:6px;background:#1a1a1a;border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + barWidth + ';background:' + barColor + ';"></div></div>' +
      '</div>';
    }).join('');

    var historyRows = p.history.map(function (h) {
      var sideColor = h.isLong ? '#1FC47C' : '#FF4757';
      var pnlColor = h.pnl >= 0 ? '#1FC47C' : '#FF4757';
      var entryDec = h.entry < 0.01 ? 7 : (h.entry < 1 ? 4 : 2);
      var exitDec = h.exit < 0.01 ? 7 : (h.exit < 1 ? 4 : 2);
      return '<tr style="border-top:1px solid rgba(255,255,255,0.05);">' +
        '<td style="padding:10px 16px;color:#F5F1EA;font-weight:700;">' + h.token + '</td>' +
        '<td style="padding:10px 16px;color:' + sideColor + ';font-weight:700;">' + (h.isLong ? 'LONG' : 'SHORT') + '</td>' +
        '<td style="padding:10px 16px;color:#a8a89f;">' + fmt$(h.entry, entryDec) + '</td>' +
        '<td style="padding:10px 16px;color:#a8a89f;">' + fmt$(h.exit, exitDec) + '</td>' +
        '<td style="padding:10px 16px;color:#a8a89f;">' + fmt$(h.size, 0) + '</td>' +
        '<td style="padding:10px 16px;color:' + pnlColor + ';font-weight:700;">' + fmtSigned$(h.pnl, 2) + ' <span style="opacity:0.6;">(' + (h.pnlPct >= 0 ? '+' : '') + h.pnlPct.toFixed(1) + '%)</span></td>' +
        '<td style="padding:10px 16px;color:#6b6b63;">' + h.hold + '</td>' +
        '<td style="padding:10px 16px;color:#6b6b63;">' + h.date + '</td>' +
      '</tr>';
    }).join('');

    return (
      '<div style="flex:1;overflow-y:auto;padding:26px 30px 60px;">' +
        '<div style="display:flex;gap:26px;max-width:1440px;margin:0 auto;">' +
          '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:22px;">' +

            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<div><div style="color:#F5F1EA;font-size:18px;font-weight:800;letter-spacing:0.5px;">TRADER PNL</div><div style="color:#6b6b63;font-size:11px;margin-top:3px;">0x74A9...9F2C</div></div>' +
              '<div style="display:flex;gap:8px;align-items:center;">' +
                '<button onclick="window.rdoOpenCalendar()" style="padding:7px 14px;background:transparent;border:1px solid rgba(255,255,255,0.14);border-radius:3px;color:#a8a89f;font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:1px;cursor:pointer;font-weight:700;">PNL CALENDAR</button>' +
                '<div style="display:flex;gap:4px;">' + rangeTabsHtml + '</div>' +
              '</div>' +
            '</div>' +

            '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;">' +
              '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:14px;"><div style="color:#6b6b63;font-size:9px;letter-spacing:1px;margin-bottom:8px;">TOTAL REALIZED PNL</div><div style="font-size:20px;font-weight:800;color:#1FC47C;">' + fmtSigned$(48320.55, 2) + '</div></div>' +
              '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:14px;"><div style="color:#6b6b63;font-size:9px;letter-spacing:1px;margin-bottom:8px;">WIN RATE</div><div style="color:#F5F1EA;font-size:20px;font-weight:800;">63.4%</div><div style="color:#55554e;font-size:9.5px;margin-top:3px;">180W / 104L</div></div>' +
              '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:14px;"><div style="color:#6b6b63;font-size:9px;letter-spacing:1px;margin-bottom:8px;">TOTAL TRADES</div><div style="color:#F5F1EA;font-size:20px;font-weight:800;">284</div></div>' +
              '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:14px;"><div style="color:#6b6b63;font-size:9px;letter-spacing:1px;margin-bottom:8px;">AVG HOLD TIME</div><div style="color:#F5F1EA;font-size:20px;font-weight:800;">4h 12m</div></div>' +
              '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:14px;"><div style="color:#6b6b63;font-size:9px;letter-spacing:1px;margin-bottom:8px;">BEST TRADE</div><div style="color:#1FC47C;font-size:20px;font-weight:800;">+412.8%</div></div>' +
              '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:14px;"><div style="color:#6b6b63;font-size:9px;letter-spacing:1px;margin-bottom:8px;">WORST TRADE</div><div style="color:#FF4757;font-size:20px;font-weight:800;">-71.2%</div></div>' +
            '</div>' +

            '<div style="display:flex;gap:16px;">' +
              '<div style="flex:1.3;background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;">' +
                '<div style="color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;margin-bottom:12px;">CUMULATIVE PNL &middot; ' + STATE.pnlRange + '</div>' +
                '<svg viewBox="0 0 1100 260" preserveAspectRatio="none" width="100%" height="220" style="display:block;">' +
                  '<line x1="0" y1="' + p.cumZeroY + '" x2="1100" y2="' + p.cumZeroY + '" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="3,3"/>' +
                  '<path d="' + p.cumArea + '" fill="' + ACCENT + '22"/>' +
                  '<path d="' + p.cumPath + '" fill="none" stroke="' + ACCENT + '" stroke-width="2.2"/>' +
                '</svg>' +
              '</div>' +
              '<div style="flex:1;background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;display:flex;flex-direction:column;gap:10px;">' +
                '<div style="color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;">PNL DISTRIBUTION</div>' + distHtml +
              '</div>' +
            '</div>' +

            '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;overflow:hidden;">' +
              '<div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;">RECENT CLOSED TRADES</div>' +
              '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:#4a4a45;font-size:9px;letter-spacing:0.5px;text-align:left;">' +
                '<th style="font-weight:600;padding:9px 16px;">TOKEN</th><th style="font-weight:600;padding:9px 16px;">SIDE</th><th style="font-weight:600;padding:9px 16px;">ENTRY</th><th style="font-weight:600;padding:9px 16px;">EXIT</th><th style="font-weight:600;padding:9px 16px;">SIZE</th><th style="font-weight:600;padding:9px 16px;">PNL</th><th style="font-weight:600;padding:9px 16px;">HOLD</th><th style="font-weight:600;padding:9px 16px;">CLOSED</th>' +
              '</tr></thead><tbody>' + historyRows + '</tbody></table>' +
            '</div>' +

          '</div>' +

          '<div style="width:300px;flex-shrink:0;">' +
            '<div style="position:sticky;top:0;display:flex;flex-direction:column;gap:14px;">' +
              '<div style="border-radius:10px;padding:22px;background:linear-gradient(160deg,#161311 0%,#0c0c0c 65%);border:1px solid rgba(255,92,0,0.25);display:flex;flex-direction:column;gap:16px;position:relative;overflow:hidden;">' +
                '<div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;background:' + ACCENT + ';opacity:0.10;"></div>' +
                '<div style="display:flex;align-items:center;gap:7px;"><div style="width:6px;height:6px;border-radius:50%;background:' + ACCENT + ';"></div><span style="font:800 12px \'JetBrains Mono\',monospace;letter-spacing:2px;color:#F5F1EA;">RDO<span style="color:' + ACCENT + ';">ONE</span></span></div>' +
                '<div><div style="color:#6b6b63;font-size:9px;letter-spacing:1px;margin-bottom:6px;">0x74A9...9F2C</div><div style="font-size:26px;font-weight:800;color:#1FC47C;">' + fmtSigned$(48320.55, 2) + '</div><div style="color:#55554e;font-size:9.5px;margin-top:4px;">ALL-TIME REALIZED PNL</div></div>' +
                '<svg viewBox="0 0 260 60" width="100%" height="50" preserveAspectRatio="none" style="display:block;"><path d="' + p.sparkPath + '" fill="none" stroke="' + ACCENT + '" stroke-width="2.2"/></svg>' +
                '<div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;">' +
                  '<div><div style="color:#55554e;font-size:8.5px;letter-spacing:1px;">WIN RATE</div><div style="color:#F5F1EA;font-size:14px;font-weight:700;margin-top:3px;">63.4%</div></div>' +
                  '<div><div style="color:#55554e;font-size:8.5px;letter-spacing:1px;">TRADES</div><div style="color:#F5F1EA;font-size:14px;font-weight:700;margin-top:3px;">284</div></div>' +
                  '<div><div style="color:#55554e;font-size:8.5px;letter-spacing:1px;">BEST</div><div style="color:#1FC47C;font-size:14px;font-weight:700;margin-top:3px;">+412.8%</div></div>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex;gap:8px;">' +
                '<button style="flex:1;padding:11px;background:' + ACCENT + ';border:none;border-radius:5px;color:#0A0A0A;font-family:\'JetBrains Mono\',monospace;font-size:10.5px;font-weight:700;letter-spacing:1.5px;cursor:pointer;">SHARE</button>' +
                '<button style="flex:1;padding:11px;background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:5px;color:#a8a89f;font-family:\'JetBrains Mono\',monospace;font-size:10.5px;font-weight:700;letter-spacing:1.5px;cursor:pointer;">DOWNLOAD</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

        '</div>' +
      '</div>'
    );
  }

  window.rdoSetPnlRange = function (r) { STATE.pnlRange = r; render(); };

  /* ══════════════════════════════════════════════════════════
     PNL CALENDAR MODAL
     ══════════════════════════════════════════════════════ */
  function renderCalendarModal() {
    var cal = genCalendarMonth(STATE.calendarMonthOffset);
    var leadingBlanks = [];
    for (var i = 0; i < cal.firstWeekday; i++) leadingBlanks.push('<div style="background:transparent;border:none;min-height:58px;"></div>');
    var dayCells = cal.days.map(function (dd) {
      var bg, border, color;
      if (!dd.hasTrade) { bg = '#161616'; border = '1px solid rgba(255,255,255,0.05)'; color = '#4a4a45'; }
      else if (dd.pnl >= 0) { bg = 'rgba(31,196,124,0.16)'; border = '1px solid rgba(31,196,124,0.32)'; color = '#1FC47C'; }
      else { bg = 'rgba(255,71,87,0.20)'; border = '1px solid rgba(255,71,87,0.4)'; color = '#FF4757'; }
      var pnlLabel = dd.hasTrade ? fmtSigned$(dd.pnl, 2) : '$0';
      return '<div style="background:' + bg + ';border:' + border + ';border-radius:6px;padding:8px;display:flex;flex-direction:column;justify-content:space-between;min-height:58px;">' +
        '<span style="color:#6b6b63;font-size:10px;">' + dd.day + '</span>' +
        '<span style="color:' + color + ';font-size:11.5px;font-weight:700;">' + pnlLabel + '</span>' +
      '</div>';
    });
    var cellsHtml = leadingBlanks.concat(dayCells).join('');

    var winAmt = cal.winTotal === 0 ? '$0.00' : fmtSigned$(cal.winTotal, 2);
    var lossAmt = cal.lossTotal === 0 ? '$0.00' : fmtSigned$(cal.lossTotal, 2);
    var totalColor = cal.totalPnl >= 0 ? '#1FC47C' : '#FF4757';
    var nextDisabled = STATE.calendarMonthOffset >= 0;

    return (
      '<div style="position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this) window.rdoCloseCalendar();">' +
        '<div style="width:820px;max-width:94vw;max-height:88vh;overflow-y:auto;background:#111;border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:26px 28px;display:flex;flex-direction:column;gap:20px;">' +

          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div style="display:flex;align-items:center;gap:12px;"><span style="color:#F5F1EA;font-size:14px;font-weight:800;letter-spacing:1px;">PNL CALENDAR</span><span style="padding:4px 9px;background:#1b1b1b;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#a8a89f;font-size:10px;letter-spacing:0.5px;">$ USD</span></div>' +
            '<div style="display:flex;align-items:center;gap:14px;">' +
              '<button onclick="window.rdoCalendarPrev()" style="background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#a8a89f;width:26px;height:26px;cursor:pointer;font-size:12px;">&#8249;</button>' +
              '<span style="color:#c9c9c0;font-size:12px;letter-spacing:0.5px;min-width:150px;text-align:center;">' + cal.monthLabel + ' UTC+0</span>' +
              '<button onclick="window.rdoCalendarNext()" style="background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:' + (nextDisabled ? '#3a3a36' : '#a8a89f') + ';width:26px;height:26px;cursor:' + (nextDisabled ? 'default' : 'pointer') + ';font-size:12px;">&#8250;</button>' +
              '<button onclick="window.rdoCloseCalendar()" style="background:transparent;border:none;color:#6b6b63;font-size:16px;cursor:pointer;padding:0 0 0 6px;">&#10005;</button>' +
            '</div>' +
          '</div>' +

          '<div>' +
            '<div style="font-size:28px;font-weight:800;color:' + totalColor + ';">' + fmtSigned$(cal.totalPnl, 2) + '</div>' +
            '<div style="height:4px;width:100%;border-radius:2px;background:' + totalColor + ';margin-top:10px;opacity:0.85;"></div>' +
          '</div>' +

          '<div style="display:flex;justify-content:space-between;"><span style="color:#1FC47C;font-size:11.5px;font-weight:700;">' + cal.winDays + ' / ' + winAmt + '</span><span style="color:#FF4757;font-size:11.5px;font-weight:700;">' + cal.lossDays + ' / ' + lossAmt + '</span></div>' +

          '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">' +
            '<span style="color:#55554e;font-size:9.5px;letter-spacing:1px;text-align:center;padding-bottom:2px;">M</span>' +
            '<span style="color:#55554e;font-size:9.5px;letter-spacing:1px;text-align:center;padding-bottom:2px;">T</span>' +
            '<span style="color:#55554e;font-size:9.5px;letter-spacing:1px;text-align:center;padding-bottom:2px;">W</span>' +
            '<span style="color:#55554e;font-size:9.5px;letter-spacing:1px;text-align:center;padding-bottom:2px;">T</span>' +
            '<span style="color:#55554e;font-size:9.5px;letter-spacing:1px;text-align:center;padding-bottom:2px;">F</span>' +
            '<span style="color:#55554e;font-size:9.5px;letter-spacing:1px;text-align:center;padding-bottom:2px;">S</span>' +
            '<span style="color:#55554e;font-size:9.5px;letter-spacing:1px;text-align:center;padding-bottom:2px;">S</span>' +
            cellsHtml +
          '</div>' +

          '<div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.07);padding-top:14px;">' +
            '<div style="display:flex;gap:22px;">' +
              '<span style="color:#6b6b63;font-size:10.5px;">Current Positive Streak: <b style="color:#c9c9c0;">' + cal.currentStreak + 'd</b></span>' +
              '<span style="color:#6b6b63;font-size:10.5px;">Best Positive Streak in ' + cal.monthShort + ': <b style="color:#c9c9c0;">' + cal.bestStreak + 'd</b></span>' +
            '</div>' +
            '<span style="display:flex;align-items:center;gap:6px;color:#4a4a45;font-size:9px;letter-spacing:1px;"><span style="width:5px;height:5px;border-radius:50%;background:' + ACCENT + ';"></span>RDO<span style="color:' + ACCENT + ';">ONE</span></span>' +
          '</div>' +

        '</div>' +
      '</div>'
    );
  }

  function renderCalendar() {
    var host = document.getElementById('calendarModalHost');
    if (!host) return;
    host.innerHTML = STATE.calendarOpen ? renderCalendarModal() : '';
  }

  window.rdoOpenCalendar = function () { STATE.calendarOpen = true; renderCalendar(); };
  window.rdoCloseCalendar = function () { STATE.calendarOpen = false; renderCalendar(); };
  window.rdoCalendarPrev = function () { STATE.calendarMonthOffset -= 1; renderCalendar(); };
  window.rdoCalendarNext = function () {
    if (STATE.calendarMonthOffset >= 0) return;
    STATE.calendarMonthOffset = Math.min(0, STATE.calendarMonthOffset + 1);
    renderCalendar();
  };

  /* ══════════════════════════════════════════════════════════
     MARKETS PAGE
     ══════════════════════════════════════════════════════ */
  function renderMarketsPage() {
    var md = MARKETS_DATA;
    var fgVal = md.fearGreedValue;
    var fgLabel, fgColor;
    if (fgVal >= 75) { fgLabel = 'Extreme Greed'; fgColor = '#1FC47C'; }
    else if (fgVal >= 55) { fgLabel = 'Greed'; fgColor = '#7FD858'; }
    else if (fgVal >= 45) { fgLabel = 'Neutral'; fgColor = '#c9c9c0'; }
    else if (fgVal >= 25) { fgLabel = 'Fear'; fgColor = '#FF9F45'; }
    else { fgLabel = 'Extreme Fear'; fgColor = '#FF4757'; }

    var marketStats = [
      { label: 'BTC Price', value: fmt$(md.btcPrice, 2), change: '+' + md.coins[0]._change24.toFixed(2) + '%', changeStyle: 'color:#1FC47C;font-size:9.5px;' },
      { label: 'ETH Price', value: fmt$(md.ethPrice, 2), change: '', changeStyle: '' },
      { label: 'BTC Market Cap', value: fmtCompact$(md.btcMcapB * 1e9), change: '', changeStyle: '' },
      { label: 'BTC 24h Volume', value: md.coins[0].volLabel, change: '', changeStyle: '' },
      { label: 'Total Market Cap', value: fmtCompact$(md.totalMcap), change: '+' + md.mcapChange.toFixed(2) + '%', changeStyle: 'color:#1FC47C;font-size:9.5px;' },
      { label: 'BTC Dominance', value: md.btcDominance.toFixed(1) + '%', change: '', changeStyle: '' },
      { label: 'Total Volume 24h', value: fmtCompact$(md.totalVol), change: '', changeStyle: '' },
    ];
    var statsHtml = marketStats.map(function (ms) {
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(255,255,255,0.04);"><span style="color:#6b6b63;font-size:11px;">' + ms.label + '</span><span style="color:#c9c9c0;font-size:11.5px;">' + ms.value + ' <span style="' + ms.changeStyle + '">' + ms.change + '</span></span></div>';
    }).join('');

    function listRow(t) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid rgba(255,255,255,0.04);">' +
        '<span style="width:22px;height:22px;border-radius:50%;background:' + t.color + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#0A0A0A;font-size:9px;font-weight:800;">' + t.mono + '</span>' +
        '<span style="flex:1;color:#c9c9c0;font-size:11.5px;font-weight:700;">' + t.name + '</span>' +
        '<span style="color:#F5F1EA;font-size:11.5px;">' + t.priceLabel + '</span>' +
        '<span style="' + t.changeStyle + '">' + t.changeLabel + '</span>' +
      '</div>';
    }
    var trendingHtml = md.trending.map(listRow).join('');
    var gainersHtml = md.topGainers.map(listRow).join('');

    var isToUsd = STATE.convDirection === 'toUsd';
    var amt = parseFloat(STATE.convAmount) || 0;
    var output = isToUsd ? amt * md.btcPrice : amt / md.btcPrice;
    var convFromSymbol = isToUsd ? 'BTC' : 'USD';
    var convToSymbol = isToUsd ? 'USD' : 'BTC';
    var convFromColor = isToUsd ? '#F7931A' : '#6b6b63';
    var convToColor = isToUsd ? '#6b6b63' : '#F7931A';
    var convOutputLabel = output.toLocaleString('en-US', { minimumFractionDigits: isToUsd ? 2 : 6, maximumFractionDigits: isToUsd ? 2 : 6 });

    var coinRows = md.coins.map(function (co) {
      var trendBarsHtml = co.trendBars.map(function (tb) {
        return '<rect x="' + tb.x + '" y="' + tb.y + '" width="' + tb.w + '" height="' + tb.h + '" fill="' + tb.color + '"/>';
      }).join('');
      return '<tr style="border-top:1px solid rgba(255,255,255,0.05);">' +
        '<td style="padding:9px 16px;color:#55554e;">' + co.rank + '</td>' +
        '<td style="padding:9px 16px;"><div style="display:flex;align-items:center;gap:9px;"><span style="width:22px;height:22px;border-radius:50%;background:' + co.color + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#0A0A0A;font-size:9px;font-weight:800;">' + co.mono + '</span><div><div style="color:#F5F1EA;font-weight:700;font-size:11.5px;">' + co.name + '</div><div style="color:#55554e;font-size:9.5px;">' + co.symbol + '</div></div></div></td>' +
        '<td style="padding:9px 16px;text-align:right;color:#F5F1EA;">' + co.priceLabel + '</td>' +
        '<td style="padding:9px 16px;text-align:right;' + co.change24Style + '">' + co.change24Label + '</td>' +
        '<td style="padding:9px 16px;text-align:right;' + co.change7Style + '">' + co.change7Label + '</td>' +
        '<td style="padding:9px 16px;text-align:right;color:#c9c9c0;">' + co.mcapLabel + '</td>' +
        '<td style="padding:9px 16px;text-align:right;"><div style="color:#c9c9c0;">' + co.volLabel + '</div><div style="color:#4a4a45;font-size:9.5px;">' + co.volPctLabel + '</div></td>' +
        '<td style="padding:9px 16px;"><svg viewBox="0 0 70 24" width="70" height="24" style="display:block;margin-left:auto;">' + trendBarsHtml + '</svg></td>' +
      '</tr>';
    }).join('');

    return (
      '<div style="flex:1;overflow-y:auto;padding:26px 30px 60px;">' +
        '<div style="max-width:1500px;margin:0 auto;display:flex;flex-direction:column;gap:18px;">' +

          '<div style="color:#F5F1EA;font-size:18px;font-weight:800;letter-spacing:1px;">MARKET OVERVIEW</div>' +

          '<div style="display:grid;grid-template-columns:1.3fr 1.3fr 0.8fr 0.8fr;gap:14px;">' +
            '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;"><div><div style="color:#F5F1EA;font-size:20px;font-weight:800;">' + fmtCompact$(md.totalMcap) + '</div><div style="color:#6b6b63;font-size:10px;margin-top:4px;">Market Cap <span style="color:#1FC47C;font-weight:700;">+' + md.mcapChange.toFixed(1) + '%</span></div></div><svg viewBox="0 0 120 40" width="90" height="34" preserveAspectRatio="none"><path d="' + md.marketCapSpark + '" fill="none" stroke="#1FC47C" stroke-width="2"/></svg></div>' +
            '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;"><div><div style="color:#F5F1EA;font-size:20px;font-weight:800;">' + fmtCompact$(md.totalVol) + '</div><div style="color:#6b6b63;font-size:10px;margin-top:4px;">24h Trading Volume <span style="color:#1FC47C;font-weight:700;">+' + md.volChange.toFixed(1) + '%</span></div></div><svg viewBox="0 0 120 40" width="90" height="34" preserveAspectRatio="none"><path d="' + md.volumeSpark + '" fill="none" stroke="' + ACCENT + '" stroke-width="2"/></svg></div>' +
            '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;"><div style="color:#F5F1EA;font-size:20px;font-weight:800;">' + md.btcDominance.toFixed(1) + '%</div><div style="color:#6b6b63;font-size:10px;margin-top:4px;">BTC Dominance</div></div>' +
            '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;"><div style="font-size:20px;font-weight:800;color:' + fgColor + ';">' + fgVal + '</div><div style="color:#6b6b63;font-size:10px;margin-top:4px;">' + fgLabel + '</div></div>' +
          '</div>' +

          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +
            '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;"><div style="color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;margin-bottom:6px;">TRENDING</div>' + trendingHtml + '</div>' +
            '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;"><div style="color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;margin-bottom:6px;">TOP GAINERS</div>' + gainersHtml + '</div>' +
          '</div>' +

          '<div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;">' +
            '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;"><div style="color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;margin-bottom:6px;">MARKET STATISTICS</div>' + statsHtml + '</div>' +
            '<div id="converterRoot" style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:16px;display:flex;flex-direction:column;gap:10px;">' +
              '<div style="color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;">CONVERTER</div>' +
              '<div style="display:flex;gap:8px;">' +
                '<input type="text" inputmode="decimal" id="convAmountInput" value="' + escAttr(STATE.convAmount) + '" oninput="window.rdoOnConvAmountInput(this.value)" style="flex:1;background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#F5F1EA;font-family:\'JetBrains Mono\',monospace;font-size:13px;padding:10px 12px;outline:none;min-width:0;"/>' +
                '<div style="display:flex;align-items:center;gap:6px;padding:0 10px;background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#F5F1EA;font-size:11.5px;font-weight:700;flex-shrink:0;"><span style="width:14px;height:14px;border-radius:50%;background:' + convFromColor + ';display:inline-block;"></span>' + convFromSymbol + '</div>' +
              '</div>' +
              '<button onclick="window.rdoConvSwap()" style="align-self:center;width:28px;height:28px;border-radius:50%;background:#161616;border:1px solid rgba(255,255,255,0.1);color:#a8a89f;cursor:pointer;font-size:12px;">&#8645;</button>' +
              '<div style="display:flex;gap:8px;">' +
                '<div id="convOutput" style="flex:1;background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#F5F1EA;font-family:\'JetBrains Mono\',monospace;font-size:13px;padding:10px 12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + convOutputLabel + '</div>' +
                '<div style="display:flex;align-items:center;gap:6px;padding:0 10px;background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#F5F1EA;font-size:11.5px;font-weight:700;flex-shrink:0;"><span style="width:14px;height:14px;border-radius:50%;background:' + convToColor + ';display:inline-block;"></span>' + convToSymbol + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div style="background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:6px;overflow:hidden;">' +
            '<div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;"><span style="color:#7a7a72;font-size:10px;letter-spacing:1.5px;font-weight:700;">TOP 20 BY MARKET CAP</span><span style="color:#4a4a45;font-size:9.5px;">LIVE PRICES</span></div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="color:#4a4a45;font-size:9px;letter-spacing:0.5px;text-align:left;">' +
              '<th style="font-weight:600;padding:8px 16px;">#</th><th style="font-weight:600;padding:8px 16px;">NAME</th><th style="font-weight:600;padding:8px 16px;text-align:right;">PRICE</th><th style="font-weight:600;padding:8px 16px;text-align:right;">24H %</th><th style="font-weight:600;padding:8px 16px;text-align:right;">7D %</th><th style="font-weight:600;padding:8px 16px;text-align:right;">MARKET CAP</th><th style="font-weight:600;padding:8px 16px;text-align:right;">VOLUME (24H)</th><th style="font-weight:600;padding:8px 16px;text-align:right;">7D TREND</th>' +
            '</tr></thead><tbody>' + coinRows + '</tbody></table>' +
          '</div>' +

        '</div>' +
      '</div>'
    );
  }

  window.rdoOnConvAmountInput = function (v) {
    STATE.convAmount = v;
    var md = MARKETS_DATA;
    var isToUsd = STATE.convDirection === 'toUsd';
    var amt = parseFloat(v) || 0;
    var output = isToUsd ? amt * md.btcPrice : amt / md.btcPrice;
    var out = document.getElementById('convOutput');
    if (out) out.textContent = output.toLocaleString('en-US', { minimumFractionDigits: isToUsd ? 2 : 6, maximumFractionDigits: isToUsd ? 2 : 6 });
  };
  window.rdoConvSwap = function () {
    STATE.convDirection = STATE.convDirection === 'toUsd' ? 'toBtc' : 'toUsd';
    STATE.convAmount = '1';
    render();
  };

  /* ══════════════════════════════════════════════════════════
     NEWS PAGE
     ══════════════════════════════════════════════════════ */
  function renderNewsPage() {
    var filters = ['All', 'Breaking', 'Bitcoin', 'Ethereum', 'Solana', 'DeFi', 'Regulation'];
    var chipsHtml = filters.map(function (f) {
      return '<button onclick="window.rdoSetNewsFilter(\'' + f + '\')" style="' + styleStr(newsChip(STATE.newsFilter === f)) + '">' + f + '</button>';
    }).join('');

    var filtered = STATE.newsFilter === 'All' ? NEWS_DATA.items : NEWS_DATA.items.filter(function (n) { return n.tag === STATE.newsFilter; });
    var itemsHtml = filtered.map(function (n) {
      return '<div style="display:flex;gap:16px;background:#121212;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:14px;cursor:pointer;">' +
        '<div style="width:104px;height:104px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,' + n.gradA + ',' + n.gradB + ');display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.85);font-size:15px;font-weight:800;letter-spacing:1px;">' + n.mono + '</div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">' +
          '<div style="display:flex;align-items:center;gap:8px;"><span style="padding:2px 8px;background:rgba(255,255,255,0.06);border-radius:3px;color:#a8a89f;font-size:9px;font-weight:700;letter-spacing:0.5px;">' + n.source + '</span><span style="color:#4a4a45;font-size:9.5px;">' + n.time + '</span></div>' +
          '<div style="color:#F5F1EA;font-size:13px;font-weight:700;line-height:1.4;">' + n.title + '</div>' +
          '<div style="color:#6b6b63;font-size:11px;line-height:1.5;">' + n.body + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return (
      '<div style="flex:1;overflow-y:auto;padding:26px 30px 60px;">' +
        '<div style="max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:16px;">' +

          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
              '<div style="width:38px;height:38px;border-radius:6px;background:#161616;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                '<div style="width:16px;height:12px;border:1.5px solid ' + ACCENT + ';border-radius:1.5px;position:relative;">' +
                  '<div style="position:absolute;top:2px;left:2px;right:2px;height:1.5px;background:' + ACCENT + ';"></div>' +
                  '<div style="position:absolute;top:5px;left:2px;right:6px;height:1.5px;background:' + ACCENT + ';"></div>' +
                  '<div style="position:absolute;top:8px;left:2px;right:9px;height:1.5px;background:' + ACCENT + ';"></div>' +
                '</div>' +
              '</div>' +
              '<div><div style="color:#F5F1EA;font-size:16px;font-weight:800;letter-spacing:0.5px;">CRYPTO NEWS</div><div style="color:#6b6b63;font-size:10.5px;margin-top:2px;">Aggregated headlines across independent crypto desks</div></div>' +
            '</div>' +
            '<button onclick="window.rdoNewsRefresh()" style="padding:9px 16px;background:' + ACCENT + ';border:none;border-radius:4px;color:#0A0A0A;font-family:\'JetBrains Mono\',monospace;font-size:10.5px;font-weight:700;letter-spacing:1px;cursor:pointer;">&#8635; REFRESH</button>' +
          '</div>' +

          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + chipsHtml + '</div>' +

          '<div style="color:#4a4a45;font-size:9.5px;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:12px;">5 INDEPENDENT DESKS &middot; UPDATED JUST NOW</div>' +

          '<div style="display:flex;flex-direction:column;gap:12px;">' + itemsHtml + '</div>' +

        '</div>' +
      '</div>'
    );
  }

  window.rdoSetNewsFilter = function (f) { STATE.newsFilter = f; render(); };
  window.rdoNewsRefresh = function () { STATE.newsFilter = 'All'; render(); };

  /* ══════════════════════════════════════════════════════════
     MASTER RENDER + INIT
     ══════════════════════════════════════════════════════ */
  function render() {
    var el = root();
    if (!el) return;
    var page = STATE.page === 'terminal' ? renderTerminalPage()
      : STATE.page === 'pnl' ? renderPnlPage()
      : STATE.page === 'markets' ? renderMarketsPage()
      : renderNewsPage();
    el.innerHTML =
      '<div style="height:100%;width:100%;display:flex;flex-direction:column;background:#0A0A0A;color:#EDEDE6;font-family:\'JetBrains Mono\',monospace;overflow:hidden;background-image:linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px);background-size:100% 44px;">' +
        renderHeader() + page +
      '</div>' +
      '<div id="calendarModalHost">' + (STATE.calendarOpen ? renderCalendarModal() : '') + '</div>';
  }

  window.rdoInitFundamentals = function () {
    if (!MARKET) genMarketData(); // instant placeholder so first paint isn't empty while HL loads
    if (!PNL) genPnlData();
    if (!MARKETS_DATA) genMarketsData();
    if (!NEWS_DATA) genNewsData();
    render();
    startMarketPolling(); // fetches real Hyperliquid testnet data and polls every 5s
  };
})();
