import numpy as np
from sqlalchemy.orm import Session
from app.models.models import Rating, Engagement, Resource, ResourceStatus, OnboardingAnswer

# Weights for engagement score
W_RATING = 0.4
W_WATCH = 0.3
W_REVISIT = 0.2
W_COMPLETE = 0.1
BAYESIAN_M = 5  # prior count
BAYESIAN_C = 3.0  # prior mean


def engagement_score(stars: float, watch: float, revisits: int, completed: bool) -> float:
    revisit_norm = min(revisits / 5.0, 1.0)
    return W_RATING * (stars / 5.0) + W_WATCH * watch + W_REVISIT * revisit_norm + W_COMPLETE * float(completed)


def bayesian_avg(ratings: list[float]) -> float:
    n = len(ratings)
    if n == 0:
        return BAYESIAN_C
    return (BAYESIAN_M * BAYESIAN_C + sum(ratings)) / (BAYESIAN_M + n)


def build_user_vectors(db: Session) -> tuple[dict, np.ndarray]:
    """Returns (user_id -> index, matrix of shape [users x resources])"""
    ratings = db.query(Rating).all()
    engagements = {(e.user_id, e.resource_id): e for e in db.query(Engagement).all()}

    users = sorted(set(r.user_id for r in ratings))
    resources = sorted(set(r.resource_id for r in ratings))
    if not users or not resources:
        return {}, np.array([])

    u_idx = {u: i for i, u in enumerate(users)}
    r_idx = {r: i for i, r in enumerate(resources)}
    matrix = np.zeros((len(users), len(resources)))

    for rating in ratings:
        eng = engagements.get((rating.user_id, rating.resource_id))
        watch = eng.watch_completion if eng else 0.0
        revisits = eng.revisit_count if eng else 0
        completed = eng.completed if eng else False
        score = engagement_score(rating.stars, watch, revisits, completed)
        matrix[u_idx[rating.user_id], r_idx[rating.resource_id]] = score

    return u_idx, resources, matrix


def cosine_similarity_row(matrix: np.ndarray, idx: int) -> np.ndarray:
    target = matrix[idx]
    norms = np.linalg.norm(matrix, axis=1) * np.linalg.norm(target)
    norms[norms == 0] = 1e-10
    return matrix @ target / norms


def get_recommendations(user_id: int, topic_id: int, db: Session, top_n: int = 10) -> list[dict]:
    u_idx, resource_ids, matrix = build_user_vectors(db)

    approved = db.query(Resource).filter_by(topic_id=topic_id, status=ResourceStatus.approved).all()
    approved_ids = {r.id: r for r in approved}

    # Cold start: not enough data for this user
    if not matrix.size or user_id not in u_idx:
        return _popularity_fallback(approved_ids, db, top_n)

    idx = u_idx[user_id]
    similarities = cosine_similarity_row(matrix, idx)

    # Weighted scores per resource
    scores = {}
    for res_id in approved_ids:
        if res_id not in resource_ids:
            continue
        r_col = resource_ids.index(res_id)
        sim_score = float(similarities @ matrix[:, r_col]) / (len(matrix) or 1)

        ratings = [r.stars for r in db.query(Rating).filter_by(resource_id=res_id).all()]
        pop_score = bayesian_avg(ratings) / 5.0

        user_score = matrix[idx, r_col]
        scores[res_id] = 0.5 * user_score + 0.3 * sim_score + 0.2 * pop_score

    if not scores:
        return _popularity_fallback(approved_ids, db, top_n)

    ranked = sorted(scores, key=scores.get, reverse=True)[:top_n]
    return [{"id": rid, "title": approved_ids[rid].title, "url": approved_ids[rid].url, "score": round(scores[rid], 4)} for rid in ranked]


def _popularity_fallback(approved_ids: dict, db: Session, top_n: int) -> list[dict]:
    scores = {}
    for rid, resource in approved_ids.items():
        ratings = [r.stars for r in db.query(Rating).filter_by(resource_id=rid).all()]
        scores[rid] = bayesian_avg(ratings)
    ranked = sorted(scores, key=scores.get, reverse=True)[:top_n]
    return [{"id": rid, "title": approved_ids[rid].title, "url": approved_ids[rid].url, "score": round(scores[rid], 4)} for rid in ranked]
