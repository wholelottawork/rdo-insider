export default async function handler(req, res) {
  const { q = '', chain = 'sol' } = req.query;
  if (!q || q.trim().length < 2) return res.json({ tokens: [] });

  const params = new URLSearchParams({ query: q.trim(), chain, limit: '8' });
  const url = `https://gmgn.ai/defi/quotation/v1/tokens/search?${params}`;

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
    try { data = JSON.parse(text); } catch { data = { tokens: [] }; }
    res.json(data);
  } catch {
    res.json({ tokens: [] });
  }
}
