from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
from urllib.parse import urlparse
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Resource, ResourceStatus, Rating, Engagement, User

router = APIRouter(prefix="/resources", tags=["resources"])


class ResourceCreate(BaseModel):
    topic_id: int
    title: str
    url: str
    resource_type: Optional[str] = "article"

    @field_validator("url")
    @classmethod
    def safe_url(cls, v: str) -> str:
        parsed = urlparse(v.strip())
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must start with http:// or https://")
        if not parsed.netloc:
            raise ValueError("Invalid URL")
        return v.strip()

    @field_validator("title")
    @classmethod
    def non_empty_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v[:200]  # cap length


class RatingCreate(BaseModel):
    stars: int  # 1-5
    reason: Optional[str] = None  # optional low-rating feedback


class EngagementUpdate(BaseModel):
    watch_completion: float = 0.0
    revisit_count: int = 0
    completed: bool = False
    time_spent: int = 0  # seconds


@router.get("/topic/{topic_id}")
def get_by_topic(topic_id: int, db: Session = Depends(get_db)):
    resources = db.query(Resource).filter_by(topic_id=topic_id, status=ResourceStatus.approved).all()
    result = []
    for r in resources:
        stars = [rt.stars for rt in r.ratings]
        avg = round(sum(stars) / len(stars), 1) if stars else 0.0
        result.append({"id": r.id, "title": r.title, "url": r.url, "type": r.resource_type,
                        "avg_rating": avg, "rating_count": len(stars)})
    return result


@router.post("/", status_code=201)
def upload_resource(data: ResourceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    resource = Resource(**data.model_dump(), uploader_id=current_user.id)
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return {"id": resource.id, "status": resource.status}


@router.post("/{resource_id}/rate")
def rate(resource_id: int, data: RatingCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not 1 <= data.stars <= 5:
        raise HTTPException(status_code=400, detail="Stars must be 1-5")
    rating = db.query(Rating).filter_by(user_id=current_user.id, resource_id=resource_id).first()
    if rating:
        rating.stars = data.stars
        rating.reason = data.reason
    else:
        db.add(Rating(user_id=current_user.id, resource_id=resource_id, stars=data.stars, reason=data.reason))
    db.commit()
    all_stars = [r.stars for r in db.query(Rating).filter_by(resource_id=resource_id).all()]
    avg = round(sum(all_stars) / len(all_stars), 1) if all_stars else 0.0
    return {"ok": True, "avg_rating": avg, "rating_count": len(all_stars)}


@router.post("/{resource_id}/engage")
def engage(resource_id: int, data: EngagementUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import datetime
    eng = db.query(Engagement).filter_by(user_id=current_user.id, resource_id=resource_id).first()
    if eng:
        eng.watch_completion = data.watch_completion
        eng.revisit_count = data.revisit_count
        eng.time_spent = max(eng.time_spent, data.time_spent)
        if data.completed and not eng.completed:
            eng.completed_at = datetime.utcnow()
        eng.completed = data.completed
    else:
        db.add(Engagement(
            user_id=current_user.id, resource_id=resource_id,
            watch_completion=data.watch_completion, revisit_count=data.revisit_count,
            completed=data.completed, time_spent=data.time_spent,
            completed_at=datetime.utcnow() if data.completed else None,
        ))
    db.commit()
    return {"ok": True}


# Admin review endpoints
@router.get("/pending", dependencies=[Depends(require_admin)])
def pending_resources(db: Session = Depends(get_db)):
    resources = db.query(Resource).filter_by(status=ResourceStatus.pending).all()
    return [{
        "id": r.id,
        "title": r.title,
        "url": r.url,
        "type": r.resource_type,
        "topic": r.topic.title.replace(r.topic.title.split(":")[0] + ": ", "") if r.topic else "",
        "course": r.topic.title.split(":")[0] if r.topic else "",
        "uploader": r.uploader.username if r.uploader else "unknown",
        "submitted": r.created_at.strftime("%b %d, %Y") if r.created_at else "",
    } for r in resources]


@router.post("/{resource_id}/review")
def review(resource_id: int, approved: bool, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
    resource.status = ResourceStatus.approved if approved else ResourceStatus.rejected
    db.commit()
    return {"status": resource.status}


@router.get("/admin/all", dependencies=[Depends(require_admin)])
def all_resources(db: Session = Depends(get_db)):
    """All resources with status — for admin overview."""
    resources = db.query(Resource).order_by(Resource.created_at.desc()).all()
    return [{
        "id": r.id,
        "title": r.title,
        "url": r.url,
        "type": r.resource_type,
        "status": r.status.value,
        "topic": r.topic.title.replace(r.topic.title.split(":")[0] + ": ", "") if r.topic else "",
        "course": r.topic.title.split(":")[0] if r.topic else "",
        "uploader": r.uploader.username if r.uploader else "unknown",
        "submitted": r.created_at.strftime("%b %d, %Y") if r.created_at else "",
    } for r in resources]
