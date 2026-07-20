from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import (
    Topic, TopicPrerequisite, UserProgress, User,
    Rating, Engagement, Resource, QuizCache,
)
import httpx, os, json

router = APIRouter(prefix="/topics", tags=["topics"])

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


def _get_user_context(user_id: int, db: Session) -> dict:
    """
    Collect the user's learning history to personalise quiz generation.
    Returns a dict with completed topics, struggled resources, and strong topics.
    Capped at small sizes to keep prompt tokens low.
    """
    # Topics the user has completed
    completed = (
        db.query(UserProgress)
        .filter_by(user_id=user_id, completed=True)
        .join(UserProgress.topic)
        .all()
    )
    completed_titles = [p.topic.title for p in completed if p.topic][:8]

    # Resources rated poorly (1-2 stars) — likely weak areas
    low_ratings = (
        db.query(Rating)
        .filter(Rating.user_id == user_id, Rating.stars <= 2)
        .join(Rating.resource)
        .all()
    )
    weak_resources = [r.resource.title for r in low_ratings if r.resource][:4]

    # Resources with high engagement (revisited 2+ times) — strong interest areas
    high_engagement = (
        db.query(Engagement)
        .filter(
            Engagement.user_id == user_id,
            Engagement.revisit_count >= 2,
        )
        .join(Engagement.resource)
        .all()
    )
    strong_resources = [e.resource.title for e in high_engagement if e.resource][:4]

    return {
        "completed_titles": completed_titles,
        "weak_resources": weak_resources,
        "strong_resources": strong_resources,
    }


def _build_user_context_block(ctx: dict) -> str:
    """Format user context into a compact string for injection into prompts."""
    lines = []
    if ctx["completed_titles"]:
        lines.append(f"Topics already completed: {', '.join(ctx['completed_titles'])}.")
    if ctx["strong_resources"]:
        lines.append(f"Resources they revisited often (strong interest): {', '.join(ctx['strong_resources'])}.")
    if ctx["weak_resources"]:
        lines.append(f"Resources they rated poorly (potential weak areas): {', '.join(ctx['weak_resources'])}.")
    return "\n".join(lines)


async def _call_gemini(prompt: str, gemini_key: str, timeout: float = 25.0) -> Optional[dict]:
    """Call Gemini API and return parsed JSON, or None on any failure."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={gemini_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
        resp.raise_for_status()
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return json.loads(raw)
    except Exception:
        return None


def _load_db_cache(user_id: int, cache_key: str, db: Session) -> Optional[dict]:
    entry = db.query(QuizCache).filter_by(user_id=user_id, cache_key=cache_key).first()
    if entry:
        return json.loads(entry.json_data)
    return None


def _save_db_cache(user_id: int, cache_key: str, data: dict, db: Session) -> None:
    existing = db.query(QuizCache).filter_by(user_id=user_id, cache_key=cache_key).first()
    if existing:
        existing.json_data = json.dumps(data)
    else:
        db.add(QuizCache(user_id=user_id, cache_key=cache_key, json_data=json.dumps(data)))
    db.commit()


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
    """
    Generate a personalised 5-question MCQ quiz for a topic.
    Uses the user's learning history (completed topics, weak/strong areas)
    to tailor question difficulty and focus.
    Result is cached per user+topic in the DB — Gemini is only called once per user per topic.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    cache_key = f"topic:{topic_id}"

    # Check DB cache first — avoids re-calling Gemini on server restart
    cached = _load_db_cache(current_user.id, cache_key, db)
    if cached:
        return cached

    gemini_key = os.environ.get("GEMINI_API_KEY", "")

    if gemini_key:
        ctx = _get_user_context(current_user.id, db)
        user_block = _build_user_context_block(ctx)

        personalisation = (
            f"\nStudent learning profile:\n{user_block}\n"
            f"Use this profile to:\n"
            f"- Ask harder questions on topics they have already completed\n"
            f"- Focus on concepts related to their weak areas if relevant\n"
            f"- Skip overly basic definitions if they have strong engagement history\n"
        ) if user_block else ""

        prompt = (
            f'Generate exactly 5 multiple choice questions to test knowledge of "{topic.title}".\n'
            f'Topic description: {topic.description or "a programming/tech topic"}\n'
            f'{personalisation}\n'
            f'Rules:\n'
            f'- Test actual understanding — NOT trivial definitions or feelings\n'
            f'- Each question must have exactly 4 options\n'
            f'- Only one option is correct\n'
            f'- "answer" is the 0-based index of the correct option\n'
            f'- Make the wrong options plausible (not obviously wrong)\n'
            f'- Vary the position of the correct answer\n'
            f'Return ONLY valid JSON, no markdown, no extra text.\n'
            f'Format: {{"questions": [{{"q": "...", "options": ["o0","o1","o2","o3"], "answer": 2}}]}}'
        )

        data = await _call_gemini(prompt, gemini_key)
        if data and "questions" in data and len(data["questions"]) > 0:
            _save_db_cache(current_user.id, cache_key, data, db)
            return data

    # Local fallback — generic questions that at least force recall
    title = topic.title
    fallback = {"questions": [
        {
            "q": f"What is the primary purpose of {title}?",
            "options": [
                "To replace all existing programming paradigms",
                f"To understand and apply core concepts of {title}",
                "To generate random outputs without structure",
                "To slow down application performance intentionally",
            ],
            "answer": 1,
        },
        {
            "q": f"Which statement about {title} is most accurate?",
            "options": [
                "It only applies to hardware-level programming",
                "It was invented last year and has no real applications",
                "It is a well-defined concept used in software development",
                "It is only relevant to mobile app development",
            ],
            "answer": 2,
        },
        {
            "q": f"After learning {title}, a developer would be able to:",
            "options": [
                "Apply its concepts to solve related real-world problems",
                "Eliminate the need for any other programming knowledge",
                "Build only front-end applications",
                "Only work with legacy codebases",
            ],
            "answer": 0,
        },
        {
            "q": f"Which best describes a key characteristic of {title}?",
            "options": [
                "It is rarely used in modern software projects",
                "It requires specialised hardware to implement",
                "It has well-documented best practices in the industry",
                "It is only applicable to academic research",
            ],
            "answer": 2,
        },
        {
            "q": f"When would a developer most likely use {title}?",
            "options": [
                "Never, because it is an outdated concept",
                "Only when building operating systems",
                "When solving a problem that this topic is specifically designed to address",
                "Only in large enterprise applications",
            ],
            "answer": 2,
        },
    ]}
    return fallback


@router.get("/course/{course_id}/quiz")
async def get_course_quiz(course_id: int, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    """
    Generate a personalised course-completion exam (10 questions).
    For coding courses (DSA, Python, Web) includes 4 coding challenges.
    Personalised using the user's learning history — cached per user+course in DB.
    """
    cache_key = f"course:{course_id}"

    cached = _load_db_cache(current_user.id, cache_key, db)
    if cached:
        return cached

    # Courses with coding challenges: 1=DSA, 2=Python, 3=Web
    CODING_COURSE_IDS = {1, 2, 3}
    is_coding_course = course_id in CODING_COURSE_IDS

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

    if gemini_key:
        ctx = _get_user_context(current_user.id, db)
        user_block = _build_user_context_block(ctx)

        personalisation = (
            f"\nStudent learning profile:\n{user_block}\n"
            f"Use this profile to:\n"
            f"- Ask harder questions on topics they have completed and revisited\n"
            f"- Include at least one question probing their weak-area resources if relevant\n"
            f"- Ensure coverage is spread across all course topics, not clustered\n"
        ) if user_block else ""

        if is_coding_course:
            prompt = (
                f"Generate a challenging course-completion exam for a student who has studied:\n"
                f"{topic_list}\n"
                f"{personalisation}\n"
                f"Create exactly 10 questions total:\n"
                f"- 6 multiple choice questions (type: 'mcq')\n"
                f"- 4 coding challenge questions (type: 'code')\n\n"
                f"MCQ rules (HARD — final exam level):\n"
                f"- Test deep understanding, edge cases, time/space complexity, design trade-offs\n"
                f"- 4 options each, only one correct; all wrong options highly plausible\n"
                f"- 'answer' is the 0-based index; vary correct answer positions\n\n"
                f"Coding question rules (LeetCode easy-to-medium):\n"
                f"- Concrete algorithmic problems with clear input/output format in 'q'\n"
                f"- Python starter in 'starter'; 4-5 test cases in 'test_cases' with at least one edge case\n"
                f"- 'test_cases': [{{\"input\": [...positional args], \"expected\": ...}}]\n"
                f"- 'language': 'python'\n\n"
                f"Return ONLY valid JSON, no markdown.\n"
                f'Format: {{"questions": ['
                f'{{"type":"mcq","q":"...","options":["...","...","...","..."],"answer":0}},'
                f'{{"type":"code","q":"...","starter":"def solution(...):\\n    pass","test_cases":[{{"input":[...],"expected":...}}],"language":"python"}}'
                f']}}'
            )
        else:
            prompt = (
                f"Generate a challenging course-completion exam for a student who has studied:\n"
                f"{topic_list}\n"
                f"{personalisation}\n"
                f"Create exactly 10 multiple choice questions (type: 'mcq').\n\n"
                f"Rules (HARD — final exam):\n"
                f"- Test deep understanding, application, edge cases — NOT memorised definitions\n"
                f"- 4 options each, one correct; all wrong options highly plausible\n"
                f"- 'answer' is 0-based index; vary positions; cover all topics\n\n"
                f"Return ONLY valid JSON, no markdown.\n"
                f'Format: {{"questions": [{{"type":"mcq","q":"...","options":["...","...","...","..."],"answer":0}}]}}'
            )

        data = await _call_gemini(prompt, gemini_key, timeout=30.0)
        if data and "questions" in data and len(data["questions"]) >= 5:
            result = {"questions": data["questions"], "has_coding": is_coding_course}
            _save_db_cache(current_user.id, cache_key, result, db)
            return result

    # Hardcoded fallback per course
    FALLBACK_QUESTIONS = {
        1: [  # DSA
            {"type":"mcq","q":"What is the time complexity of binary search on a sorted array of n elements?","options":["O(n)","O(log n)","O(n log n)","O(1)"],"answer":1},
            {"type":"mcq","q":"Which data structure uses LIFO (Last In, First Out) ordering?","options":["Queue","Linked List","Stack","Binary Tree"],"answer":2},
            {"type":"mcq","q":"What is the worst-case time complexity of QuickSort?","options":["O(n log n)","O(n)","O(n²)","O(log n)"],"answer":2},
            {"type":"mcq","q":"In a singly linked list, what is the time complexity of inserting at the head?","options":["O(n)","O(log n)","O(n²)","O(1)"],"answer":3},
            {"type":"mcq","q":"Which traversal of a BST visits nodes in ascending sorted order?","options":["Pre-order","Post-order","In-order","Level-order"],"answer":2},
            {"type":"mcq","q":"Dijkstra's algorithm finds the shortest path assuming all edge weights are:","options":["Negative","Zero","Non-negative","Integers only"],"answer":2},
            {"type":"mcq","q":"What data structure is most efficient for implementing a priority queue?","options":["Array","Heap","Doubly linked list","Stack"],"answer":1},
            {"type":"mcq","q":"What is the space complexity of merge sort?","options":["O(1)","O(log n)","O(n)","O(n²)"],"answer":2},
            {"type":"mcq","q":"Which graph traversal algorithm uses a queue?","options":["DFS","BFS","Dijkstra","Bellman-Ford"],"answer":1},
            {"type":"mcq","q":"An algorithm with O(2ⁿ) complexity is described as:","options":["Linear","Polynomial","Logarithmic","Exponential"],"answer":3},
        ],
        2: [  # Python
            {"type":"mcq","q":"What is the output of `[x**2 for x in range(4)]`?","options":["[1,4,9,16]","[0,1,4,9]","[0,2,4,6]","[1,2,3,4]"],"answer":1},
            {"type":"mcq","q":"Which keyword is used to create a generator function in Python?","options":["return","async","yield","lambda"],"answer":2},
            {"type":"mcq","q":"What does `dict.get('key', 'default')` return when 'key' is absent?","options":["None","KeyError","'default'","False"],"answer":2},
            {"type":"mcq","q":"What is the difference between `is` and `==` in Python?","options":["They are identical","'is' checks value equality, '==' checks identity","'is' checks identity, '==' checks value equality","'is' is used for numbers only"],"answer":2},
            {"type":"mcq","q":"Which of the following is an immutable data type in Python?","options":["list","dict","set","tuple"],"answer":3},
            {"type":"mcq","q":"What does the `__init__` method do in a Python class?","options":["Destroys the object","Initialises object attributes when an instance is created","Returns the string representation","Copies the object"],"answer":1},
            {"type":"mcq","q":"What does `try/except/finally` guarantee about the `finally` block?","options":["It only runs if no exception occurs","It only runs if an exception occurs","It always runs regardless of exceptions","It runs before the try block"],"answer":2},
            {"type":"mcq","q":"What is the result of `'hello'[::-1]`?","options":["'hello'","'olleh'","'h'","Error"],"answer":1},
            {"type":"mcq","q":"Which built-in function returns an iterator of (index, value) pairs?","options":["zip()","map()","enumerate()","filter()"],"answer":2},
            {"type":"mcq","q":"What is the purpose of `if __name__ == '__main__':` in a Python script?","options":["It defines the main class","It runs only when the file is executed directly, not imported","It imports the main module","It prevents the script from running"],"answer":1},
        ],
        3: [  # Web
            {"type":"mcq","q":"What does the CSS `box-sizing: border-box` property do?","options":["Adds a border around all elements","Makes padding and border included in the element's total width/height","Removes all padding","Sets the border radius"],"answer":1},
            {"type":"mcq","q":"Which HTTP method is idempotent and should be used to fully replace a resource?","options":["POST","PATCH","PUT","DELETE"],"answer":2},
            {"type":"mcq","q":"In React, what triggers a component to re-render?","options":["A change in a local variable","A change in state or props","Calling a function inside the component","Importing a new module"],"answer":1},
            {"type":"mcq","q":"What is the purpose of the `useEffect` hook with an empty dependency array `[]`?","options":["Runs on every render","Runs only once after the initial render","Runs only when state changes","Runs before the component mounts"],"answer":1},
            {"type":"mcq","q":"What does a 401 HTTP status code mean?","options":["Resource not found","Server error","Unauthorised — authentication required","Forbidden — no permission"],"answer":2},
            {"type":"mcq","q":"What is the difference between `localStorage` and `sessionStorage`?","options":["localStorage is faster","sessionStorage persists after the browser closes, localStorage does not","localStorage persists after the browser closes, sessionStorage does not","They are identical"],"answer":2},
            {"type":"mcq","q":"Which CSS property is used to create a flexible container?","options":["display: block","display: grid","display: flex","position: relative"],"answer":2},
            {"type":"mcq","q":"In a REST API, what should a successful POST request that creates a resource return?","options":["200 OK","204 No Content","201 Created","301 Redirect"],"answer":2},
            {"type":"mcq","q":"What does `event.preventDefault()` do in JavaScript?","options":["Stops event propagation to parent elements","Removes the event listener","Prevents the browser's default action for the event","Deletes the element"],"answer":2},
            {"type":"mcq","q":"What is the main advantage of a CDN for a frontend deployment?","options":["It compiles JavaScript faster","It serves static assets from servers geographically close to users","It encrypts all API calls","It replaces the need for a backend"],"answer":1},
        ],
        4: [  # Databases
            {"type":"mcq","q":"What does the ACID property 'Isolation' guarantee?","options":["Data is never lost","Concurrent transactions do not interfere with each other","All changes are permanent after commit","The database starts in a valid state"],"answer":1},
            {"type":"mcq","q":"Which SQL clause filters rows after aggregation?","options":["WHERE","HAVING","GROUP BY","ORDER BY"],"answer":1},
            {"type":"mcq","q":"What is a foreign key?","options":["A key that uniquely identifies a row","A key that references the primary key of another table","A key used for encryption","An index on a non-primary column"],"answer":1},
            {"type":"mcq","q":"What normal form eliminates transitive dependencies?","options":["1NF","2NF","3NF","BCNF"],"answer":2},
            {"type":"mcq","q":"Which JOIN returns all rows from the left table even if there is no match in the right?","options":["INNER JOIN","RIGHT JOIN","LEFT JOIN","FULL JOIN"],"answer":2},
            {"type":"mcq","q":"In NoSQL document stores, data is typically stored as:","options":["Tables with rows","JSON-like documents","Binary blobs","Key-integer pairs only"],"answer":1},
            {"type":"mcq","q":"What does a database index trade off to improve read performance?","options":["Consistency","Write speed and storage space","Isolation level","Referential integrity"],"answer":1},
            {"type":"mcq","q":"Which isolation level prevents dirty reads but allows non-repeatable reads?","options":["Read Uncommitted","Read Committed","Repeatable Read","Serializable"],"answer":1},
            {"type":"mcq","q":"What is the purpose of the `ON DELETE CASCADE` constraint?","options":["Prevents deletion of referenced rows","Automatically deletes child rows when the parent is deleted","Copies deleted rows to an archive","Sets foreign key columns to NULL on deletion"],"answer":1},
            {"type":"mcq","q":"Which of the following is a key characteristic of the CAP theorem?","options":["A distributed system can guarantee consistency, availability, and partition tolerance simultaneously","A distributed system can guarantee at most two of the three: consistency, availability, partition tolerance","CAP applies only to relational databases","Partition tolerance is always optional"],"answer":1},
        ],
        5: [  # ML
            {"type":"mcq","q":"What is overfitting in a machine learning model?","options":["The model performs poorly on both training and test data","The model learns the training data too well including noise, and generalises poorly","The model is too simple to capture patterns","The model trains too slowly"],"answer":1},
            {"type":"mcq","q":"What does the bias-variance tradeoff describe?","options":["The balance between model accuracy and training speed","The tension between a model being too simple (high bias) and too flexible (high variance)","The tradeoff between labelled and unlabelled data","The balance between precision and recall"],"answer":1},
            {"type":"mcq","q":"Which metric is most appropriate when false negatives are more costly than false positives?","options":["Accuracy","Precision","Recall","F1 Score"],"answer":2},
            {"type":"mcq","q":"What does k-fold cross-validation do?","options":["Trains k separate models on different datasets","Splits data into k folds, trains k times each time using a different fold as validation","Runs the model k times with random seeds","Selects the top k features"],"answer":1},
            {"type":"mcq","q":"What is the role of the activation function in a neural network?","options":["It initialises the weights","It introduces non-linearity so the network can learn complex patterns","It calculates the loss","It normalises the input data"],"answer":1},
            {"type":"mcq","q":"In gradient descent, what does the learning rate control?","options":["The number of training epochs","The size of each step taken toward the minimum of the loss function","The number of hidden layers","The amount of regularisation"],"answer":1},
            {"type":"mcq","q":"What is the main difference between supervised and unsupervised learning?","options":["Supervised learning uses more data","Supervised learning trains on labelled data; unsupervised learning finds patterns without labels","Unsupervised learning is always more accurate","Supervised learning does not use a loss function"],"answer":1},
            {"type":"mcq","q":"What does PCA (Principal Component Analysis) primarily do?","options":["Classifies data into clusters","Reduces dimensionality by projecting data onto axes of maximum variance","Increases the number of features","Removes outliers from the dataset"],"answer":1},
            {"type":"mcq","q":"Which regularisation technique randomly drops neurons during training?","options":["L1 regularisation","L2 regularisation","Dropout","Batch normalisation"],"answer":2},
            {"type":"mcq","q":"What is a confusion matrix used for?","options":["Visualising neural network layers","Summarising the performance of a classification model by showing TP, TN, FP, FN counts","Plotting the loss curve","Comparing two regression models"],"answer":1},
        ],
    }

    fallback = FALLBACK_QUESTIONS.get(course_id, [])
    if fallback:
        return {"questions": fallback, "has_coding": False}

    generic = []
    for t in topics[:10]:
        generic.append({
            "type": "mcq",
            "q": f"Which statement best describes '{t.title.split(': ')[-1]}'?",
            "options": [
                "A foundational concept with well-documented applications",
                "Applicable only to legacy systems",
                "Rarely used in modern development",
                "Only relevant at hardware level",
            ],
            "answer": 0,
        })
    while len(generic) < 10:
        generic.append({"type":"mcq","q":"Which practice leads to more maintainable code?","options":["Writing long functions","Using meaningful names and keeping functions small","Avoiding comments","Hardcoding all values"],"answer":1})
    return {"questions": generic[:10], "has_coding": False}


class CodeCheckRequest(BaseModel):
    code: str
    language: str
    test_cases: list


@router.post("/course/quiz/check-code")
async def check_code_answer(data: CodeCheckRequest,
                             current_user: User = Depends(get_current_user)):
    """
    Use Gemini to evaluate a user's code submission against test cases.
    Returns { passed: bool, feedback: str, results: [{input, expected, got, ok}] }
    Gemini traces through the code and checks each test case — no sandbox needed.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        return {"passed": True, "feedback": "Auto-passed (no evaluator configured)", "results": []}

    test_cases_str = json.dumps(data.test_cases, indent=2)
    prompt = (
        f"You are a code evaluator. A student submitted this {data.language} solution:\n\n"
        f"```{data.language}\n{data.code}\n```\n\n"
        f"Test cases (each 'input' is a list of positional arguments, 'expected' is the return value):\n"
        f"{test_cases_str}\n\n"
        f"Trace through the code carefully for EACH test case.\n"
        f"Return ONLY valid JSON, no markdown:\n"
        f'{{"passed": true, "feedback": "All test cases passed.", '
        f'"results": [{{"input": ..., "expected": ..., "got": ..., "ok": true}}]}}\n'
        f"'passed' is true only if ALL test cases pass. "
        f"'feedback' should explain the first failing case if any."
    )

    result = await _call_gemini(prompt, gemini_key, timeout=20.0)
    if result:
        return result
    return {"passed": False, "feedback": "Evaluation failed — check your code and try again.", "results": []}


@router.get("/progress/me")
def my_progress(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(UserProgress).filter_by(user_id=current_user.id).all()
    return [{"topic_id": r.topic_id, "completed": r.completed} for r in rows]


@router.get("/progress/activity")
def my_activity(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns daily completed-resource counts for last 30 days + total stats."""
    from datetime import datetime, timedelta

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

    total_completed_resources = db.query(Engagement).filter_by(
        user_id=current_user.id, completed=True).count()
    total_topics_done = db.query(UserProgress).filter_by(
        user_id=current_user.id, completed=True).count()
    total_time = db.query(Engagement).filter_by(user_id=current_user.id).all()
    total_seconds = sum(e.time_spent or 0 for e in total_time)

    return {
        "daily": daily,
        "total_resources": total_completed_resources,
        "total_topics": total_topics_done,
        "total_minutes": total_seconds // 60,
    }

