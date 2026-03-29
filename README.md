# Aislurp

AI content discovery app. Surfaces the top 50 trending articles on AI software, AI engineering, vibe coding, and LLMs from across the web — ranked by a time-decay engagement score.

**Sources:** Hacker News · Dev.to · Lobsters · arXiv · r/MachineLearning · r/LocalLLaMA · r/singularity · r/ChatGPT · r/artificial · r/vibecoding

---

## Tech stack

- **Backend:** Node.js ≥18, Express, rss-parser
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **APIs:** All public — no API keys required

---

## Local development

```bash
# Install dependencies
npm install

# Start with auto-reload (Node 18+)
npm run dev

# Or start normally
npm start
```

The app runs at `http://localhost:3000` by default. Set the `PORT` environment variable to use a different port.

---

## Deployment

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the HTTP server listens on |

### Railway / Render / Fly.io

These platforms detect `package.json` and run `npm start` automatically.

1. Connect your GitHub repo in the platform dashboard.
2. Set `PORT` if the platform requires a specific value (Railway and Render inject it automatically).
3. Deploy — no build step needed.

```bash
# Fly.io quick-start
fly launch        # detects Node, creates fly.toml
fly deploy
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t aislurp .
docker run -p 3000:3000 aislurp
```

### VPS / bare server (systemd)

```bash
# Install deps and start
npm ci --omit=dev
node server.js
```

Create `/etc/systemd/system/aislurp.service`:

```ini
[Unit]
Description=Aislurp AI content discovery
After=network.target

[Service]
WorkingDirectory=/opt/aislurp
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=PORT=3000
# Run as a non-root user
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now aislurp
```

### Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Use [Certbot](https://certbot.eff.org/) to add HTTPS:

```bash
sudo certbot --nginx -d yourdomain.com
```

---

## Project structure

```
├── server.js          # Express server — fetches & ranks articles
├── package.json
└── public/
    ├── index.html     # App shell
    ├── style.css      # Dark theme styles
    └── app.js         # Filter, search, and render logic
```
