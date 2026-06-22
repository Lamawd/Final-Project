# Opic — Learning Platform

## Quick Start (10-day guide)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python seed.py              # creates DB + admin user
uvicorn app.main:app --reload
# API docs: http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

---

## 10-Day Plan

| Day | Task |
|-----|------|
| 1 | Set up, run seed, verify auth login/register works end-to-end |
| 2 | Topic list page + topic detail page fully working |
| 3 | Resource upload + admin review flow |
| 4 | Ratings (star UI) + engagement tracking on watch/complete |
| 5 | Recommendations showing on topic detail |
| 6 | Onboarding quiz UI + cold-start fallback |
| 7 | Progress tracking UI (tick off topics) |
| 8 | Polish UI, add basic CSS/styling |
| 9 | Test all flows end-to-end, fix bugs |
| 10 | Final prep, demo script, backup |

---

## Architecture

```
frontend (React + Vite)
    ↕ HTTP/JSON
backend (FastAPI)
    ├── /auth      — register, login, JWT
    ├── /topics    — topic map + progress
    ├── /resources — upload, review, rate, engage
    └── /recommend — cosine similarity + Bayesian avg
    ↕
SQLite (dev) / PostgreSQL (prod)
```

## Key Credentials (dev)
- Admin: `admin` / `admin123`
- API docs: http://localhost:8000/docs
