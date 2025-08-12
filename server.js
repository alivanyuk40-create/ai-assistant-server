import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Загружаем knowledge.json из той же папки
const knowledgePath = path.join(__dirname, "knowledge.json");
let knowledge = [];

try {
  const raw = fs.readFileSync(knowledgePath, "utf8");
  knowledge = JSON.parse(raw);
  console.log(`Загружено ${knowledge.length} записей из knowledge.json`);
} catch (err) {
  console.error("Ошибка загрузки базы знаний:", err);
}

// Инициализация OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message || "";

    // Формируем системный промт с базой знаний
    const systemPrompt = `Ты — ассистент компании АЛИВА. Вот база знаний:
${knowledge.map((item) => `- ${item.text}`).join("\n")}

Отвечай на вопросы, опираясь на эти данные, подробно и дружелюбно.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("Ошибка OpenAI:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
