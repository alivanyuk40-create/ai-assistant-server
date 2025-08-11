import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('.'));

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
    console.error(error);
    res.status(500).send('Ошибка при обращении к OpenAI API');
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
