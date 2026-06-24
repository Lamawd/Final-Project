from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, get_current_user, require_admin
from app.models.models import User, PasswordResetToken
import secrets, os
from datetime import datetime, timedelta
import aiosmtplib
from email.mime.text import MIMEText

router = APIRouter(prefix="/auth", tags=["auth"])

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
APP_URL   = os.getenv("APP_URL", "http://localhost:5173")

async def send_reset_email(to_email: str, token: str):
    body = f"""Hi,

You requested a password reset for your Opic account.

Your reset code is:

        {token}

Enter this code at: {APP_URL}/reset-password?email={to_email}

This code expires in 10 minutes.
If you didn't request this, ignore this email — your password won't change.
"""
    msg = MIMEText(body)
    msg["Subject"] = f"Opic — Your reset code: {token}"
    msg["From"]    = SMTP_USER
    msg["To"]      = to_email

    await aiosmtplib.send(
        msg,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        username=SMTP_USER,
        password=SMTP_PASS,
        start_tls=True,
    )


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(username=req.username, email=req.email, hashed_password=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username}


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
    return {"access_token": token}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email, "is_admin": current_user.is_admin}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(req: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"ok": True}


@router.get("/me/submissions")
def my_submissions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.models import Resource, Topic
    resources = db.query(Resource).filter_by(uploader_id=current_user.id).order_by(Resource.created_at.desc()).all()
    return [
        {"id": r.id, "title": r.title, "url": r.url, "type": r.resource_type,
         "status": r.status.value, "topic": r.topic.title if r.topic else ""}
        for r in resources
    ]


@router.get("/admin/users", dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    from app.models.models import Resource, UserProgress
    users = db.query(User).order_by(User.created_at).all()
    return [{
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "is_admin": u.is_admin,
        "joined": u.created_at.strftime("%b %d, %Y") if u.created_at else "",
        "submissions": db.query(Resource).filter_by(uploader_id=u.id).count(),
        "completed": db.query(UserProgress).filter_by(user_id=u.id, completed=True).count(),
    } for u in users]


@router.delete("/admin/users/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
    db.delete(user)
    db.commit()
    return {"ok": True}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=req.email).first()
    # Always return 200 to avoid user enumeration
    if not user:
        return {"ok": True}

    # Invalidate any existing tokens for this user
    db.query(PasswordResetToken).filter_by(user_id=user.id).delete()

    token = secrets.token_hex(3).upper()  # 6-char code e.g. "A3F9C2"
    expires = datetime.utcnow() + timedelta(minutes=10)
    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires))
    db.commit()

    if not SMTP_USER:
        # No SMTP configured — surface token in response for dev only
        return {"ok": True, "dev_token": token}

    try:
        await send_reset_email(user.email, token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")
    return {"ok": True}


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=req.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid code")

    record = db.query(PasswordResetToken).filter_by(user_id=user.id, token=req.token.upper()).first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid code")
    if record.expires_at < datetime.utcnow():
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="Code expired")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.hashed_password = hash_password(req.new_password)
    db.delete(record)
    db.commit()
    return {"ok": True}
