import numpy as np
from sqlalchemy.orm import Session
from app.models.models import Rating, Engagement, Resource, ResourceStatus, OnboardingAnswer

# Weights for engagement score
W_RATING   = 0.35
W_WATCH    = 0.25
W_TIME     = 0.20  # time spent on page
W_COMPLETE = 0.10
W_REVISIT  = 0.10

TIME_CAP = 600  # 10 minutes = full score
BAYESIAN_M = 5    # prior count
BAYESIAN_C = 3.0  # prior mean


def engagement_score(stars: float, watch: float, revisits: int, completed: bool, time_spent: int) -> float:
    revisit_norm = min(revisits / 5.0, 1.0)
    time_norm = min(time_spent / TIME_CAP, 1.0)
    return (W_RATING * (stars / 5.0)
            + W_WATCH * watch
            + W_TIME * time_norm
            + W_REVISIT * revisit_norm
            + W_COMPLETE * float(completed))


def bayesian_avg(ratings: list[float]) -> float:
    n = len(ratings)
    if n == 0:
        return BAYESIAN_C
    return (BAYESIAN_M * BAYESIAN_C + sum(ratings)) / (BAYESIAN_M + n)


def build_user_vectors(db: Session) -> tuple[dict, list, np.ndarray]:
    """Returns (user_id -> index, resource_ids, matrix of shape [users x resources])"""
    ratings = db.query(Rating).all()
    engagements = {(e.user_id, e.resource_id): e for e in db.query(Engagement).all()}

    users = sorted(set(r.user_id for r in ratings))
    resources = sorted(set(r.resource_id for r in ratings))
    if not users or not resources:
        return {}, [], np.array([])

    u_idx = {u: i for i, u in enumerate(users)}
    r_idx = {r: i for i, r in enumerate(resources)}
    matrix = np.zeros((len(users), len(resources)))

    for rating in ratings:
        eng = engagements.get((rating.user_id, rating.resource_id))
        watch = eng.watch_completion if eng else 0.0
        revisits = eng.revisit_count if eng else 0
        completed = eng.completed if eng else False
        time_spent = eng.time_spent if eng else 0
        score = engagement_score(rating.stars, watch, revisits, completed, time_spent)
        matrix[u_idx[rating.user_id], r_idx[rating.resource_id]] = score

    return u_idx, resources, matrix


def cosine_similarities(matrix: np.ndarray, idx: int) -> np.ndarray:
    """Return cosine similarity between row `idx` and all other rows."""
    target = matrix[idx]
    target_norm = np.linalg.norm(target)
    if target_norm == 0:
        return np.zeros(len(matrix))
    row_norms = np.linalg.norm(matrix, axis=1)
    row_norms[row_norms == 0] = 1e-10
    return (matrix @ target) / (row_norms * target_norm)


def get_recommendations(user_id: int, topic_id: int, db: Session, top_n: int = 6) -> list[dict]:
    u_idx, resource_ids, matrix = build_user_vectors(db)

    # Candidate pool: approved resources NOT in the current topic
    candidates = db.query(Resource).filter(
        Resource.topic_id != topic_id,
        Resource.status == ResourceStatus.approved
    ).all()
    candidate_map = {r.id: r for r in candidates}

    if not candidate_map:
        return []

    # Cold start: user has no ratings — return most popular cross-topic resources
    if not matrix.size or user_id not in u_idx:
        return _popularity_fallback(candidate_map, db, top_n, user_id=user_id)

    idx = u_idx[user_id]
    r_col_map = {rid: i for i, rid in enumerate(resource_ids)}

    # User-based CF: compute similarity to all OTHER users, then predict scores
    sims = cosine_similarities(matrix, idx)
    sims[idx] = 0.0  # exclude the user themselves from neighbour pool

    sim_sum = np.sum(np.abs(sims))

    scores = {}
    for res_id, resource in candidate_map.items():
        ratings = [r.stars for r in db.query(Rating).filter_by(resource_id=res_id).all()]
        pop_score = bayesian_avg(ratings) / 5.0

        if res_id not in r_col_map:
            # No ratings for this resource yet — weight toward popularity only
            scores[res_id] = 0.3 * pop_score
            continue

        r_col = r_col_map[res_id]
        # Standard UBCF: weighted average of neighbours' scores, normalised by similarity sum
        if sim_sum > 0:
            cf_score = float(sims @ matrix[:, r_col]) / sim_sum
        else:
            cf_score = 0.0

        scores[res_id] = 0.6 * cf_score + 0.4 * pop_score

    if not scores:
        return _popularity_fallback(candidate_map, db, top_n, user_id=user_id)

    ranked = sorted(scores, key=scores.get, reverse=True)[:top_n]
    return [
        {"id": rid, "title": candidate_map[rid].title, "url": candidate_map[rid].url,
         "score": round(scores[rid], 4)}
        for rid in ranked
    ]


def _popularity_fallback(approved_ids: dict, db: Session, top_n: int, user_id: int = None) -> list[dict]:
    boosted_topics = set()
    if user_id:
        # Join OnboardingAnswer with OnboardingQuestion to find mapping topic_id
        answers = db.query(OnboardingAnswer).join(OnboardingAnswer.question).filter(OnboardingAnswer.user_id == user_id).all()
        for ans in answers:
            if ans.question and ans.question.topic_id:
                val = (ans.answer or "").lower().strip()
                # Positive answer filter (exclude common negatives)
                if val and not any(w in val for w in ["no", "not", "never", "don't", "dont", "nah", "none"]):
                    boosted_topics.add(ans.question.topic_id)

    scores = {}
    for rid, resource in approved_ids.items():
        ratings = [r.stars for r in db.query(Rating).filter_by(resource_id=rid).all()]
        base_score = bayesian_avg(ratings)
        # Give a substantial boost if resource belongs to an onboarding topic of interest
        if resource.topic_id in boosted_topics:
            base_score += 1.5
        scores[rid] = base_score

    ranked = sorted(scores, key=scores.get, reverse=True)[:top_n]
    return [{"id": rid, "title": approved_ids[rid].title, "url": approved_ids[rid].url, "score": round(scores[rid], 4)} for rid in ranked]
