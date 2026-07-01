// Hyperliquid TESTNET integration: market data + non-custodial wallet signing.
// Every order is signed by the user's own connected browser wallet (MetaMask / Phantom EVM mode) —
// no private key ever touches this app or any server. See Hyperliquid's exchange API docs for the
// action-hashing / EIP-712 "Agent" signing scheme implemented in signL1Action() below.
import { BrowserProvider, keccak256, Signature } from 'ethers';
import { encode as msgpackEncode } from '@msgpack/msgpack';

export const HL_BASE = 'https://api.hyperliquid-testnet.xyz';
const IS_MAINNET = false; // testnet build — flip only with an explicit, separate decision

function getInjectedProvider() {
  return window.phantom?.ethereum || window.ethereum || null;
}

export function hasWalletProvider() {
  return !!getInjectedProvider();
}

export async function connectWallet() {
  const injected = getInjectedProvider();
  if (!injected) throw new Error('No wallet found — install MetaMask or Phantom (EVM mode).');
  const accounts = await injected.request({ method: 'eth_requestAccounts' });
  if (!accounts || !accounts.length) throw new Error('Wallet connection was rejected.');
  return accounts[0];
}

async function getSigner() {
  const injected = getInjectedProvider();
  if (!injected) throw new Error('No wallet found — install MetaMask or Phantom (EVM mode).');
  const provider = new BrowserProvider(injected);
  return provider.getSigner();
}

async function postInfo(body) {
  const res = await fetch(HL_BASE + '/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Hyperliquid /info error ' + res.status);
  return res.json();
}

export function fetchMeta() { return postInfo({ type: 'meta' }); }
export function fetchMetaAndAssetCtxs() { return postInfo({ type: 'metaAndAssetCtxs' }); }
export function fetchAllMids() { return postInfo({ type: 'allMids' }); }
export function fetchL2Book(coin) { return postInfo({ type: 'l2Book', coin: coin }); }
export function fetchCandles(coin, interval, startTime, endTime) {
  return postInfo({ type: 'candleSnapshot', req: { coin: coin, interval: interval, startTime: startTime, endTime: endTime } });
}
export function fetchClearinghouseState(address) { return postInfo({ type: 'clearinghouseState', user: address }); }
export function fetchOpenOrders(address) { return postInfo({ type: 'openOrders', user: address }); }
export function fetchUserFills(address) { return postInfo({ type: 'userFills', user: address }); }

let _assetIndexCache = null;
export async function getAssetIndex(coin) {
  if (!_assetIndexCache) {
    const meta = await fetchMeta();
    _assetIndexCache = {};
    meta.universe.forEach(function (a, i) { _assetIndexCache[a.name] = i; });
  }
  if (!(coin in _assetIndexCache)) throw new Error('Unknown Hyperliquid asset: ' + coin);
  return _assetIndexCache[coin];
}

// Matches Hyperliquid SDKs' float_to_wire: fixed-point string, no trailing zeros, no scientific notation.
function floatToWire(x) {
  var s = Number(x).toFixed(8);
  s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}

function nonceToBytes(nonce) {
  var buf = new Uint8Array(8);
  var n = BigInt(nonce);
  for (var i = 7; i >= 0; i--) { buf[i] = Number(n & 0xffn); n >>= 8n; }
  return buf;
}

function concatBytes(parts) {
  var total = parts.reduce(function (n, p) { return n + p.length; }, 0);
  var out = new Uint8Array(total);
  var offset = 0;
  parts.forEach(function (p) { out.set(p, offset); offset += p.length; });
  return out;
}

// Hyperliquid's L1 action signing: msgpack(action) + nonce(8 bytes BE) + vault byte, keccak256'd,
// then wrapped as an EIP-712 "Agent" message and signed by the connected wallet.
async function signL1Action(action, nonce) {
  var packed = msgpackEncode(action);
  var toHash = concatBytes([packed, nonceToBytes(nonce), new Uint8Array([0])]); // no vault address
  var hash = keccak256(toHash);

  var domain = { name: 'Exchange', version: '1', chainId: 1337, verifyingContract: '0x0000000000000000000000000000000000000000' };
  var types = { Agent: [{ name: 'source', type: 'string' }, { name: 'connectionId', type: 'bytes32' }] };
  var message = { source: IS_MAINNET ? 'a' : 'b', connectionId: hash };

  var signer = await getSigner();
  var flatSig = await signer.signTypedData(domain, types, message);
  var sig = Signature.from(flatSig);
  return { r: sig.r, s: sig.s, v: sig.v };
}

async function submitExchangeAction(action, nonce) {
  var signature = await signL1Action(action, nonce);
  var res = await fetch(HL_BASE + '/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, nonce: nonce, signature: signature }),
  });
  var json = await res.json();
  if (!res.ok) throw new Error('Hyperliquid /exchange error ' + res.status + ': ' + JSON.stringify(json));
  return json;
}

// Market orders are placed as aggressive IOC limit orders (slippage off the passed reference price) —
// Hyperliquid, like most perp DEXs, has no separate "market order" wire type.
export async function placeOrder(opts) {
  var coin = opts.coin, isBuy = opts.isBuy, sizeSz = opts.sizeSz, limitPx = opts.limitPx;
  var reduceOnly = !!opts.reduceOnly, tif = opts.tif || 'Gtc';
  var asset = await getAssetIndex(coin);
  var orderWire = {
    a: asset,
    b: isBuy,
    p: floatToWire(limitPx),
    s: floatToWire(sizeSz),
    r: reduceOnly,
    t: { limit: { tif: tif } },
  };
  var action = { type: 'order', orders: [orderWire], grouping: 'na' };
  return submitExchangeAction(action, Date.now());
}

export async function placeMarketOrder(opts) {
  var slippage = opts.slippagePct === undefined ? 0.005 : opts.slippagePct;
  var refPx = opts.refPx;
  var limitPx = opts.isBuy ? refPx * (1 + slippage) : refPx * (1 - slippage);
  return placeOrder({
    coin: opts.coin, isBuy: opts.isBuy, sizeSz: opts.sizeSz,
    limitPx: limitPx, reduceOnly: opts.reduceOnly, tif: 'Ioc',
  });
}
