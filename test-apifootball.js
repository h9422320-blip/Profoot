const fs = require('fs');

async function testApiFoot() {
  const apiKey = process.env.API_FOOTBALL_KEY || '516f406da7715bd0526a40a43d9cc2ba'; // fallback to check
  const res = await fetch(`https://v3.football.api-sports.io/teams?name=Scotland`, {
    headers: { 'x-apisports-key': apiKey }
  });
  const data = await res.json();
  console.log("Scotland response:", JSON.stringify(data, null, 2));

  const res2 = await fetch(`https://v3.football.api-sports.io/teams?name=Brazil`, {
    headers: { 'x-apisports-key': apiKey }
  });
  const data2 = await res2.json();
  console.log("Brazil response:", JSON.stringify(data2, null, 2));
}

testApiFoot();
