from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Index
)
from sqlalchemy.orm import relationship, DeclarativeBase
from datetime import datetime
import enum


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ratings = relationship("Rating", back_populates="user")
    progress = relationship("UserProgress", back_populates="user")
    uploads = relationship("Resource", back_populates="uploader")
    quiz_answers = relationship("OnboardingAnswer", back_populates="user")
    comments = relationship("Comment", back_populates="user")


class Topic(Base):
    __tablename__ = "topics"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    order_index = Column(Integer, default=0)

    prerequisites = relationship(
        "TopicPrerequisite", foreign_keys="TopicPrerequisite.topic_id", back_populates="topic"
    )
    resources = relationship("Resource", back_populates="topic")
    progress = relationship("UserProgress", back_populates="topic")


class TopicPrerequisite(Base):
    """Directed edge: topic_id requires prereq_id"""
    __tablename__ = "topic_prerequisites"
    topic_id = Column(Integer, ForeignKey("topics.id"), primary_key=True)
    prereq_id = Column(Integer, ForeignKey("topics.id"), primary_key=True)
    is_hard = Column(Boolean, default=True)  # True=hard, False=soft suggestion

    topic = relationship("Topic", foreign_keys=[topic_id], back_populates="prerequisites")


class ResourceStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Resource(Base):
    __tablename__ = "resources"
    id = Column(Integer, primary_key=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    url = Column(String, nullable=False)
    resource_type = Column(String)   # video, article, pdf, doc, other
    status = Column(Enum(ResourceStatus), default=ResourceStatus.pending)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_resource_topic_status", "topic_id", "status"),
        Index("ix_resource_status", "status"),
    )

    topic = relationship("Topic", back_populates="resources")
    uploader = relationship("User", back_populates="uploads")
    ratings = relationship("Rating", back_populates="resource")
    engagements = relationship("Engagement", back_populates="resource")
    comments = relationship("Comment", back_populates="resource", cascade="all, delete-orphan")


class Rating(Base):
    __tablename__ = "ratings"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), primary_key=True)
    stars = Column(Integer, nullable=False)  # 1-5
    reason = Column(String, nullable=True)   # optional low-rating feedback

    user = relationship("User", back_populates="ratings")
    resource = relationship("Resource", back_populates="ratings")


class Engagement(Base):
    __tablename__ = "engagements"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    resource_id = Column(Integer, ForeignKey("resources.id"))
    watch_completion = Column(Float, default=0.0)
    revisit_count = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    time_spent = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_engagement_user", "user_id"),
        Index("ix_engagement_user_completed", "user_id", "completed"),
    )

    resource = relationship("Resource", back_populates="engagements")


class UserProgress(Base):
    __tablename__ = "user_progress"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), primary_key=True)
    completed = Column(Boolean, default=False)
    last_accessed = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="progress")
    topic = relationship("Topic", back_populates="progress")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token      = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)


class OnboardingQuestion(Base):
    __tablename__ = "onboarding_questions"
    id = Column(Integer, primary_key=True)
    question = Column(Text, nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"))  # maps answer to topic interest

    answers = relationship("OnboardingAnswer", back_populates="question")


class OnboardingAnswer(Base):
    __tablename__ = "onboarding_answers"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("onboarding_questions.id"))
    answer = Column(String)

    user = relationship("User", back_populates="quiz_answers")
    question = relationship("OnboardingQuestion", back_populates="answers")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="comments")
    resource = relationship("Resource", back_populates="comments")


class CourseRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class CourseRequest(Base):
    __tablename__ = "course_requests"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(CourseRequestStatus), default=CourseRequestStatus.pending)
    admin_note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
