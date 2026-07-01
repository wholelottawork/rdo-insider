export default async function handler(req, res) {
  const { chain, address, limit = '30' } = req.query;

  const params = new URLSearchParams({ limit, orderBy: 'block_timestamp', direction: 'desc' });
  const url = `https://gmgn.ai/defi/quotation/v1/tokens/swaps/${chain}/${address}?${params}`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://gmgn.ai/',
        Accept: 'application/json',
      },
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { code: -1 }; }
    res.json(data);
  } catch {
    res.json({ code: -1 });
  }
}
