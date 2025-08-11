import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const app = express();
app.use(express.json());

import cors from 'cors';
app.use(cors());

// ===== Загружаем и разбиваем базу знаний =====
function loadKnowledge() {
  const text = fs.readFileSync('./knowledge.txt', 'utf8');
  const chunks = [];
  const size = 500; // длина куска в символах

  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

let knowledgeChunks = loadKnowledge();

// ===== Хранилище истории диалога для сессий =====
const sessions = new Map(); // { sessionId: [ { role, content } ] }

// ===== Функция поиска релевантных кусков =====
function findRelevantChunks(query, maxChunks = 3) {
  const lowerQuery = query.toLowerCase();
  // Простейший поиск по вхождению слов
  const scored = knowledgeChunks.map(chunk => {
    let score = 0;
    for (const word of lowerQuery.split(/\s+/)) {
      if (chunk.toLowerCase().includes(word)) score++;
    }
    return { chunk, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxChunks).map(s => s.chunk);
}

// ===== Эндпоинт для общения =====
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || !sessionId) {
    return res.status(400).json({ error: 'message и sessionId обязательны' });
  }

  // Загружаем историю
  let history = sessions.get(sessionId) || [];

  // Ищем релевантные знания
  const relevant = findRelevantChunks(message).join('\n---\n');

  // Добавляем текущее сообщение в историю
  history.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
Ты — Эля, дружелюбный и грамотный онлайн-консультант питомника "Алива".
Ты помогаешь клиентам выбрать и приобрести растения, особенно прут.
Отвечай подробно, дружелюбно, без спешки.
Используй релевантную базу знаний ниже для ответов:
${relevant}
Твоя задача — помочь посетителю сайта разобраться в ассортименте, ответить на вопросы про размеры, цены, сроки выращивания и доставки, а также про уход за ивой.
`
          },
          ...history
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Сохраняем ответ в историю
    history.push({ role: 'assistant', content: reply });
    sessions.set(sessionId, history.slice(-20)); // храним только последние 20 сообщений

    res.json({ reply });

  } catch (error) {
  console.error('OpenAI API error:', error);
  res.status(500).json({ error: error.message });
}
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
