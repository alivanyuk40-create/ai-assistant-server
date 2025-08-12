// server.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error('Set OPENAI_API_KEY in .env');
  process.exit(1);
}

// Простейшая in-memory "память" по сессиям (для demo). Для реального проекта замените на DB.
const sessions = new Map(); // sessionId -> [{role:'user'|'assistant', content:''}, ...]

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!message) return res.status(400).json({error:'No message'});

    const history = sessions.get(sessionId) || [];
    // Держим последние 10 сообщений (пример простой стратегии)
    history.push({ role: 'user', content: message });
    if (history.length > 20) history.splice(0, history.length - 20);

    // Сформируем тело для OpenAI ChatCompletion (пример API v1)
    const payload = {
      model: "gpt-4o-mini", // замените на нужную модель у провайдера
      messages: [
        { role: "system", content: "Ты — дружелюбный помощник для сайта магазина. Краткие ответы, предложи оставить контакт если нужно." },
        ...history
      ],
      max_tokens: 600,
      temperature: 0.2
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('LLM error', errText);
      return res.status(500).json({ error: 'LLM error', details: errText });
    }

    const j = await r.json();
    // Вынуть ответ (зависит от провайдера — тут стандартный путь)
    const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
      ? j.choices[0].message.content.trim()
      : 'Извините, ошибка в ответе';

    // Сохраняем ответ в историю
    history.push({ role: 'assistant', content: reply });
    sessions.set(sessionId, history);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server started on ${PORT}`));
