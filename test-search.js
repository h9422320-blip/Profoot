const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyCYJmtVJdMW--EsnOvXGFQkrHHVD0rUXN4");

async function test15() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  try {
    const result = await model.generateContent("Hello");
    console.log("1.5-flash:", result.response.text());
  } catch (e) {
    console.error("1.5-flash ERROR:", e.message);
  }
}
test15();
