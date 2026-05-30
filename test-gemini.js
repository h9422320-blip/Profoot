const GEMINI_KEY = "AIzaSyCYJmtVJdMW--EsnOvXGFQkrHHVD0rUXN4";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

async function test() {
  const prompt = `Tu es un analyste football expert. Analyse ce match: Real Madrid vs FC Barcelone (Mai 2026).
Retourne UNIQUEMENT un JSON valide (pas de texte autour) :
{"quickSummary":"...","winProb":45,"drawProb":25,"loseProb":30,"predictedScore":{"team1Goals":1,"team2Goals":2,"reasoning":"..."}}
Utilise des données RÉELLES.`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }] // Trying googleSearch instead of google_search or with different casing
    })
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
