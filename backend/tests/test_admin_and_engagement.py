"""
Tests for admin resource review flow and user engagement tracking.

These cover the two most business-critical workflows that were previously untested:
  1. Admin approves / rejects a pending resource submission
  2. User engagement data (watch completion, time spent, revisits, completion)
     is recorded and retrieved correctly
"""
import pytest
from app.models.models import (
    User, Topic, Resource, ResourceStatus,
    Rating, Engagement,
)
from app.core.security import create_access_token
from app.services.recommender import engagement_score


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db, username, email, is_admin=False):
    from app.core.security import hash_password
    u = User(
        username=username,
        email=email,
        hashed_password=hash_password("password123"),
        is_admin=is_admin,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _token(user_id: int) -> str:
    return create_access_token({"sub": str(user_id)})


def _auth(user_id: int) -> dict:
    return {"Authorization": f"Bearer {_token(user_id)}"}


def _make_topic(db, title="Test: Topic", order_index=1):
    t = Topic(title=title, description="A test topic", order_index=order_index)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def _make_resource(db, topic_id, uploader_id, status=ResourceStatus.pending):
    r = Resource(
        topic_id=topic_id,
        uploader_id=uploader_id,
        title="Test Resource",
        url="https://example.com/test",
        resource_type="article",
        status=status,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


# ===========================================================================
# ADMIN REVIEW TESTS
# ===========================================================================

class TestAdminReview:
    """Admin can approve or reject pending resource submissions."""

    def test_pending_list_requires_admin(self, client, db):
        """Non-admin users cannot access the pending resources list."""
        user = _make_user(db, "regular", "regular@example.com", is_admin=False)
        resp = client.get("/resources/pending", headers=_auth(user.id))
        assert resp.status_code == 403

    def test_pending_list_returns_pending_only(self, client, db):
        """GET /resources/pending returns only resources with status=pending."""
        admin = _make_user(db, "admin", "admin@example.com", is_admin=True)
        uploader = _make_user(db, "uploader", "uploader@example.com")
        topic = _make_topic(db)

        pending = _make_resource(db, topic.id, uploader.id, ResourceStatus.pending)
        _make_resource(db, topic.id, uploader.id, ResourceStatus.approved)  # should not appear

        resp = client.get("/resources/pending", headers=_auth(admin.id))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == pending.id

    def test_approve_resource(self, client, db):
        """Admin approving a resource sets status to approved."""
        admin = _make_user(db, "admin", "admin@example.com", is_admin=True)
        uploader = _make_user(db, "uploader", "uploader@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, uploader.id)

        resp = client.post(
            f"/resources/{resource.id}/review",
            params={"approved": True},
            headers=_auth(admin.id),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

        # Verify in DB
        db.refresh(resource)
        assert resource.status == ResourceStatus.approved

    def test_reject_resource(self, client, db):
        """Admin rejecting a resource sets status to rejected."""
        admin = _make_user(db, "admin", "admin@example.com", is_admin=True)
        uploader = _make_user(db, "uploader", "uploader@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, uploader.id)

        resp = client.post(
            f"/resources/{resource.id}/review",
            params={"approved": False},
            headers=_auth(admin.id),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

        db.refresh(resource)
        assert resource.status == ResourceStatus.rejected

    def test_review_requires_admin(self, client, db):
        """Non-admin cannot approve or reject resources."""
        user = _make_user(db, "regular", "regular@example.com", is_admin=False)
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id)

        resp = client.post(
            f"/resources/{resource.id}/review",
            params={"approved": True},
            headers=_auth(user.id),
        )
        assert resp.status_code == 403

    def test_approved_resource_visible_on_topic_page(self, client, db):
        """After approval, resource appears in GET /resources/topic/{id}."""
        admin = _make_user(db, "admin", "admin@example.com", is_admin=True)
        uploader = _make_user(db, "uploader", "uploader@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, uploader.id, ResourceStatus.pending)

        # Not visible yet
        resp = client.get(f"/resources/topic/{topic.id}")
        assert len(resp.json()) == 0

        # Approve
        client.post(
            f"/resources/{resource.id}/review",
            params={"approved": True},
            headers=_auth(admin.id),
        )

        # Now visible
        resp = client.get(f"/resources/topic/{topic.id}")
        assert len(resp.json()) == 1
        assert resp.json()[0]["id"] == resource.id

    def test_rejected_resource_not_visible_on_topic_page(self, client, db):
        """Rejected resources do NOT appear in the topic page."""
        admin = _make_user(db, "admin", "admin@example.com", is_admin=True)
        uploader = _make_user(db, "uploader", "uploader@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, uploader.id, ResourceStatus.pending)

        client.post(
            f"/resources/{resource.id}/review",
            params={"approved": False},
            headers=_auth(admin.id),
        )

        resp = client.get(f"/resources/topic/{topic.id}")
        assert len(resp.json()) == 0

    def test_admin_delete_resource(self, client, db):
        """Admin can permanently delete any resource."""
        admin = _make_user(db, "admin", "admin@example.com", is_admin=True)
        uploader = _make_user(db, "uploader", "uploader@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, uploader.id, ResourceStatus.approved)

        resp = client.delete(
            f"/resources/{resource.id}",
            headers=_auth(admin.id),
        )
        assert resp.status_code == 200

        # Should be gone
        from app.models.models import Resource as Res
        assert db.query(Res).filter_by(id=resource.id).first() is None

    def test_non_admin_cannot_delete_resource(self, client, db):
        """Non-admin users cannot delete resources."""
        user = _make_user(db, "regular", "regular@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        resp = client.delete(
            f"/resources/{resource.id}",
            headers=_auth(user.id),
        )
        assert resp.status_code == 403


# ===========================================================================
# ENGAGEMENT TRACKING TESTS
# ===========================================================================

class TestEngagementTracking:
    """Engagement data (watch completion, time spent, revisits, completion)
    is stored correctly and feeds the recommendation engine."""

    def test_engage_creates_record(self, client, db):
        """POST /resources/{id}/engage creates an engagement record."""
        user = _make_user(db, "learner", "learner@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        resp = client.post(
            f"/resources/{resource.id}/engage",
            json={
                "watch_completion": 0.75,
                "revisit_count": 1,
                "completed": False,
                "time_spent": 180,
            },
            headers=_auth(user.id),
        )
        assert resp.status_code == 200

        eng = db.query(Engagement).filter_by(
            user_id=user.id, resource_id=resource.id
        ).first()
        assert eng is not None
        assert eng.watch_completion == pytest.approx(0.75)
        assert eng.time_spent == 180
        assert eng.completed is False

    def test_engage_updates_existing_record(self, client, db):
        """Subsequent engage calls update the existing record, not create duplicates."""
        user = _make_user(db, "learner", "learner@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        client.post(
            f"/resources/{resource.id}/engage",
            json={"watch_completion": 0.5, "revisit_count": 0,
                  "completed": False, "time_spent": 100},
            headers=_auth(user.id),
        )
        client.post(
            f"/resources/{resource.id}/engage",
            json={"watch_completion": 1.0, "revisit_count": 1,
                  "completed": True, "time_spent": 300},
            headers=_auth(user.id),
        )

        records = db.query(Engagement).filter_by(
            user_id=user.id, resource_id=resource.id
        ).all()
        # Must be exactly one record — no duplicates
        assert len(records) == 1
        assert records[0].watch_completion == pytest.approx(1.0)
        assert records[0].completed is True

    def test_engage_time_spent_takes_maximum(self, client, db):
        """time_spent always keeps the maximum seen — never goes backward."""
        user = _make_user(db, "learner", "learner@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        client.post(
            f"/resources/{resource.id}/engage",
            json={"watch_completion": 0.0, "revisit_count": 0,
                  "completed": False, "time_spent": 500},
            headers=_auth(user.id),
        )
        # Send a lower time_spent (simulating a stale client update)
        client.post(
            f"/resources/{resource.id}/engage",
            json={"watch_completion": 0.0, "revisit_count": 0,
                  "completed": False, "time_spent": 50},
            headers=_auth(user.id),
        )

        eng = db.query(Engagement).filter_by(
            user_id=user.id, resource_id=resource.id
        ).first()
        # Should keep 500, not be overwritten with 50
        assert eng.time_spent == 500

    def test_complete_sets_completed_at_timestamp(self, client, db):
        """When completed=True, completed_at timestamp is set."""
        user = _make_user(db, "learner", "learner@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        client.post(
            f"/resources/{resource.id}/engage",
            json={"watch_completion": 1.0, "revisit_count": 0,
                  "completed": True, "time_spent": 600},
            headers=_auth(user.id),
        )

        eng = db.query(Engagement).filter_by(
            user_id=user.id, resource_id=resource.id
        ).first()
        assert eng.completed is True
        assert eng.completed_at is not None

    def test_engagement_score_formula_caps(self):
        """Engagement score never exceeds 1.0 even with extreme input values."""
        score = engagement_score(
            stars=5.0, watch=1.0, revisits=999, completed=True, time_spent=99999
        )
        assert score == pytest.approx(1.0)

    def test_engagement_score_partial(self):
        """Partial engagement produces a value between 0 and 1."""
        # 3 stars (0.35 * 0.6 = 0.21), 50% watch (0.125), 300s (0.10), 0 revisits, not complete
        score = engagement_score(
            stars=3.0, watch=0.5, revisits=0, completed=False, time_spent=300
        )
        expected = 0.35 * (3.0 / 5.0) + 0.25 * 0.5 + 0.20 * (300 / 600)
        assert score == pytest.approx(expected)
        assert 0.0 < score < 1.0

    def test_engage_requires_auth(self, client, db):
        """Unauthenticated engage requests are rejected."""
        user = _make_user(db, "learner", "learner@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        resp = client.post(
            f"/resources/{resource.id}/engage",
            json={"watch_completion": 1.0, "revisit_count": 0,
                  "completed": True, "time_spent": 60},
        )
        assert resp.status_code == 401

    def test_star_rating_stored_correctly(self, client, db):
        """POST /resources/{id}/rate stores the rating and returns updated average."""
        user = _make_user(db, "rater", "rater@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        resp = client.post(
            f"/resources/{resource.id}/rate",
            json={"stars": 4},
            headers=_auth(user.id),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["avg_rating"] == pytest.approx(4.0)
        assert data["rating_count"] == 1

        # Check DB
        rating = db.query(Rating).filter_by(
            user_id=user.id, resource_id=resource.id
        ).first()
        assert rating is not None
        assert rating.stars == 4

    def test_star_rating_update(self, client, db):
        """Re-rating updates the existing record, not creates a duplicate."""
        user = _make_user(db, "rater", "rater@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        client.post(f"/resources/{resource.id}/rate",
                    json={"stars": 2}, headers=_auth(user.id))
        client.post(f"/resources/{resource.id}/rate",
                    json={"stars": 5}, headers=_auth(user.id))

        ratings = db.query(Rating).filter_by(
            user_id=user.id, resource_id=resource.id
        ).all()
        assert len(ratings) == 1
        assert ratings[0].stars == 5

    def test_invalid_star_rating_rejected(self, client, db):
        """Stars outside 1-5 are rejected with 400."""
        user = _make_user(db, "rater", "rater@example.com")
        topic = _make_topic(db)
        resource = _make_resource(db, topic.id, user.id, ResourceStatus.approved)

        resp = client.post(
            f"/resources/{resource.id}/rate",
            json={"stars": 6},
            headers=_auth(user.id),
        )
        assert resp.status_code == 400
