// Vercel Serverless: proxies LLM calls so API key stays server-side.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.JATEVO_API_KEY;
  const baseUrl = process.env.JATEVO_BASE_URL || 'https://jatevo.id/api/open/v1/inference';
  const model = process.env.JATEVO_MODEL || 'glm-4.7';

  if (!apiKey) return res.status(500).json({ error: 'LLM not configured' });

  const { messages, temperature = 0.3, max_tokens = 200 } = req.body;
  if (!messages) return res.status(400).json({ error: 'Missing messages' });

  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature, max_tokens, stream: false }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return res.status(r.status).json({ error: `LLM ${r.status}`, detail: errText });
    }

    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'LLM request failed' });
  }
}
