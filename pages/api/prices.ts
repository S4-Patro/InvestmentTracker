import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { type, tickers } = req.query;

  try {
    if (type === 'gold') {
      // GoldAPI.io free tier — or fallback to metals-api
      // Using a public gold price proxy
      const response = await fetch(
        'https://api.metals.live/v1/spot/gold',
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) throw new Error('metals api failed');
      const data = await response.json();
      // metals.live returns price in USD/troy oz
      const usdPerOz = Array.isArray(data) ? data[0]?.price : data?.price;
      // Convert to INR per gram: 1 troy oz = 31.1035g, use approx USD/INR = 83.5
      const usdInr = 83.5;
      const pricePerGram = (usdPerOz / 31.1035) * usdInr;
      return res.json({ pricePerGram: Math.round(pricePerGram), change: 0.3 });
    }

    if (type === 'stocks' && tickers) {
      const tickerList = (tickers as string).split(',').filter(Boolean).slice(0, 10);
      const results: Record<string, { price: number; change: number }> = {};

      for (const ticker of tickerList) {
        try {
          // Yahoo Finance v8 — no API key needed
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
          const r = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(4000),
          });
          if (!r.ok) continue;
          const d = await r.json();
          const meta = d?.chart?.result?.[0]?.meta;
          if (meta) {
            const price = meta.regularMarketPrice ?? 0;
            const prev = meta.chartPreviousClose ?? price;
            const change = prev > 0 ? ((price - prev) / prev) * 100 : 0;
            results[ticker] = { price: Math.round(price * 100) / 100, change: Math.round(change * 100) / 100 };
          }
        } catch {
          // Individual ticker failure — skip
        }
      }
      return res.json(results);
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    console.error('Price fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch prices' });
  }
}
