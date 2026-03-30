# Запуск сервера

## Локально (на своём компьютере)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
Сайт: http://localhost:8000
API документация: http://localhost:8000/api/docs

## На сервере (VPS / Render / Railway)

### Переменные окружения (обязательно смени!)
```
ADMIN_PASSWORD=твой_пароль
SECRET_KEY=любая_длинная_случайная_строка
```

### Запуск на VPS
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Для фона (чтобы не останавливался при выходе)
```bash
nohup uvicorn main:app --host 0.0.0.0 --port 8000 &
```

## Структура данных сервера
```
backend/
├── main.py
├── requirements.txt
└── data/
    ├── prices.json      ← цены
    ├── contacts.json    ← контакты
    ├── gallery/         ← фото галереи
    └── about/           ← фото блока «О нас»
```
