import os
import json
import uuid
import shutil
import httpx
from pathlib import Path
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ─────────────────────────────────────────────
#  КОНФИГ  (смени через .env или напрямую)
# ─────────────────────────────────────────────
ADMIN_PASSWORD   = os.getenv("ADMIN_PASSWORD", "krestik2025")
SECRET_KEY       = os.getenv("SECRET_KEY",      "super-secret-key-change-me")
TG_TOKEN         = os.getenv("TG_TOKEN",        "")   # токен бота от @BotFather
TG_CHAT_ID       = os.getenv("TG_CHAT_ID",      "")   # твой chat_id
TOKEN_EXPIRE_H   = 24
MAX_UPLOAD_MB    = 10
ALLOWED_TYPES    = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# ─────────────────────────────────────────────
#  ПУТИ
# ─────────────────────────────────────────────
BASE_DIR     = Path(__file__).parent          # backend/
FRONTEND_DIR = BASE_DIR.parent                # корень проекта (index.html)
DATA_DIR     = BASE_DIR / "data"
GALLERY_DIR  = DATA_DIR / "gallery"
ABOUT_DIR    = DATA_DIR / "about"
PRICES_FILE   = DATA_DIR / "prices.json"
CONTACTS_FILE = DATA_DIR / "contacts.json"
BOOKINGS_FILE = DATA_DIR / "bookings.json"

for d in [DATA_DIR, GALLERY_DIR, ABOUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
#  ДЕФОЛТНЫЕ ДАННЫЕ
# ─────────────────────────────────────────────
DEFAULT_PRICES = {
    "basic":           "150 ₽",
    "basic-label":     "Будни 14:00 – 20:00",
    "evening":         "200 ₽",
    "evening-label":   "Ежедневно с 20:00",
    "ps5":             "350 ₽",
    "ps5-label":       "Дополнительно к основному",
    "hookah-standard": "700 ₽",
    "hookah-double":   "1 000 ₽",
    "hookah-author":   "1 200 ₽",
    "hookah-relight":  "200 ₽",
}

DEFAULT_CONTACTS = {
    "phone-raw":      "79939666272",
    "phone-display":  "+7 993 966-62-72",
    "address":        "Шоссе в Лаврики, 83<br />Мурино, Ленинградская область<br />(цокольный этаж)",
    "address-short":  "Шоссе в Лаврики, 83",
    "hours-weekday":  "14:00 – 02:00",
    "hours-weekend":  "14:00 – 03:00",
    "vk":             "https://vk.com/krestikinolik83",
    "tg":             "https://t.me/+79939666272",
    "wa":             "https://wa.me/79939666272",
}

# ─────────────────────────────────────────────
#  ХЕЛПЕРЫ
# ─────────────────────────────────────────────
def load_json(path: Path, default: dict) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default.copy()

def save_json(path: Path, data: dict):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def make_token() -> str:
    payload = {"exp": datetime.now(tz=timezone.utc) + timedelta(hours=TOKEN_EXPIRE_H)}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def require_admin(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Требуется авторизация")
    token = authorization.removeprefix("Bearer ")
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Сессия истекла, войдите снова")
    except jwt.PyJWTError:
        raise HTTPException(401, "Неверный токен")

def check_upload(file: UploadFile):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Разрешены только изображения (JPG, PNG, WEBP)")
    # Размер проверим после чтения

# ─────────────────────────────────────────────
#  APP
# ─────────────────────────────────────────────
app = FastAPI(title="Крестик и Нолик", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
#  МОДЕЛИ
# ─────────────────────────────────────────────
class LoginRequest(BaseModel):
    password: str

class BookingRequest(BaseModel):
    name:    str
    phone:   str
    date:    str
    time:    str
    people:  str
    service: str = ""
    comment: str = ""

# ─────────────────────────────────────────────
#  TELEGRAM
# ─────────────────────────────────────────────
async def send_telegram(text: str):
    """Отправляет сообщение владельцу в Telegram. Молча пропускает если не настроен."""
    if not TG_TOKEN or not TG_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, json={
                "chat_id":    TG_CHAT_ID,
                "text":       text,
                "parse_mode": "HTML",
            })
    except Exception:
        pass  # не блокируем сайт если Telegram недоступен

# ─────────────────────────────────────────────
#  AUTH
# ─────────────────────────────────────────────
@app.post("/api/auth")
def login(req: LoginRequest):
    if req.password != ADMIN_PASSWORD:
        raise HTTPException(403, "Неверный пароль")
    return {"token": make_token()}

# ─────────────────────────────────────────────
#  PRICES
# ─────────────────────────────────────────────
@app.get("/api/prices")
def get_prices():
    return load_json(PRICES_FILE, DEFAULT_PRICES)

@app.post("/api/prices")
def update_prices(data: dict, _=Depends(require_admin)):
    current = load_json(PRICES_FILE, DEFAULT_PRICES)
    current.update({k: v for k, v in data.items() if v})
    save_json(PRICES_FILE, current)
    return current

# ─────────────────────────────────────────────
#  CONTACTS
# ─────────────────────────────────────────────
@app.get("/api/contacts")
def get_contacts():
    return load_json(CONTACTS_FILE, DEFAULT_CONTACTS)

@app.post("/api/contacts")
def update_contacts(data: dict, _=Depends(require_admin)):
    current = load_json(CONTACTS_FILE, DEFAULT_CONTACTS)
    current.update({k: v for k, v in data.items() if v})
    save_json(CONTACTS_FILE, current)
    return current

# ─────────────────────────────────────────────
#  BOOKING
# ─────────────────────────────────────────────
@app.post("/api/booking")
async def create_booking(req: BookingRequest):
    # Сохраняем в файл
    bookings = json.loads(BOOKINGS_FILE.read_text(encoding="utf-8")) if BOOKINGS_FILE.exists() else []
    entry = {
        "id":      str(uuid.uuid4())[:8],
        "created": datetime.now(tz=timezone.utc).strftime("%d.%m.%Y %H:%M"),
        "name":    req.name,
        "phone":   req.phone,
        "date":    req.date,
        "time":    req.time,
        "people":  req.people,
        "service": req.service,
        "comment": req.comment,
    }
    bookings.append(entry)
    BOOKINGS_FILE.write_text(json.dumps(bookings, ensure_ascii=False, indent=2), encoding="utf-8")

    # Отправляем в Telegram
    service_line = f"\n🎮 <b>Услуги:</b> {req.service}" if req.service else ""
    comment_line = f"\n💬 <b>Комментарий:</b> {req.comment}" if req.comment else ""
    msg = (
        f"📅 <b>Новая заявка на бронирование!</b>\n\n"
        f"👤 <b>Имя:</b> {req.name}\n"
        f"📞 <b>Телефон:</b> {req.phone}\n"
        f"📆 <b>Дата:</b> {req.date}\n"
        f"⏰ <b>Время:</b> {req.time}\n"
        f"👥 <b>Гостей:</b> {req.people}"
        f"{service_line}"
        f"{comment_line}\n\n"
        f"#заявка #{entry['id']}"
    )
    await send_telegram(msg)

    return {"ok": True, "id": entry["id"]}

@app.get("/api/bookings")
def get_bookings(_=Depends(require_admin)):
    """Список всех заявок — только для администратора."""
    if not BOOKINGS_FILE.exists():
        return []
    return json.loads(BOOKINGS_FILE.read_text(encoding="utf-8"))

# ─────────────────────────────────────────────
#  GALLERY
# ─────────────────────────────────────────────
@app.get("/api/gallery")
def get_gallery():
    files = sorted(GALLERY_DIR.iterdir(), key=lambda f: f.stat().st_mtime)
    return [
        {"filename": f.name, "url": f"/uploads/gallery/{f.name}"}
        for f in files if f.is_file()
    ]

@app.post("/api/gallery")
async def upload_gallery(
    file: UploadFile = File(...),
    _=Depends(require_admin),
):
    check_upload(file)
    content = await file.read()
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"Файл превышает {MAX_UPLOAD_MB} МБ")
    ext      = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    (GALLERY_DIR / filename).write_bytes(content)
    return {"filename": filename, "url": f"/uploads/gallery/{filename}"}

@app.delete("/api/gallery/{filename}")
def delete_gallery(filename: str, _=Depends(require_admin)):
    path = GALLERY_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "Файл не найден")
    # Защита от path traversal
    path.resolve().relative_to(GALLERY_DIR.resolve())
    path.unlink()
    return {"ok": True}

# ─────────────────────────────────────────────
#  ABOUT PHOTOS
# ─────────────────────────────────────────────
ABOUT_SLOTS = {"main", "games", "ps5"}

@app.get("/api/about")
def get_about():
    result = {}
    for slot in ABOUT_SLOTS:
        matches = list(ABOUT_DIR.glob(f"{slot}.*"))
        if matches:
            result[slot] = f"/uploads/about/{matches[0].name}"
    return result

@app.post("/api/about/{slot}")
async def upload_about(
    slot: str,
    file: UploadFile = File(...),
    _=Depends(require_admin),
):
    if slot not in ABOUT_SLOTS:
        raise HTTPException(400, "Неверный слот")
    check_upload(file)
    content = await file.read()
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"Файл превышает {MAX_UPLOAD_MB} МБ")
    # Удаляем старый файл этого слота
    for old in ABOUT_DIR.glob(f"{slot}.*"):
        old.unlink()
    ext  = Path(file.filename).suffix.lower()
    dest = ABOUT_DIR / f"{slot}{ext}"
    dest.write_bytes(content)
    return {"slot": slot, "url": f"/uploads/about/{dest.name}"}

# ─────────────────────────────────────────────
#  СТАТИКА (порядок важен!)
# ─────────────────────────────────────────────
# 1. Загруженные файлы
app.mount("/uploads", StaticFiles(directory=str(DATA_DIR)), name="uploads")
# 2. Фронтенд (index.html, styles.css, script.js …)
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
