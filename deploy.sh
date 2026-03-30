#!/bin/bash
# Скрипт деплоя на чистый Ubuntu VPS
# Запускай от root: bash deploy.sh

set -e

REPO="https://github.com/SergeyGusev1/krestik-i-nolik.git"
APP_DIR="/var/www/krestik"
SERVICE="krestik"

echo "=== 1. Обновляем систему ==="
apt update && apt upgrade -y
apt install -y python3-pip python3-venv git nginx certbot python3-certbot-nginx

echo "=== 2. Клонируем репозиторий ==="
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO" "$APP_DIR"
fi

echo "=== 3. Устанавливаем зависимости ==="
cd "$APP_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

echo "=== 4. Создаём папки для загрузок ==="
mkdir -p data/gallery data/about

echo "=== 5. Настраиваем systemd сервис ==="
cat > /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=Крестик и Нолик FastAPI
After=network.target

[Service]
User=www-data
WorkingDirectory=$APP_DIR/backend
ExecStart=$APP_DIR/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
Environment="ADMIN_PASSWORD=ЗАМЕНИ_НА_СВОЙ_ПАРОЛЬ"
Environment="SECRET_KEY=ЗАМЕНИ_НА_ДЛИННУЮ_СТРОКУ"

[Install]
WantedBy=multi-user.target
EOF

chown -R www-data:www-data "$APP_DIR"
systemctl daemon-reload
systemctl enable $SERVICE
systemctl restart $SERVICE

echo "=== 6. Настраиваем Nginx ==="
read -p "Введи домен (например site.ru или IP сервера): " DOMAIN

cat > /etc/nginx/sites-available/$SERVICE <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$SERVICE /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "=== Готово! Сайт доступен на http://$DOMAIN ==="
echo ""
read -p "Настроить SSL (HTTPS)? Нужен домен направленный на этот IP [y/n]: " SSL
if [ "$SSL" = "y" ]; then
  certbot --nginx -d "$DOMAIN"
  echo "HTTPS настроен!"
fi

echo ""
echo "Полезные команды:"
echo "  Статус:       systemctl status $SERVICE"
echo "  Перезапуск:   systemctl restart $SERVICE"
echo "  Логи:         journalctl -u $SERVICE -f"
echo "  Обновить код: cd $APP_DIR && git pull && systemctl restart $SERVICE"
