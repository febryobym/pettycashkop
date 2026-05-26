import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
  const genAI = new (GoogleGenAI as any)(process.env.GEMINI_API_KEY || "");
  const model = (genAI as any).getGenerativeModel({ model: "gemini-2.0-flash" });

  // API Routes
  app.post("/api/insights", async (req, res) => {
    try {
      const { transactions, categories } = req.body;
      
      const prompt = `
        Analyze the following petty cash financial data and provide 3-4 concise, helpful bullet points in INDONESIAN.
        Focus on spending patterns, potential savings, and a quick summary.
        Data: ${JSON.stringify(transactions.slice(0, 20))}
        Categories: ${JSON.stringify(categories)}
         Keep it professional and helpful.
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      res.json({ insights: text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Gagal mendapatkan insight dari AI" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
