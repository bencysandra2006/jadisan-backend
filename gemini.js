require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use a stable model
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Analyze the complaint text
async function analyzeComplaint(text) {
  const prompt = `
You are a civic complaint classifier.
User message (may be Tamil, English, or mixed):

"${text}"

Return JSON with:
- issue
- location
- priority
- cleaned_summary
`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("Gemini internal error:", err.message || err);
    throw err;
  }
}

module.exports = analyzeComplaint;
