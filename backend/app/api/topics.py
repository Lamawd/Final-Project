from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Topic, TopicPrerequisite, UserProgress, User

router = APIRouter(prefix="/topics", tags=["topics"])


class TopicCreate(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int = 0


@router.get("/")
def list_topics(db: Session = Depends(get_db)):
    topics = db.query(Topic).order_by(Topic.order_index).all()
    result = []
    for t in topics:
        prereqs = [p.prereq_id for p in t.prerequisites]
        approved = sum(1 for r in t.resources if r.status.value == "approved")
        result.append({"id": t.id, "title": t.title, "description": t.description,
                        "order_index": t.order_index, "resource_count": approved,
                        "prerequisites": prereqs})
    return result


@router.get("/{topic_id}")
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    prereqs = [p.prereq_id for p in topic.prerequisites]
    return {"id": topic.id, "title": topic.title, "description": topic.description,
            "order_index": topic.order_index, "prerequisites": prereqs}


@router.post("/", status_code=201)
def create_topic(data: TopicCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    topic = Topic(**data.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


@router.post("/{topic_id}/prerequisites/{prereq_id}")
def add_prerequisite(topic_id: int, prereq_id: int, is_hard: bool = True,
                     _: User = Depends(require_admin), db: Session = Depends(get_db)):
    db.add(TopicPrerequisite(topic_id=topic_id, prereq_id=prereq_id, is_hard=is_hard))
    db.commit()
    return {"ok": True}


@router.post("/{topic_id}/progress")
def mark_progress(topic_id: int, completed: bool = True,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    progress = db.query(UserProgress).filter_by(user_id=current_user.id, topic_id=topic_id).first()
    if progress:
        progress.completed = completed
    else:
        db.add(UserProgress(user_id=current_user.id, topic_id=topic_id, completed=completed))
    db.commit()
    return {"ok": True}


@router.get("/progress/me")
def my_progress(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(UserProgress).filter_by(user_id=current_user.id).all()
    return [{"topic_id": r.topic_id, "completed": r.completed} for r in rows]
