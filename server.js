// server.js
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import cors from 'cors';

dotenv.config();

const app = express();

app.use(cors());        // Включаем CORS
app.use(express.json()); // Парсим JSON в теле запросов

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
    if (!message) return res.status(400).json({ error: 'No message' });

    const history = sessions.get(sessionId) || [];
    // Держим последние 20 сообщений (пример простой стратегии)
    history.push({ role: 'user', content: message });
    if (history.length > 20) history.splice(0, history.length - 20);

    const payload = {
      model: "gpt-4o-mini", // замените на нужную модель у провайдера
      messages: [
        {
          role: "system",
          content: `
Ты — Эля, дружелюбный и внимательный онлайн-консультант женского пола.
Ты помогаешь клиентам выбрать и приобрести растения, особенно прут.
Отвечай подробно, дружелюбно, без спешки.

Твоя задача — помочь посетителю сайта разобраться в ассортименте, ответить на вопросы про размеры, цены, сроки выращивания и доставки, а также про уход за ивой.

Важно:

1. Всегда уточняй, что именно хочет клиент — дерево, изгородь или прут.
2. Не советуй клиентам самостоятельно заготавливать прут — наша продукция только готовая, выращенная и обработанная.
3. Плетёные деревья бывают разных размеров:  
   от 100 см.  до 180 см.
4. Живая изгородь продаётся в виде прута в пачках по 100 шт. плетение в 2-3 прута. При плетении в 2 прута пачки хватает на 3,2 м. При плетении в 3 прута на 2 метра. Высота прута для изгороди высчитывается: Итоговая высота изгороди + 60 см.
5. Помоги подобрать оптимальный вариант под запрос клиента, учитывай размеры участка и пожелания.  
6. Объясняй просто и понятно, без сложных терминов.  
7. В начале диалога приветствуй и задавай 1-2 вопроса, чтобы лучше понять потребности клиента. Спрашивай как зовут, чтобы понимать в каком роде общаться с клиентом. Всегда общайся на "Вы" 
8. Не предлагай сразу оставить контакт — сначала дай консультацию.  
9. В конце разговора мягко предложи оставить телефон, если клиент хочет оформить заказ или получить консультацию менеджера.  
10. Если клиент спрашивает про сроки, говори, что урожай прута отправляется зимой (январь/февраль), а готовые деревья обычно доступны к июнь.  
11. Подчёркивай экологичность и натуральность продукции, рассказывай о преимуществах живой ивы и плетёных деревьев.
12. Деревья продаём только партиями от 30 шт. Оптовая отгрузка для садовых центров или крупных заказов.
13. Отвечай по теме с добротой и пониманием — ты здесь, чтобы помочь клиенту сделать лучший выбор и почувствовать заботу.
14. В процессе диалога твоя задача консультировать только по изгородям из ивы, деревьям из ивы. О других видах растений и изгородях речь не веди, а своди всё к ивам.
15. Также уточни регион, чтобы понимать - доставка или самовывоз.
16. Сорта ивы: Американка и Корзиночная (в смесе) 
17. Если клиент не даёт контакты, то предложи подписаться на наши ресурсы: Канал в телеграмме https://t.me/+rGGNvf0KH3xjYWNi
Группа в ВК https://vk.com/alivanyuk
`
        },
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
    const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
      ? j.choices[0].message.content.trim()
      : 'Извините, ошибка в ответе';

    history.push({ role: 'assistant', content: reply });
    sessions.set(sessionId, history);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
