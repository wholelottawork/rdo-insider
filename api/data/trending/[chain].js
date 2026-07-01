const VALID = ['sol', 'eth', 'base', 'bsc'];
const GT_NET = { sol: 'solana', eth: 'eth', base: 'base', bsc: 'bsc' };

export default async function handler(req, res) {
  const { chain } = req.query;
  if (!VALID.includes(chain)) return res.status(400).json({ error: 'Invalid chain' });

  const net = GT_NET[chain];
  const url = `https://api.geckoterminal.com/api/v2/networks/${net}/trending_pools?include=base_token&page=1`;

  const resp = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!resp.ok) return res.status(502).json({ error: 'GeckoTerminal ' + resp.status });
  const json = await resp.json();

  const tokenMeta = {};
  (json.included || []).forEach(t => {
    if (t.type === 'token')
      tokenMeta[t.id] = { symbol: t.attributes?.symbol, name: t.attributes?.name };
  });

  const tokens = (json.data || []).map(pool => {
    const a = pool.attributes;
    const base = pool.relationships?.base_token?.data?.id ?? '';
    const address = base.includes('_') ? base.slice(base.indexOf('_') + 1) : base;
    const meta = tokenMeta[base] || {};
    const symFromName = (a.name || '').split('/')[0].trim();
    return {
      address,
      symbol: meta.symbol || symFromName || '?',
      name: meta.name || symFromName || '?',
      chain,
      price: parseFloat(a.base_token_price_usd) || 0,
      price_change_24h: parseFloat(a.price_change_percentage?.h24) || 0,
      market_cap: parseFloat(a.market_cap_usd || a.fdv_usd) || 0,
      volume_24h: parseFloat(a.volume_usd?.h24) || 0,
      liquidity: parseFloat(a.reserve_in_usd) || 0,
    };
  });

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.json({ tokens });
}
