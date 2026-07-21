from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.database import init_db
from app.api import auth, topics, resources, recommendations
import os, logging, time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("opic")

# Rate limiter (uses client IP)
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="Opic API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS must be outermost middleware
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
        ms = round((time.time() - start) * 1000)
        logger.info(f"{request.method} {request.url.path} → {response.status_code} ({ms}ms)")
        return response
    except Exception as exc:
        logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.include_router(auth.router)
app.include_router(topics.router)
app.include_router(resources.router)
app.include_router(recommendations.router)


@app.on_event("startup")
def startup():
    db_url = os.getenv("DATABASE_URL", "sqlite:///./opic.db")
    db_type = "PostgreSQL" if db_url.startswith("postgresql") else "SQLite (ephemeral — data will NOT persist on Render!)"
    logger.info(f"Database: {db_type}")
    init_db()
    # Safe column/table migrations for existing databases.
    # Each runs in its own transaction so one failure doesn't block the rest.
    from app.core.database import engine
    import sqlalchemy as sa
    migrations = [
        "ALTER TABLE users ADD COLUMN avatar_url VARCHAR",
        """CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            resource_id INTEGER NOT NULL REFERENCES resources(id),
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS course_requests (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            title VARCHAR NOT NULL,
            description TEXT,
            status VARCHAR DEFAULT 'pending',
            admin_note VARCHAR,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS quiz_cache (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            cache_key VARCHAR NOT NULL,
            json_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (user_id, cache_key)
        )""",
        "ALTER TABLE quiz_cache ADD COLUMN resource_hash VARCHAR",
    ]
    for sql in migrations:
        try:
            with engine.begin() as conn:   # each migration in its own transaction
                conn.execute(sa.text(sql))
        except Exception:
            pass  # already exists or not applicable


@app.get("/")
def root():
    return {"status": "ok"}
