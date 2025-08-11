import express from 'express';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Загружаем базу знаний из JSON ---
let knowledgeChunks = [];
try {
  const raw = fs.readFileSync('./knowledge.json', 'utf8');
  const data = JSON.parse(raw);
  knowledgeChunks = data.map(item => item.text);
  console.log(`Knowledge base loaded: ${knowledgeChunks.length} chunks`);
} catch (e) {
  console.error('Error loading knowledge base:', e);
}

// --- Простейший поиск по базе: ищем все chunks, которые содержат хотя бы одно ключевое слово из сообщения ---
// Можно заменить на более умный поиск / векторный поиск в будущем
function searchKnowledge(message) {
  const keywords = message.toLowerCase().split(/\W+/).filter(Boolean);
  // фильтруем куски, где есть совпадение хотя бы по одному слову из запроса
  const relevant = knowledgeChunks.filter(chunk => {
    const chunkLower = chunk.toLowerCase();
    return keywords.some(word => chunkLower.includes(word));
  });
  // Возвращаем до 5 релевантных кусков, чтобы не слишком большой prompt
  return relevant.slice(0, 5).join('\n\n');
}

app.post('/chat', async (req, res) => {
  try {
    const { history, message } = req.body;

    if (!message || !history) {
      return res.status(400).json({ error: 'Missing message or history' });
    }

    // Поиск релевантных знаний
    const relevant = searchKnowledge(message);

    // Формируем сообщения для OpenAI
    const messages = [
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
      ...history,
      { role: 'user', content: message }
    ];

    // Вызов OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI API error:', err);
      return res.status(500).json({ error: 'Ошибка при запросе к OpenAI' });
    }

    const data = await response.json();

    const assistantMessage = data.choices[0].message;

    return res.json({ message: assistantMessage });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
