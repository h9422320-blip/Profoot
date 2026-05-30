async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team1: {
          id: "psg",
          name: "Paris Saint-Germain",
          logo: "https://media.api-sports.io/football/teams/85.png",
          league: "ligue1"
        },
        team2: {
          id: "arsenal",
          name: "Arsenal",
          logo: "https://media.api-sports.io/football/teams/42.png",
          league: "epl"
        }
      })
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
