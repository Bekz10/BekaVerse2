const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { ok: Boolean(text), text, status: r.status, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Нет текста запроса" });

  const models = [
    process.env.GEMINI_MODEL,
    process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite",
  ];

  let last;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      last = await callGemini(model, prompt);
      if (last.ok) return res.json({ text: last.text, model });
      // повторяем только при временных ошибках
      if (![429, 500, 503].includes(last.status)) break;
      await sleep(800);
    }
  }
  res.status(502).json({ error: "Модель сейчас недоступна, попробуйте позже", details: last?.data });
}