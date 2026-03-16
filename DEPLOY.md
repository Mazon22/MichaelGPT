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

Create `server/.env` with at least:

```bash
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
GROQ_API_KEY=replace-with-your-key
NODE_ENV=production
```

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
{"ok":true}
```

If the public site still returns `403`, `nginx` is still serving the wrong site
or the old site config is still enabled. Check:

```bash
sudo nginx -T | grep -n "server_name"
sudo ls -la /etc/nginx/sites-enabled
```
