import pytest
from app.services.recommender import engagement_score, bayesian_avg, get_recommendations
from app.models.models import User, Topic, Resource, Rating, Engagement, ResourceStatus, OnboardingQuestion, OnboardingAnswer


def test_engagement_score():
    # Test formula: 0.35 * (stars / 5) + 0.25 * watch + 0.2 * (time / 600) + 0.1 * (revisit / 5) + 0.1 * completed
    # 5 stars (0.35), 1.0 watch (0.25), 600s time (0.2), 5 revisits (0.1), completed (0.1) -> 1.0
    score = engagement_score(stars=5.0, watch=1.0, revisits=5, completed=True, time_spent=600)
    assert pytest.approx(score) == 1.0

    # Minimum values
    score_min = engagement_score(stars=0.0, watch=0.0, revisits=0, completed=False, time_spent=0)
    assert pytest.approx(score_min) == 0.0


def test_bayesian_average():
    # Empty ratings list should yield default prior mean C (3.0)
    assert bayesian_avg([]) == 3.0

    # With prior M=5, C=3.0:
    # If we add one rating of 5.0, result should be: (5 * 3.0 + 5.0) / (5 + 1) = 20 / 6 = 3.3333
    assert pytest.approx(bayesian_avg([5.0])) == 3.333333


def test_recommendations_cold_start(db, client):
    # Setup test users and topics
    user = User(username="cold_user", email="cold@example.com", hashed_password="hashedpassword")
    db.add(user)
    
    topic1 = Topic(title="Course1: Topic 1", description="Topic 1 desc", order_index=1)
    topic2 = Topic(title="Course1: Topic 2", description="Topic 2 desc", order_index=2)
    db.add_all([topic1, topic2])
    db.commit()

    # Add approved resources
    res1 = Resource(topic_id=topic2.id, uploader_id=user.id, title="Resource 1", url="http://example.com/1", resource_type="video", status=ResourceStatus.approved)
    res2 = Resource(topic_id=topic2.id, uploader_id=user.id, title="Resource 2", url="http://example.com/2", resource_type="article", status=ResourceStatus.approved)
    db.add_all([res1, res2])
    db.commit()

    # Without rating data, should fallback to popularity (which resolves to default Bayesian C=3.0)
    recs = get_recommendations(user_id=user.id, topic_id=topic1.id, db=db)
    assert len(recs) == 2
    assert recs[0]["title"] in ["Resource 1", "Resource 2"]


def test_recommendations_collaborative_filtering(db):
    # Setup users
    user_a = User(username="user_a", email="a@example.com", hashed_password="hash")
    user_b = User(username="user_b", email="b@example.com", hashed_password="hash")
    db.add_all([user_a, user_b])
    
    # Setup topics
    t1 = Topic(title="Course: T1")
    t2 = Topic(title="Course: T2")
    db.add_all([t1, t2])
    db.commit()

    # Setup resources (approved)
    r1 = Resource(topic_id=t1.id, uploader_id=user_a.id, title="R1", url="http://a.com/1", status=ResourceStatus.approved)
    r2 = Resource(topic_id=t2.id, uploader_id=user_a.id, title="R2", url="http://a.com/2", status=ResourceStatus.approved)
    r3 = Resource(topic_id=t2.id, uploader_id=user_a.id, title="R3", url="http://a.com/3", status=ResourceStatus.approved)
    db.add_all([r1, r2, r3])
    db.commit()

    # User A rates R1 as 5 stars and R2 as 5 stars
    db.add(Rating(user_id=user_a.id, resource_id=r1.id, stars=5))
    db.add(Rating(user_id=user_a.id, resource_id=r2.id, stars=5))

    # User B rates R1 as 5 stars (making B similar to A)
    db.add(Rating(user_id=user_b.id, resource_id=r1.id, stars=5))
    # User B rates R3 as 1 star
    db.add(Rating(user_id=user_b.id, resource_id=r3.id, stars=1))
    db.commit()

    # Get recommendations for User B on T1 (candidate pool will be cross-topic, i.e., T2 resources r2 and r3)
    # Since User B is highly similar to User A, and User A rated R2 highly, B should get R2 recommended
    recs = get_recommendations(user_id=user_b.id, topic_id=t1.id, db=db)
    
    assert len(recs) > 0
    # Top recommendation should be R2 because it has User A's 5-star rating, and User A is similar to User B
    assert recs[0]["title"] == "R2"


def test_recommendations_onboarding_boost(db):
    user = User(username="quiz_user", email="quiz@example.com", hashed_password="pwd")
    db.add(user)
    
    t1 = Topic(title="Course: T1") # Topic 1
    t2 = Topic(title="Course: T2") # Topic 2 (Interest)
    db.add_all([t1, t2])
    db.commit()

    # Question maps interest to topic 2
    q = OnboardingQuestion(question="Interested in T2?", topic_id=t2.id)
    db.add(q)
    db.commit()

    # Answer positively
    ans = OnboardingAnswer(user_id=user.id, question_id=q.id, answer="yes, very much")
    db.add(ans)
    db.commit()

    # Create approved resources
    r1 = Resource(topic_id=t1.id, uploader_id=user.id, title="R1 (T1)", url="http://t1.com/1", status=ResourceStatus.approved)
    r2 = Resource(topic_id=t2.id, uploader_id=user.id, title="R2 (T2)", url="http://t2.com/2", status=ResourceStatus.approved)
    db.add_all([r1, r2])
    db.commit()

    # Recommendations on topic 1 (cross-topic candidate is topic 2 resource r2)
    # Recommendations on topic 2 (cross-topic candidate is topic 1 resource r1)
    recs_t1 = get_recommendations(user_id=user.id, topic_id=t1.id, db=db)
    
    # Topic 2 resource (R2) should be boosted because user answered "yes" to T2 onboarding
    assert len(recs_t1) == 1
    assert recs_t1[0]["title"] == "R2 (T2)"
    # Score should be base Bayesian (3.0) + boost (1.5) = 4.5
    assert recs_t1[0]["score"] == 4.5

