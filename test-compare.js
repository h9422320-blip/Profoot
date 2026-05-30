async function callAnalyze(t1, t2) {
  try {
    const res = await fetch("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team1: t1, team2: t2 })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error:", err);
  }
}

async function run() {
  const psg = { id: "psg", name: "Paris Saint-Germain", logo: "https://media.api-sports.io/football/teams/85.png", league: "ligue1" };
  const arsenal = { id: "arsenal", name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png", league: "epl" };
  const france = { id: "france", name: "France", logo: "https://flagcdn.com/w40/fr.png", league: "wc" };
  const senegal = { id: "senegal", name: "Sénégal", logo: "https://flagcdn.com/w40/sn.png", league: "wc" };

  console.log("-----------------------------------------");
  console.log("Analyzing: PSG vs Arsenal");
  const r1 = await callAnalyze(psg, arsenal);
  console.log("Predicted Score:", r1.predictedScore.team1Goals + " - " + r1.predictedScore.team2Goals);
  console.log("Probabilities:", `Win: ${r1.winProb}%, Draw: ${r1.drawProb}%, Lose: ${r1.loseProb}%`);
  console.log("xG:", r1.predictions.expectedGoals);
  console.log("Attack comparison:", r1.comparison.attack);

  console.log("\n-----------------------------------------");
  console.log("Analyzing: France vs Sénégal");
  const r2 = await callAnalyze(france, senegal);
  console.log("Predicted Score:", r2.predictedScore.team1Goals + " - " + r2.predictedScore.team2Goals);
  console.log("Probabilities:", `Win: ${r2.winProb}%, Draw: ${r2.drawProb}%, Lose: ${r2.loseProb}%`);
  console.log("xG:", r2.predictions.expectedGoals);
  console.log("Attack comparison:", r2.comparison.attack);
  console.log("-----------------------------------------");
}

run();
