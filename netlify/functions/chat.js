// Función de servidor: aquí vive tu clave secreta de Gemini (nunca va en la página).
const SYS = "Eres J.A.R.V.I.S., el asistente personal de la película Iron Man: elegante, ingenioso, leal y con humor fino. Hablas español de México y llamas a la usuaria «señorita». Respondes en máximo 2 oraciones porque tus respuestas se leen en voz alta. No tienes datos en vivo (clima, noticias); no los inventes.";

const out = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return out(405, { error: "metodo" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return out(500, { error: "Falta la variable GEMINI_API_KEY" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return out(400, { error: "json" }); }

  let msgs = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  msgs = msgs.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "").slice(0, 1500) }],
  }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) return out(400, { error: "vacio" });

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYS }] },
          contents: msgs,
          generationConfig: { maxOutputTokens: 800 },
        }),
      }
    );
    if (r.status === 429) return out(429, { error: "limite" });
    if (!r.ok) return out(502, { error: "gemini " + r.status });
    const data = await r.json();
    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
    if (!reply) return out(502, { error: "sin respuesta" });
    return out(200, { reply });
  } catch (e) {
    return out(502, { error: "red" });
  }
};
