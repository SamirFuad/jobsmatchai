# JobsMatchAI — Deployment Guide

## Files Created

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage Docker image (Node 20 Alpine) |
| `docker-compose.yml` | One-command Docker deployment with persistent volumes |
| `.dockerignore` | Keeps Docker image lean |
| `vercel.json` | Vercel serverless deployment config |
| `.gitignore` | Git ignore rules for the repo |

---

## Option 1: Docker Deployment (Recommended for full features)

Works on: **Railway, Fly.io, Render, DigitalOcean, AWS ECS, self-hosted**

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

**Advantages:** SQLite persists via Docker volumes, file uploads work, full feature parity.

### Deploy to Railway (easiest Docker host)
1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Railway auto-detects the Dockerfile
4. Add environment variable: `SECRET_KEY=your-strong-secret`
5. Deploy!

### Deploy to Fly.io
```bash
fly launch       # auto-detects Dockerfile
fly secrets set SECRET_KEY=your-strong-secret
fly deploy
```

---

## Option 2: Vercel Deployment

Works but with **limitations** — Vercel is serverless, so:

> ⚠️ **SQLite won't persist between requests.** Each serverless function invocation starts fresh. The DB will be created in-memory each time. For production on Vercel, you'd need to migrate to a cloud database (e.g., Turso, PlanetScale, Neon).

### Steps
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → Select your repo
3. Vercel auto-detects `vercel.json`
4. Add environment variables in Vercel dashboard:
   - `SECRET_KEY` = your-strong-secret
   - `VERCEL` = 1 (auto-set by Vercel)
5. Deploy!

### Vercel Limitations
- ❌ SQLite data doesn't persist (ephemeral filesystem)
- ❌ File uploads (CV) don't persist
- ✅ API routes work
- ✅ Frontend serves correctly

---

## Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit - JobsMatchAI Platform"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/jobsmatchai.git
git branch -M main
git push -u origin main
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Server port |
| `SECRET_KEY` | (insecure default) | **Must change in production!** JWT signing key |
| `DATABASE_PATH` | `./smart_jobs.db` | SQLite database file path |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token expiry (24 hours) |
