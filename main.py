from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import os
from fastapi.middleware.cors import CORSMiddleware  # Добавили это для CORS

app = FastAPI()

# Добавляем CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем со всех доменов (или укажи ["https://alivanyuk.ru"] для безопасности)
    allow_credentials=True,
    allow_methods=["*"],  # Разрешаем все методы (GET, POST и т.д.)
    allow_headers=["*"],  # Разрешаем все заголовки
)

class Message(BaseModel):
    text: str

# Ключ возьмём из переменной окружения (безопасно)
API_KEY = os.getenv('OPENAI_API_KEY')
API_URL = "https://api.openai.com/v1/chat/completions"  # Эндпоинт OpenAI

@app.post("/chat")
async def chat(message: Message):
    if not message.text:
        raise HTTPException(status_code=400, detail="Сообщение пустое")
    
    # Подготовка запроса к OpenAI API
    payload = {
        "model": "gpt-3.5-turbo",  # Можно изменить на "gpt-4o-mini" или другую доступную модель
        "messages": [
            {"role": "system", "content": "Ты ассистент по живым изгородям из ивы. Отвечай на вопросы о посадке, уходе, заказах и доставке. Используй информацию с сайта alivanyuk.ru: прут ивы для изгородей, инструкции по посадке, доставка по России. Будь полезным и дружелюбным."},
            {"role": "user", "content": message.text}
        ],
        "temperature": 0.7,  # Сделай ответы творческими, но точными
        "max_tokens": 300  # Ограничь длину ответа, чтобы не тратить много токенов
    }
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(API_URL, json=payload, headers=headers)
    
    if response.status_code != 200:
        error_detail = response.json().get("error", {}).get("message", "Неизвестная ошибка")
        raise HTTPException(status_code=500, detail=f"Ошибка API: {error_detail}")
    
    ai_response = response.json()["choices"][0]["message"]["content"]
    return {"response": ai_response}
