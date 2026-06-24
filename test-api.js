const testMatch = async (t1, t2) => {
  console.log('Testing', t1, 'vs', t2);
  try {
    const res = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team1: { name: t1, country: 'Monde' },
        team2: { name: t2, country: 'Monde' }
      })
    });
    if (!res.ok) {
       console.log('Error HTTP:', res.status, await res.text());
       return;
    }
    const data = await res.json();
    console.log('RESULTAT:', t1, data.predictedScore?.team1Goals, '-', data.predictedScore?.team2Goals, t2);
    console.log('RAISON:', data.predictedScore?.reasoning);
    console.log('WIN PROB:', data.winProb, 'DRAW:', data.drawProb, 'LOSE:', data.loseProb);
    console.log('----------------------------');
  } catch (e) {
    console.error(e);
  }
};

const run = async () => {
  await testMatch('Argentine', 'Portugal');
  await testMatch('Brésil', 'France');
  await testMatch('Espagne', "Côte d'Ivoire");
};
run();
