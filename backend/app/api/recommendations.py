from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, OnboardingQuestion, OnboardingAnswer
from app.services.recommender import get_recommendations

router = APIRouter(prefix="/recommend", tags=["recommendations"])


class OnboardingSubmit(BaseModel):
    answers: List[dict]  # [{question_id, answer}]


@router.get("/topic/{topic_id}")
def recommend(topic_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_recommendations(current_user.id, topic_id, db)


@router.get("/onboarding/questions")
def onboarding_questions(db: Session = Depends(get_db)):
    return db.query(OnboardingQuestion).all()


@router.post("/onboarding/submit")
def submit_onboarding(data: OnboardingSubmit, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for item in data.answers:
        db.add(OnboardingAnswer(user_id=current_user.id, question_id=item["question_id"], answer=item["answer"]))
    db.commit()
    return {"ok": True}
