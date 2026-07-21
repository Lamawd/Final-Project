from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
from urllib.parse import urlparse
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Resource, ResourceStatus, Rating, Engagement, User, Comment, CourseRequest, CourseRequestStatus

router = APIRouter(prefix="/resources", tags=["resources"])


class ResourceCreate(BaseModel):
    topic_id: int
    title: str
    url: str
    resource_type: Optional[str] = "article"  # video, article, pdf, doc, other

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
        return v[:200]


class RatingCreate(BaseModel):
    stars: int
    reason: Optional[str] = None


class CommentCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        return v[:1000]


class CourseRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Course title must be at least 3 characters")
        return v[:200]


class EngagementUpdate(BaseModel):
    watch_completion: float = 0.0
    revisit_count: int = 0
    completed: bool = False
    time_spent: int = 0


@router.get("/topic/{topic_id}")
def get_by_topic(topic_id: int, db: Session = Depends(get_db)):
    resources = db.query(Resource).filter_by(topic_id=topic_id, status=ResourceStatus.approved).all()
    result = []
    for r in resources:
        stars = [rt.stars for rt in r.ratings]
        avg = round(sum(stars) / len(stars), 1) if stars else 0.0
        result.append({
            "id": r.id, "title": r.title, "url": r.url, "type": r.resource_type,
            "avg_rating": avg, "rating_count": len(stars),
            "comment_count": len(r.comments),
        })
    return result


@router.get("/{resource_id}/reviews")
def get_reviews(resource_id: int, db: Session = Depends(get_db)):
    """Return all ratings with their comments for a resource."""
    ratings = db.query(Rating).filter_by(resource_id=resource_id).all()
    result = []
    for rt in ratings:
        result.append({
            "user_id": rt.user_id,
            "username": rt.user.username if rt.user else "?",
            "avatar_url": rt.user.avatar_url if rt.user else None,
            "stars": rt.stars,
            "reason": rt.reason,
        })
    return result


@router.get("/{resource_id}/comments")
def get_comments(resource_id: int, db: Session = Depends(get_db)):
    comments = db.query(Comment).filter_by(resource_id=resource_id).order_by(Comment.created_at.desc()).all()
    return [{
        "id": c.id,
        "user_id": c.user_id,
        "username": c.user.username if c.user else "?",
        "avatar_url": c.user.avatar_url if c.user else None,
        "body": c.body,
        "created_at": c.created_at.strftime("%b %d, %Y") if c.created_at else "",
    } for c in comments]


@router.post("/{resource_id}/comments", status_code=201)
def add_comment(resource_id: int, data: CommentCreate,
                current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    resource = db.query(Resource).filter_by(id=resource_id, status=ResourceStatus.approved).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    comment = Comment(user_id=current_user.id, resource_id=resource_id, body=data.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "user_id": comment.user_id,
        "username": current_user.username,
        "avatar_url": current_user.avatar_url,
        "body": comment.body,
        "created_at": comment.created_at.strftime("%b %d, %Y"),
    }


@router.delete("/{resource_id}/comments/{comment_id}")
def delete_comment(resource_id: int, comment_id: int,
                   current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = db.query(Comment).filter_by(id=comment_id, resource_id=resource_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")
    db.delete(comment)
    db.commit()
    return {"ok": True}


@router.post("/courses/suggest", status_code=201)
def suggest_course(data: CourseRequestCreate,
                   current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = CourseRequest(user_id=current_user.id, title=data.title, description=data.description)
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"id": req.id, "title": req.title, "status": req.status}


@router.get("/courses/suggestions", dependencies=[Depends(require_admin)])
def list_course_suggestions(db: Session = Depends(get_db)):
    reqs = db.query(CourseRequest).order_by(CourseRequest.created_at.desc()).all()
    return [{
        "id": r.id, "title": r.title, "description": r.description,
        "status": r.status, "admin_note": r.admin_note,
        "requested_by": r.user.username if r.user else "?",
        "created_at": r.created_at.strftime("%b %d, %Y") if r.created_at else "",
    } for r in reqs]


@router.patch("/courses/suggestions/{req_id}", dependencies=[Depends(require_admin)])
def review_course_suggestion(req_id: int, approved: bool, admin_note: Optional[str] = None,
                              db: Session = Depends(get_db)):
    req = db.query(CourseRequest).filter_by(id=req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Not found")
    req.status = CourseRequestStatus.approved if approved else CourseRequestStatus.rejected
    req.admin_note = admin_note
    db.commit()
    return {"ok": True, "status": req.status}


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


@router.delete("/{resource_id}", dependencies=[Depends(require_admin)])
def delete_resource(resource_id: int, db: Session = Depends(get_db)):
    """Admin can permanently delete any resource regardless of status."""
    resource = db.query(Resource).filter_by(id=resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(resource)
    db.commit()
    return {"ok": True}


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
