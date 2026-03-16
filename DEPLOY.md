# Production deploy

This project is a `React/Vite` frontend plus a `Node/Express` backend.
In production the backend now serves the built frontend from `client/dist`,
so `nginx` only needs to proxy requests to the Node app.

## Server layout

Recommended path on Ubuntu:

```bash
/var/www/michaelgpt
```

Expected app folders:

```bash
/var/www/michaelgpt/client
/var/www/michaelgpt/server
```

## First-time setup

Install dependencies:

```bash
cd /var/www/michaelgpt/client
npm install

cd /var/www/michaelgpt/server
npm install
```

Install and prepare Ollama:

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable ollama
sudo systemctl start ollama
ollama pull qwen2.5:0.5b
```

Create `server/.env` with at least:

```bash
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
NODE_ENV=production
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:0.5b
OLLAMA_LOW_MEMORY_MODEL=qwen2.5:0.5b
OLLAMA_LOW_MEMORY_MODE=true
OLLAMA_KEEP_ALIVE=2m
OLLAMA_NUM_CTX=1536
OLLAMA_MAX_HISTORY_MESSAGES=8
OLLAMA_MAX_HISTORY_CHARS=9000
```

For a `1 GB RAM` VPS, keep these values small. Do not use `llama3.1:8b`.

Build the frontend:

```bash
cd /var/www/michaelgpt/server
npm run build
```

## systemd

Copy the service file:

```bash
sudo cp deploy/systemd/michaelgpt.service /etc/systemd/system/michaelgpt.service
sudo systemctl daemon-reload
sudo systemctl enable michaelgpt
sudo systemctl restart michaelgpt
sudo systemctl status michaelgpt
```

## PM2

If you run the app with `pm2`, use the tuned ecosystem file for low-memory VPS:

```bash
cd /var/www/michaelgpt
pm2 delete michaelgpt || true
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
```

## nginx

Copy the nginx config:

```bash
sudo cp deploy/nginx/michaelgpt.ru.conf /etc/nginx/sites-available/michaelgpt.ru.conf
sudo ln -sf /etc/nginx/sites-available/michaelgpt.ru.conf /etc/nginx/sites-enabled/michaelgpt.ru.conf
sudo nginx -t
sudo systemctl reload nginx
```

If SSL is not installed yet, issue the certificate after the HTTP config is live:

```bash
sudo certbot --nginx -d michaelgpt.ru -d www.michaelgpt.ru
```

## Update flow

After pulling changes:

```bash
cd /var/www/michaelgpt/client
npm install

cd /var/www/michaelgpt/server
npm install
npm run build
ollama pull qwen2.5:0.5b
sudo systemctl restart michaelgpt
sudo systemctl reload nginx
```

## Quick checks

The app should answer locally:

```bash
curl http://127.0.0.1:5000/api/health
```

Expected result:

```json
{"ok":true,"aiProvider":"ollama","model":"qwen2.5:0.5b","lowMemoryModel":"qwen2.5:0.5b","numCtx":1536}
```

If the public site still returns `403`, `nginx` is still serving the wrong site
or the old site config is still enabled. Check:

```bash
sudo nginx -T | grep -n "server_name"
sudo ls -la /etc/nginx/sites-enabled
```
