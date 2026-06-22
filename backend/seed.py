"""Seed the DB with 5 courses + subtopics and rich resources."""
import sys
sys.path.insert(0, ".")

from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.models.models import (
    Topic, TopicPrerequisite, User, OnboardingQuestion,
    Resource, ResourceStatus, Rating, Engagement
)

init_db()
db = SessionLocal()

def get_or_create_user(username, email, password, is_admin=False):
    u = db.query(User).filter_by(username=username).first()
    if not u:
        u = User(username=username, email=email,
                 hashed_password=hash_password(password), is_admin=is_admin)
        db.add(u)
        db.flush()
    return u

admin = get_or_create_user("admin", "admin@opic.dev", "admin123", is_admin=True)
alice = get_or_create_user("alice", "alice@opic.dev", "alice123")
bob   = get_or_create_user("bob",   "bob@opic.dev",   "bob123")
db.commit()

# order_index hundreds digit = course id
# 1xx = DSA, 2xx = Python, 3xx = Web, 4xx = DB, 5xx = ML
topics_data = [
    # Course 1 — Data Structures & Algorithms
    ("DSA: Fundamentals",         "Big-O notation, complexity analysis, and problem-solving basics.",           101),
    ("DSA: Lists",                "Arrays, linked lists, stacks, and queues.",                                  102),
    ("DSA: Trees",                "Binary trees, BST, AVL trees, and tree traversals.",                         103),
    ("DSA: Sorting",              "Bubble, merge, quick, heap sort — analysis and implementation.",             104),
    ("DSA: Searching",            "Linear search, binary search, and hash-based lookup.",                       105),
    ("DSA: Graphs",               "Graph representations, BFS, DFS, Dijkstra, and shortest paths.",            106),
    # Course 2 — Python Programming
    ("Python: Fundamentals",      "Variables, data types, control flow, and functions.",                        201),
    ("Python: Data Structures",   "Lists, dicts, sets, tuples, and comprehensions.",                            202),
    ("Python: OOP",               "Classes, inheritance, encapsulation, and polymorphism.",                     203),
    ("Python: File & Modules",    "File I/O, modules, packages, and the standard library.",                     204),
    ("Python: Error Handling",    "Exceptions, try/except, custom errors, and context managers.",               205),
    # Course 3 — Web Development
    ("Web: HTML & CSS",           "Page structure, semantic HTML, and CSS styling fundamentals.",               301),
    ("Web: JavaScript",           "DOM manipulation, events, fetch API, and ES6+ syntax.",                      302),
    ("Web: React Basics",         "Components, props, state, hooks, and JSX.",                                  303),
    ("Web: REST APIs",            "HTTP methods, JSON, status codes, and consuming APIs.",                      304),
    ("Web: Deployment",           "Hosting, environment variables, and CI/CD basics.",                          305),
    # Course 4 — Databases & SQL
    ("DB: Relational Basics",     "Tables, rows, columns, data types, and primary keys.",                       401),
    ("DB: SQL Queries",           "SELECT, WHERE, JOIN, GROUP BY, and aggregate functions.",                    402),
    ("DB: Schema Design",         "Normalization, ER diagrams, foreign keys, and indexes.",                     403),
    ("DB: Transactions",          "ACID properties, transactions, locks, and isolation levels.",                404),
    ("DB: NoSQL",                 "Document stores, key-value stores, and MongoDB basics.",                     405),
    # Course 5 — Machine Learning
    ("ML: Math Foundations",      "Linear algebra, statistics, and probability for ML.",                        501),
    ("ML: Supervised Learning",   "Regression, classification, train/test split, and metrics.",                 502),
    ("ML: Unsupervised Learning", "Clustering, dimensionality reduction, PCA, and k-means.",                    503),
    ("ML: Neural Networks",       "Perceptrons, backpropagation, and activation functions.",                    504),
    ("ML: Model Evaluation",      "Cross-validation, overfitting, regularization, and tuning.",                 505),
]

topic_objs = {}
for title, desc, order in topics_data:
    t = db.query(Topic).filter_by(title=title).first()
    if not t:
        t = Topic(title=title, description=desc, order_index=order)
        db.add(t)
        db.flush()
    topic_objs[title] = t
db.commit()

def T(name): return topic_objs[name]

# Prerequisites
prereq_edges = [
    ("DSA: Lists",                "DSA: Fundamentals",          True),
    ("DSA: Trees",                "DSA: Lists",                  True),
    ("DSA: Sorting",              "DSA: Lists",                  True),
    ("DSA: Searching",            "DSA: Fundamentals",           True),
    ("DSA: Graphs",               "DSA: Trees",                  True),
    ("Python: Data Structures",   "Python: Fundamentals",        True),
    ("Python: OOP",               "Python: Data Structures",     True),
    ("Python: File & Modules",    "Python: OOP",                 True),
    ("Python: Error Handling",    "Python: Fundamentals",        True),
    ("Web: JavaScript",           "Web: HTML & CSS",             True),
    ("Web: React Basics",         "Web: JavaScript",             True),
    ("Web: REST APIs",            "Web: JavaScript",             True),
    ("Web: Deployment",           "Web: React Basics",           True),
    ("DB: SQL Queries",           "DB: Relational Basics",       True),
    ("DB: Schema Design",         "DB: SQL Queries",             True),
    ("DB: Transactions",          "DB: Schema Design",           True),
    ("DB: NoSQL",                 "DB: Relational Basics",       False),
    ("ML: Supervised Learning",   "ML: Math Foundations",        True),
    ("ML: Unsupervised Learning", "ML: Math Foundations",        True),
    ("ML: Neural Networks",       "ML: Supervised Learning",     True),
    ("ML: Model Evaluation",      "ML: Supervised Learning",     True),
    ("ML: Math Foundations",      "DSA: Fundamentals",           False),
    ("Web: React Basics",         "Python: Fundamentals",        False),
    ("DB: Schema Design",         "Python: OOP",                 False),
]
for t_name, p_name, is_hard in prereq_edges:
    tp = T(t_name); pr = T(p_name)
    if not db.query(TopicPrerequisite).filter_by(topic_id=tp.id, prereq_id=pr.id).first():
        db.add(TopicPrerequisite(topic_id=tp.id, prereq_id=pr.id, is_hard=is_hard))
db.commit()

# Resources — 3-4 per subtopic
resources_data = [
    # ── DSA: Fundamentals ──────────────────────────────────────────────────────
    ("DSA: Fundamentals", "Big-O Notation Explained",             "https://www.youtube.com/watch?v=g2o22C3CRfU",           "video"),
    ("DSA: Fundamentals", "Big-O Cheat Sheet",                    "https://www.bigocheatsheet.com/",                       "article"),
    ("DSA: Fundamentals", "Algorithms — freeCodeCamp",            "https://www.youtube.com/watch?v=8hly31xKli0",           "video"),
    ("DSA: Fundamentals", "Programiz — Complexity Analysis",      "https://www.programiz.com/dsa/algorithm-complexity",    "article"),

    # ── DSA: Lists ────────────────────────────────────────────────────────────
    ("DSA: Lists", "Linked Lists in 4 minutes",                   "https://www.youtube.com/watch?v=F8AbOfQwl1c",           "video"),
    ("DSA: Lists", "Stacks and Queues Explained",                 "https://www.youtube.com/watch?v=wjI1WNcIntg",           "video"),
    ("DSA: Lists", "Visualgo — Linked List",                      "https://visualgo.net/en/list",                          "article"),
    ("DSA: Lists", "GeeksForGeeks — Array vs Linked List",        "https://www.geeksforgeeks.org/linked-list-vs-array/",   "article"),

    # ── DSA: Trees ────────────────────────────────────────────────────────────
    ("DSA: Trees", "Binary Trees in 15 minutes",                  "https://www.youtube.com/watch?v=oSWTXtMglKE",           "video"),
    ("DSA: Trees", "Binary Search Tree — Traversals",             "https://www.youtube.com/watch?v=VCTP81Ij-EM",           "video"),
    ("DSA: Trees", "Visualgo — BST",                              "https://visualgo.net/en/bst",                           "article"),
    ("DSA: Trees", "Programiz — Tree Traversal",                  "https://www.programiz.com/dsa/tree-traversal",          "article"),

    # ── DSA: Sorting ─────────────────────────────────────────────────────────
    ("DSA: Sorting", "Merge Sort — Step by Step",                 "https://www.youtube.com/watch?v=4VqmGXwpLqc",           "video"),
    ("DSA: Sorting", "Quick Sort Explained",                      "https://www.youtube.com/watch?v=Hoixgm4-P4M",           "video"),
    ("DSA: Sorting", "Sorting Algorithms Visualized",             "https://www.youtube.com/watch?v=kPRA0W1kECg",           "video"),
    ("DSA: Sorting", "Programiz — Sorting Algorithms",            "https://www.programiz.com/dsa/sorting-algorithm",       "article"),

    # ── DSA: Searching ───────────────────────────────────────────────────────
    ("DSA: Searching", "Binary Search in 5 minutes",              "https://www.youtube.com/watch?v=P3YID7liBug",           "video"),
    ("DSA: Searching", "Hash Tables Explained",                   "https://www.youtube.com/watch?v=KyUTuwz_b7Q",           "video"),
    ("DSA: Searching", "Visualgo — Binary Search",                "https://visualgo.net/en/binarysearch",                  "article"),
    ("DSA: Searching", "GeeksForGeeks — Hashing",                 "https://www.geeksforgeeks.org/hashing-data-structure/", "article"),

    # ── DSA: Graphs ──────────────────────────────────────────────────────────
    ("DSA: Graphs", "Graph Theory Introduction",                   "https://www.youtube.com/watch?v=eQA-m22wjTQ",           "video"),
    ("DSA: Graphs", "BFS and DFS Explained",                      "https://www.youtube.com/watch?v=pcKY4hjDrxk",           "video"),
    ("DSA: Graphs", "Dijkstra's Algorithm",                       "https://www.youtube.com/watch?v=GazC3A4OQTE",           "video"),
    ("DSA: Graphs", "Visualgo — Graph",                           "https://visualgo.net/en/graphds",                       "article"),

    # ── Python: Fundamentals ─────────────────────────────────────────────────
    ("Python: Fundamentals", "Python for Beginners (Full Course)", "https://www.youtube.com/watch?v=eWRfhZUzrAc",          "video"),
    ("Python: Fundamentals", "Python Official Tutorial",           "https://docs.python.org/3/tutorial/",                  "article"),
    ("Python: Fundamentals", "Python Basics — Real Python",        "https://realpython.com/python-first-steps/",           "article"),
    ("Python: Fundamentals", "Python Functions Explained",         "https://www.youtube.com/watch?v=9Os0o3wzS_I",          "video"),

    # ── Python: Data Structures ──────────────────────────────────────────────
    ("Python: Data Structures", "Python Lists and Dicts",          "https://www.youtube.com/watch?v=W8KRzm-HUcc",          "video"),
    ("Python: Data Structures", "Python Sets and Tuples",          "https://www.youtube.com/watch?v=tKTZoB2Vjuk",          "video"),
    ("Python: Data Structures", "List Comprehensions",             "https://realpython.com/list-comprehension-python/",    "article"),
    ("Python: Data Structures", "Python Official — Data Structures","https://docs.python.org/3/tutorial/datastructures.html","article"),

    # ── Python: OOP ──────────────────────────────────────────────────────────
    ("Python: OOP", "OOP in Python — Full Tutorial",              "https://www.youtube.com/watch?v=JeznW_7DlB0",           "video"),
    ("Python: OOP", "Python Classes Explained",                   "https://www.youtube.com/watch?v=apACNr7DC_s",           "video"),
    ("Python: OOP", "Real Python — OOP",                          "https://realpython.com/python3-object-oriented-programming/", "article"),
    ("Python: OOP", "Python Inheritance Guide",                   "https://www.programiz.com/python-programming/inheritance","article"),

    # ── Python: File & Modules ───────────────────────────────────────────────
    ("Python: File & Modules", "Python File I/O",                 "https://www.youtube.com/watch?v=Uh2ebFW8OYM",           "video"),
    ("Python: File & Modules", "Python Modules and Packages",     "https://www.youtube.com/watch?v=cqP758k4FUo",           "video"),
    ("Python: File & Modules", "Real Python — Working with Files","https://realpython.com/working-with-files-in-python/",  "article"),
    ("Python: File & Modules", "Python Standard Library",         "https://docs.python.org/3/library/",                   "article"),

    # ── Python: Error Handling ───────────────────────────────────────────────
    ("Python: Error Handling", "Python Exceptions Explained",     "https://www.youtube.com/watch?v=NIWwJbo-9_8",           "video"),
    ("Python: Error Handling", "Context Managers in Python",      "https://www.youtube.com/watch?v=-aKFBoZpiqA",           "video"),
    ("Python: Error Handling", "Real Python — Exceptions",        "https://realpython.com/python-exceptions/",             "article"),
    ("Python: Error Handling", "Python try/except/finally",       "https://www.programiz.com/python-programming/exception-handling","article"),

    # ── Web: HTML & CSS ──────────────────────────────────────────────────────
    ("Web: HTML & CSS", "HTML Crash Course",                      "https://www.youtube.com/watch?v=UB1O30fR-EE",           "video"),
    ("Web: HTML & CSS", "CSS Crash Course",                       "https://www.youtube.com/watch?v=yfoY53QXEnI",           "video"),
    ("Web: HTML & CSS", "MDN — Learn HTML",                       "https://developer.mozilla.org/en-US/docs/Learn/HTML",   "article"),
    ("Web: HTML & CSS", "MDN — Learn CSS",                        "https://developer.mozilla.org/en-US/docs/Learn/CSS",    "article"),

    # ── Web: JavaScript ──────────────────────────────────────────────────────
    ("Web: JavaScript", "JavaScript Crash Course",                "https://www.youtube.com/watch?v=hdI2bqOjy3c",           "video"),
    ("Web: JavaScript", "JavaScript ES6 Features",               "https://www.youtube.com/watch?v=NCwa_xi0Uuc",            "video"),
    ("Web: JavaScript", "JavaScript.info",                        "https://javascript.info/",                              "article"),
    ("Web: JavaScript", "MDN — JavaScript Guide",                 "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide","article"),

    # ── Web: React Basics ────────────────────────────────────────────────────
    ("Web: React Basics", "React Crash Course 2024",              "https://www.youtube.com/watch?v=LDB4uaJ87e0",           "video"),
    ("Web: React Basics", "React Hooks Explained",                "https://www.youtube.com/watch?v=TNhaISOUy6Q",           "video"),
    ("Web: React Basics", "React Official — Quick Start",         "https://react.dev/learn",                               "article"),
    ("Web: React Basics", "React — useEffect Guide",              "https://react.dev/reference/react/useEffect",           "article"),

    # ── Web: REST APIs ───────────────────────────────────────────────────────
    ("Web: REST APIs", "REST API Crash Course",                   "https://www.youtube.com/watch?v=qbLc5a9jdXo",           "video"),
    ("Web: REST APIs", "HTTP Status Codes Explained",             "https://www.youtube.com/watch?v=wJa5CTIFj7U",           "video"),
    ("Web: REST APIs", "REST API Tutorial",                       "https://www.restapitutorial.com/",                      "article"),
    ("Web: REST APIs", "MDN — HTTP Overview",                     "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview","article"),

    # ── Web: Deployment ──────────────────────────────────────────────────────
    ("Web: Deployment", "Deploy React App to Vercel",             "https://www.youtube.com/watch?v=b2bIdtSwDhc",           "video"),
    ("Web: Deployment", "Environment Variables Explained",        "https://www.youtube.com/watch?v=17UVejOw3zA",           "video"),
    ("Web: Deployment", "Netlify — Deploy a Site",                "https://docs.netlify.com/get-started/",                 "article"),
    ("Web: Deployment", "GitHub Actions CI/CD Tutorial",          "https://www.youtube.com/watch?v=R8_veQiYBjI",           "video"),

    # ── DB: Relational Basics ────────────────────────────────────────────────
    ("DB: Relational Basics", "Database Fundamentals",            "https://www.youtube.com/watch?v=wR0jg0eQsZA",           "video"),
    ("DB: Relational Basics", "Relational Databases Explained",   "https://www.youtube.com/watch?v=OqjJjpjDRLc",           "video"),
    ("DB: Relational Basics", "IBM — What is a Relational DB",    "https://www.ibm.com/topics/relational-databases",        "article"),
    ("DB: Relational Basics", "Primary & Foreign Keys",           "https://www.programiz.com/sql/primary-key",             "article"),

    # ── DB: SQL Queries ──────────────────────────────────────────────────────
    ("DB: SQL Queries", "SQL Tutorial Full Course",               "https://www.youtube.com/watch?v=HXV3zeQKqGY",           "video"),
    ("DB: SQL Queries", "SQL JOINs Explained",                    "https://www.youtube.com/watch?v=9yeOJ0ZMUYw",           "video"),
    ("DB: SQL Queries", "SQLZoo Interactive Tutorial",            "https://sqlzoo.net/",                                   "article"),
    ("DB: SQL Queries", "W3Schools — SQL",                        "https://www.w3schools.com/sql/",                        "article"),

    # ── DB: Schema Design ────────────────────────────────────────────────────
    ("DB: Schema Design", "Database Normalization Explained",     "https://www.youtube.com/watch?v=GFQaEYEc8_8",           "video"),
    ("DB: Schema Design", "ER Diagrams Tutorial",                 "https://www.youtube.com/watch?v=QpdhBUYk7Kk",           "video"),
    ("DB: Schema Design", "Guru99 — Database Normalization",      "https://www.guru99.com/database-normalization.html",    "article"),
    ("DB: Schema Design", "Lucidchart — ER Diagram Guide",        "https://www.lucidchart.com/pages/er-diagrams",          "article"),

    # ── DB: Transactions ─────────────────────────────────────────────────────
    ("DB: Transactions", "ACID Properties Explained",             "https://www.youtube.com/watch?v=pomxJOFVcQs",           "video"),
    ("DB: Transactions", "Database Transactions & Locks",         "https://www.youtube.com/watch?v=5ZjhNTM8XU8",           "video"),
    ("DB: Transactions", "IBM — ACID Properties",                 "https://www.ibm.com/topics/acid-transactions",          "article"),
    ("DB: Transactions", "Postgres — Transactions",               "https://www.postgresql.org/docs/current/tutorial-transactions.html","article"),

    # ── DB: NoSQL ────────────────────────────────────────────────────────────
    ("DB: NoSQL", "NoSQL Databases Explained",                    "https://www.youtube.com/watch?v=0buKQHokLK8",           "video"),
    ("DB: NoSQL", "MongoDB Crash Course",                         "https://www.youtube.com/watch?v=-bt_y4Loofg",           "video"),
    ("DB: NoSQL", "MongoDB Official — What is NoSQL",             "https://www.mongodb.com/nosql-explained",               "article"),
    ("DB: NoSQL", "Redis — Intro to Key-Value Stores",            "https://redis.io/docs/about/",                          "article"),

    # ── ML: Math Foundations ─────────────────────────────────────────────────
    ("ML: Math Foundations", "3B1B — Vectors (Linear Algebra)",   "https://www.youtube.com/watch?v=fNk_zzaMoSs",           "video"),
    ("ML: Math Foundations", "Statistics for ML",                 "https://www.youtube.com/watch?v=xxpc-HPKN28",           "video"),
    ("ML: Math Foundations", "Khan Academy — Probability",        "https://www.khanacademy.org/math/statistics-probability","article"),
    ("ML: Math Foundations", "3B1B — Essence of Calculus",        "https://www.youtube.com/watch?v=WUvTyaaNkzM",           "video"),

    # ── ML: Supervised Learning ──────────────────────────────────────────────
    ("ML: Supervised Learning", "Supervised Learning Explained",  "https://www.youtube.com/watch?v=4qVRBYAdLAo",           "video"),
    ("ML: Supervised Learning", "Linear Regression Explained",    "https://www.youtube.com/watch?v=nk2CQITm_eo",           "video"),
    ("ML: Supervised Learning", "Google ML Crash Course",         "https://developers.google.com/machine-learning/crash-course","article"),
    ("ML: Supervised Learning", "Scikit-learn — Getting Started", "https://scikit-learn.org/stable/getting_started.html",  "article"),

    # ── ML: Unsupervised Learning ────────────────────────────────────────────
    ("ML: Unsupervised Learning", "K-Means Clustering",           "https://www.youtube.com/watch?v=4b5d3muPQmA",           "video"),
    ("ML: Unsupervised Learning", "PCA Explained — StatQuest",    "https://www.youtube.com/watch?v=FgakZw6K1QQ",           "video"),
    ("ML: Unsupervised Learning", "Scikit-learn — Clustering",    "https://scikit-learn.org/stable/modules/clustering.html","article"),
    ("ML: Unsupervised Learning", "Towards Data Science — PCA",   "https://towardsdatascience.com/a-one-stop-shop-for-principal-component-analysis-5582fb7e0a9c","article"),

    # ── ML: Neural Networks ──────────────────────────────────────────────────
    ("ML: Neural Networks", "3B1B — But What Is a Neural Network?","https://www.youtube.com/watch?v=aircAruvnKk",          "video"),
    ("ML: Neural Networks", "3B1B — Gradient Descent",            "https://www.youtube.com/watch?v=IHZwWFHWa-w",           "video"),
    ("ML: Neural Networks", "Deep Learning Book (free)",           "https://www.deeplearningbook.org/",                    "article"),
    ("ML: Neural Networks", "Neural Networks — CS231n Notes",      "https://cs231n.github.io/neural-networks-1/",           "article"),

    # ── ML: Model Evaluation ─────────────────────────────────────────────────
    ("ML: Model Evaluation", "Overfitting & Underfitting",        "https://www.youtube.com/watch?v=EehRcPo1M-Q",           "video"),
    ("ML: Model Evaluation", "Cross Validation Explained",        "https://www.youtube.com/watch?v=fSytzGwwBVw",           "video"),
    ("ML: Model Evaluation", "Scikit-learn — Model Evaluation",   "https://scikit-learn.org/stable/modules/model_evaluation.html","article"),
    ("ML: Model Evaluation", "StatQuest — ROC and AUC",           "https://www.youtube.com/watch?v=4jRBRDbJemM",           "video"),
]

resource_objs = []
for t_name, title, url, rtype in resources_data:
    tp = T(t_name)
    r = db.query(Resource).filter_by(title=title).first()
    if not r:
        r = Resource(topic_id=tp.id, uploader_id=admin.id, title=title, url=url,
                     resource_type=rtype, status=ResourceStatus.approved)
        db.add(r)
        db.flush()
    resource_objs.append(r)
db.commit()

# Sample ratings from alice and bob (first 10 resources)
for i, r in enumerate(resource_objs[:10]):
    if not db.query(Rating).filter_by(user_id=alice.id, resource_id=r.id).first():
        db.add(Rating(user_id=alice.id, resource_id=r.id, stars=5 - (i % 2)))
    if not db.query(Engagement).filter_by(user_id=alice.id, resource_id=r.id).first():
        db.add(Engagement(user_id=alice.id, resource_id=r.id,
                          watch_completion=1.0, revisit_count=1, completed=True))
for i, r in enumerate(resource_objs[4:12]):
    if not db.query(Rating).filter_by(user_id=bob.id, resource_id=r.id).first():
        db.add(Rating(user_id=bob.id, resource_id=r.id, stars=4 + (i % 2)))
db.commit()

# Onboarding questions
onboarding = [
    ("What best describes your programming experience?",   None),
    ("Which area interests you most?",                      None),
    ("Have you studied data structures before?",           T("DSA: Fundamentals").id),
    ("Are you interested in machine learning?",            T("ML: Math Foundations").id),
    ("Do you want to build websites?",                     T("Web: HTML & CSS").id),
]
for q, t_id in onboarding:
    if not db.query(OnboardingQuestion).filter_by(question=q).first():
        db.add(OnboardingQuestion(question=q, topic_id=t_id))
db.commit()
db.close()
print("Seeded. Admin: admin/admin123 | alice/alice123 | bob/bob123")
print(f"Topics: {len(topics_data)} | Resources: {len(resources_data)}")
