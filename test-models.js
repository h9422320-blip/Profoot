const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_KEY = "AIzaSyCYJmtVJdMW--EsnOvXGFQkrHHVD0rUXN4";
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

async function testModel(modelName) {
  try {
    console.log(`Testing model: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Bonjour");
    console.log(`✅ Success for ${modelName}:`, result.response.text());
    return true;
  } catch (err) {
    console.log(`❌ Failed for ${modelName}:`, err.message);
    return false;
  }
}

async function testModelJson(modelName) {
  try {
    console.log(`Testing model JSON: ${modelName}...`);
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent("Retourne un JSON avec la clé 'greeting' valant 'bonjour'");
    console.log(`✅ Success JSON for ${modelName}:`, result.response.text());
    return true;
  } catch (err) {
    console.log(`❌ Failed JSON for ${modelName}:`, err.message);
    return false;
  }
}

async function run() {
  await testModel("gemini-2.0-flash");
  await testModel("gemini-2.5-flash");
  await testModelJson("gemini-2.5-flash");
}
run();

