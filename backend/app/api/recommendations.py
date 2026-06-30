from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, OnboardingQuestion, OnboardingAnswer, Resource, ResourceStatus
from app.services.recommender import get_recommendations
import datetime

router = APIRouter(prefix="/recommend", tags=["recommendations"])


from pydantic import BaseModel as _Base

class OnboardingAnswerItem(_Base):
    question_id: int
    answer: str

class OnboardingSubmit(BaseModel):
    answers: List[OnboardingAnswerItem]


@router.get("/topic/{topic_id}")
def recommend(topic_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_recommendations(current_user.id, topic_id, db)


@router.get("/home")
def home_feed(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Weekly featured resource (rotates every Monday) + personalised picks."""
    # Weekly featured: deterministic seed from ISO week number — same for everyone that week
    week = datetime.date.today().isocalendar()[1]
    year = datetime.date.today().year
    seed = year * 100 + week

    videos = db.query(Resource).filter(
        Resource.status == ResourceStatus.approved,
        Resource.resource_type == "video",
    ).order_by(Resource.id).all()

    featured = videos[seed % len(videos)] if videos else None

    # Personalised picks: cross-topic recs not tied to a specific topic (use topic_id=0)
    picks = get_recommendations(current_user.id, topic_id=0, db=db, top_n=4)

    return {
        "featured": {
            "id": featured.id,
            "title": featured.title,
            "url": featured.url,
            "topic": featured.topic.title if featured.topic else "",
        } if featured else None,
        "picks": picks,
    }


@router.get("/onboarding/questions")
def onboarding_questions(db: Session = Depends(get_db)):
    return db.query(OnboardingQuestion).all()


@router.post("/onboarding/submit")
def submit_onboarding(data: OnboardingSubmit, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Clear previous onboarding answers to prevent database bloating/duplicate rows
    db.query(OnboardingAnswer).filter_by(user_id=current_user.id).delete()
    for item in data.answers:
        db.add(OnboardingAnswer(user_id=current_user.id, question_id=item.question_id, answer=item.answer[:500]))
    db.commit()
    return {"ok": True}
