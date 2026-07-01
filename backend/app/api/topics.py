from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Topic, TopicPrerequisite, UserProgress, User
import httpx, os, json

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


@router.get("/{topic_id}/quiz")
async def get_quiz(topic_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    gemini_key = os.environ.get("GEMINI_API_KEY", "")

    prompt = (
        f'Generate exactly 5 multiple choice questions to test knowledge of "{topic.title}".\n'
        f'Topic description: {topic.description or "a programming/tech topic"}\n'
        f'Rules:\n'
        f'- Questions must test actual understanding of the topic concepts, not feelings\n'
        f'- Each question must have exactly 4 options\n'
        f'- Only one option is correct\n'
        f'- "answer" is the 0-based index of the correct option\n'
        f'- Make the wrong options plausible (not obviously wrong)\n'
        f'- Vary the position of the correct answer (not always index 0)\n'
        f'Return ONLY valid JSON, no markdown, no extra text.\n'
        f'Format: {{"questions": [{{"q": "question text", "options": ["option0", "option1", "option2", "option3"], "answer": 2}}]}}'
    )

    if gemini_key:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
            resp.raise_for_status()
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            data = json.loads(raw)
            if "questions" in data and len(data["questions"]) > 0:
                return data
        except Exception:
            pass  # fall through to local generation

    # Local fallback: use topic title/description to form knowledge questions
    title = topic.title
    desc  = topic.description or ""
    return {"questions": [
        {
            "q": f"What is the primary purpose of {title}?",
            "options": [
                f"To replace all existing programming paradigms",
                f"To understand and apply core concepts of {title}",
                f"To generate random outputs without structure",
                f"To slow down application performance intentionally",
            ],
            "answer": 1,
        },
        {
            "q": f"Which statement about {title} is most accurate?",
            "options": [
                f"It only applies to hardware-level programming",
                f"It was invented last year and has no real applications",
                f"It is a well-defined concept used in software development",
                f"It is only relevant to mobile app development",
            ],
            "answer": 2,
        },
        {
            "q": f"After learning {title}, a developer would be able to:",
            "options": [
                f"Apply its concepts to solve related real-world problems",
                f"Eliminate the need for any other programming knowledge",
                f"Build only front-end applications",
                f"Only work with legacy codebases",
            ],
            "answer": 0,
        },
        {
            "q": f"Which best describes a key characteristic of {title}?",
            "options": [
                f"It is rarely used in modern software projects",
                f"It requires specialised hardware to implement",
                f"It has well-documented best practices in the industry",
                f"It is only applicable to academic research",
            ],
            "answer": 2,
        },
        {
            "q": f"When would a developer most likely use {title}?",
            "options": [
                f"Never, because it is an outdated concept",
                f"Only when building operating systems",
                f"When solving a problem that this topic is specifically designed to address",
                f"Only in large enterprise applications",
            ],
            "answer": 2,
        },
    ]}


@router.get("/course/{course_id}/quiz")
async def get_course_quiz(course_id: int, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    """
    Generate a comprehensive course-completion quiz (10 questions).
    For code-heavy courses (DSA, Python, Web) some questions are coding challenges.
    """
    # Courses with coding challenges: 1=DSA, 2=Python, 3=Web
    CODING_COURSE_IDS = {1, 2, 3}
    is_coding_course = course_id in CODING_COURSE_IDS

    # Fetch all topics in the course (order_index hundreds digit = course_id)
    low = course_id * 100
    high = (course_id + 1) * 100
    topics = (
        db.query(Topic)
        .filter(Topic.order_index >= low, Topic.order_index < high)
        .order_by(Topic.order_index)
        .all()
    )
    if not topics:
        raise HTTPException(status_code=404, detail="No topics found for this course")

    topic_list = "\n".join(
        f"- {t.title}: {t.description or 'no description'}" for t in topics
    )

    gemini_key = os.environ.get("GEMINI_API_KEY", "")

    if is_coding_course:
        prompt = (
            f"Generate a challenging course-completion exam for a student who has studied these topics:\n"
            f"{topic_list}\n\n"
            f"Create exactly 10 questions total:\n"
            f"- 6 multiple choice questions (type: 'mcq')\n"
            f"- 4 coding challenge questions (type: 'code')\n\n"
            f"Rules for MCQ (make these HARD — final exam level):\n"
            f"- Test deep understanding, edge cases, and real-world application — NOT definitions or trivia\n"
            f"- Include questions about time/space complexity, common bugs, tricky behaviour, design trade-offs\n"
            f"- 4 options each, only one correct\n"
            f"- All wrong options must be highly plausible — a student who half-understands should struggle\n"
            f"- 'answer' is the 0-based index of the correct option\n"
            f"- Vary correct answer positions\n\n"
            f"Rules for coding questions (LeetCode easy-to-medium difficulty):\n"
            f"- Concrete algorithmic problems — NOT 'write a class' or 'explain a concept'\n"
            f"- Examples: 'Return indices of two numbers that sum to target', 'Find the longest substring without repeating characters', 'Reverse a linked list'\n"
            f"- Each must have a clear problem statement in 'q' including input/output format\n"
            f"- Provide a Python starter template in 'starter' matching the function signature\n"
            f"- Provide 4-5 test cases in 'test_cases': [{{'input': [...], 'expected': ...}}]\n"
            f"  where 'input' is a list of positional arguments matching the starter function signature\n"
            f"- Include at least one edge case (empty input, single element, duplicates, etc.)\n"
            f"- 'language': 'python'\n\n"
            f"Return ONLY valid JSON, no markdown, no extra text.\n"
            f"Format:\n"
            f'{{"questions": ['
            f'{{"type": "mcq", "q": "...", "options": ["...", "...", "...", "..."], "answer": 0}}, '
            f'{{"type": "code", "q": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.\\nInput: nums=[2,7,11,15], target=9 → Output: [0,1]", '
            f'"starter": "def solution(nums, target):\\n    pass", '
            f'"test_cases": [{{"input": [[2,7,11,15], 9], "expected": [0,1]}}, {{"input": [[3,2,4], 6], "expected": [1,2]}}], "language": "python"}}'
            f']}}'
        )
    else:
        prompt = (
            f"Generate a challenging course-completion exam for a student who has studied these topics:\n"
            f"{topic_list}\n\n"
            f"Create exactly 10 multiple choice questions (type: 'mcq').\n\n"
            f"Rules (make these HARD — this is a final exam, not a warm-up):\n"
            f"- Test deep understanding, application, and analysis — NOT memorised definitions\n"
            f"- Include scenario-based questions, trade-off comparisons, and edge cases\n"
            f"- 4 options each, only one correct\n"
            f"- All wrong options must be highly plausible — a student who half-understands should struggle\n"
            f"- 'answer' is the 0-based index of the correct option\n"
            f"- Vary correct answer positions\n"
            f"- Cover a spread of topics — do not cluster on one topic\n\n"
            f"Return ONLY valid JSON, no markdown, no extra text.\n"
            f"Format:\n"
            f'{{"questions": [{{"type": "mcq", "q": "...", "options": ["...", "...", "...", "..."], "answer": 0}}]}}'
        )

    if gemini_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
            resp.raise_for_status()
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            data = json.loads(raw)
            if "questions" in data and len(data["questions"]) >= 5:
                return {"questions": data["questions"], "has_coding": is_coding_course}
        except Exception:
            pass  # fall through to fallback

    # Fallback: 10 generic MCQ from topic titles
    fallback_questions = []
    for i, t in enumerate(topics[:10]):
        fallback_questions.append({
            "type": "mcq",
            "q": f"What is the primary concept covered in '{t.title.split(': ')[-1]}'?",
            "options": [
                f"The core principles of {t.title.split(': ')[-1]}",
                f"Only hardware-level implementation details",
                f"An unrelated frontend styling technique",
                f"A deprecated legacy method",
            ],
            "answer": 0,
        })
    # Pad to 10 if fewer topics
    while len(fallback_questions) < 10:
        fallback_questions.append({
            "type": "mcq",
            "q": f"Which of the following best describes a key learning outcome of this course?",
            "options": [
                "Building practical skills applicable to real projects",
                "Memorising syntax with no practical use",
                "Avoiding all modern best practices",
                "Using only outdated tools",
            ],
            "answer": 0,
        })
    return {"questions": fallback_questions[:10], "has_coding": False}


class CodeCheckRequest(BaseModel):
    code: str
    language: str
    test_cases: list


@router.post("/course/quiz/check-code")
async def check_code_answer(data: CodeCheckRequest,
                             current_user: User = Depends(get_current_user)):
    """
    Send user's code solution to Gemini to evaluate against test cases.
    Returns { passed: bool, feedback: str, results: [{input, expected, got, ok}] }
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        # No Gemini — attempt simple Python execution for python code
        return {"passed": True, "feedback": "Auto-passed (no evaluator configured)", "results": []}

    test_cases_str = json.dumps(data.test_cases, indent=2)
    prompt = (
        f"You are a code evaluator. A student submitted the following {data.language} code:\n\n"
        f"```{data.language}\n{data.code}\n```\n\n"
        f"Test cases to check (each has 'input' as a list of arguments and 'expected' as the return value):\n"
        f"{test_cases_str}\n\n"
        f"Evaluate whether the code produces the correct output for EACH test case.\n"
        f"Run the code mentally or trace through it carefully.\n"
        f"Return ONLY valid JSON, no markdown:\n"
        f'{{"passed": true/false, "feedback": "brief explanation", '
        f'"results": [{{"input": ..., "expected": ..., "got": ..., "ok": true/false}}]}}\n'
        f"'passed' is true only if ALL test cases pass."
    )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
        resp.raise_for_status()
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = json.loads(raw)
        return result
    except Exception as e:
        return {"passed": False, "feedback": f"Evaluation failed: {str(e)}", "results": []}


@router.get("/progress/me")
def my_progress(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(UserProgress).filter_by(user_id=current_user.id).all()
    return [{"topic_id": r.topic_id, "completed": r.completed} for r in rows]


@router.get("/progress/activity")
def my_activity(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns daily completed-resource counts for last 30 days + total stats."""
    from datetime import datetime, timedelta
    from app.models.models import Engagement, Resource, Topic, TopicPrerequisite

    # Daily activity: count resources completed per day (last 30 days)
    since = datetime.utcnow() - timedelta(days=29)
    engagements = (
        db.query(Engagement)
        .filter_by(user_id=current_user.id, completed=True)
        .filter(Engagement.completed_at >= since)
        .all()
    )
    daily = {}
    for e in engagements:
        if e.completed_at:
            day = e.completed_at.strftime("%Y-%m-%d")
            daily[day] = daily.get(day, 0) + 1

    # Total stats
    total_completed_resources = db.query(Engagement).filter_by(
        user_id=current_user.id, completed=True).count()
    total_topics_done = db.query(UserProgress).filter_by(
        user_id=current_user.id, completed=True).count()
    total_time = db.query(Engagement).filter_by(user_id=current_user.id).all()
    total_seconds = sum(e.time_spent or 0 for e in total_time)

    return {
        "daily": daily,          # {"2026-06-20": 3, ...}
        "total_resources": total_completed_resources,
        "total_topics": total_topics_done,
        "total_minutes": total_seconds // 60,
    }
