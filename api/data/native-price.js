export default async function handler(req, res) {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum,binancecoin&vs_currencies=usd';
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await resp.json();
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.json({
    sol: data?.solana?.usd || 0,
    eth: data?.ethereum?.usd || 0,
    base: data?.ethereum?.usd || 0,
    bsc: data?.binancecoin?.usd || 0,
  });
}
