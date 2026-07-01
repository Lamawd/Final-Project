# Opic — A Topic-Structured Learning Platform with User-Driven Content Personalisation

A web-based learning platform that organises content into structured topic roadmaps, lets users submit and rate resources, and recommends materials personalised to each user using collaborative filtering.

**Live demo:** https://final-project-git-main-lamawds-projects.vercel.app

---

## Features

- **Structured topic roadmaps** with prerequisite relationships across multiple courses
- **Community resource submission** — users submit links, admins approve or reject them
- **Star ratings + engagement tracking** — watch completion, time spent, revisit count, completion
- **Personalised recommendations** — user-based collaborative filtering (UBCF) with Bayesian average and cold-start fallback
- **Onboarding quiz** — seeds recommendations for new users with no history
- **AI knowledge quiz** — Gemini-generated MCQ quiz when marking a topic complete (with local fallback)
- **Progress tracking** — per-topic completion, 30-day activity heatmap, stats dashboard
- **Admin panel** — review pending submissions, manage users, review course suggestions
- **User profile** — batch resource submission, submission history, suggest new courses, change password, avatar, dark mode
- **JWT authentication** with password reset via email (SMTP)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router v6, Axios, Framer Motion |
| Backend | FastAPI, SQLAlchemy, Pydantic, python-jose, passlib/bcrypt |
| Database | PostgreSQL (production), SQLite (development) |
| ML | NumPy, scikit-learn (cosine similarity, UBCF) |
| AI | Google Gemini 2.0 Flash API |
| Deployment | Vercel (frontend), Render (backend + database) |
| CI | GitHub Actions |

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers (auth, topics, resources, recommend)
│   │   ├── core/         # Database setup, JWT, password hashing
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── services/     # Recommendation engine
│   │   └── main.py       # FastAPI app, middleware, startup
│   ├── tests/            # pytest test suite
│   ├── seed.py           # Database seeding script
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── Procfile          # Render deployment
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios client
│   │   ├── components/   # Shared components
│   │   ├── context/      # Auth context
│   │   ├── pages/        # Page components
│   │   └── App.jsx       # Routes
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env — set SECRET_KEY at minimum

# Seed the database (creates tables + sample data)
python seed.py

# Start the development server
uvicorn app.main:app --reload
# API docs available at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install

# Copy and configure environment variables
cp .env.example .env
# Set VITE_API_URL=http://localhost:8000 for local dev

npm run dev
# App available at http://localhost:5173
```

### Docker (full stack)

```bash
docker-compose up --build
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `SECRET_KEY` | JWT signing key (required, min 32 chars) | — |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `60` |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./opic.db` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:5173` |
| `GEMINI_API_KEY` | Google AI Studio API key (optional) | — |
| `SMTP_HOST` | SMTP server for password reset emails | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username/email | — |
| `SMTP_PASS` | SMTP password/app password | — |

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` |

---

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest
```

---

## Default Dev Credentials

| Account | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| User | `alice` | `alice123` |
| User | `bob` | `bob123` |

> These are seeded by `seed.py` for development only. Change them before any production deployment.

---

## Deployment

The production deployment uses:
- **Render** for the backend (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) and managed PostgreSQL
- **Vercel** for the frontend (static build)
- **GitHub Actions** runs `pytest` on every push to `main`

See `backend/Procfile` and `frontend/vercel.json` for deployment configuration.

---

## Author

Vũ Tùng Lâm — 22BI13241  
University of Science and Technology of Hanoi (USTH)  
Bachelor Thesis, 2026
