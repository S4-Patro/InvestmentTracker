import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { question, portfolioSummary } = req.body;

  if (!question || !portfolioSummary) {
    return res.status(400).json({ error: 'Missing question or portfolio summary' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a sharp, candid personal finance advisor for an Indian investor. 
You have access to their portfolio data below. Give direct, specific, actionable advice.
Use INR (₹) for amounts. Be concise — 3-5 sentences max unless they ask for detail.
Never give generic disclaimers. Treat them as a financially literate adult.
Portfolio: ${portfolioSummary}`,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const data = await response.json();
    const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
    return res.json({ answer: text });
  } catch (err) {
    console.error('AI error:', err);
    return res.status(500).json({ error: 'AI request failed' });
  }
}
