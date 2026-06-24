"""Seed the DB with 5 courses + subtopics and rich resources."""
import sys
sys.path.insert(0, ".")

from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.models.models import (
    Topic, TopicPrerequisite, User, OnboardingQuestion, OnboardingAnswer,
    Resource, ResourceStatus, Rating, Engagement, UserProgress
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

    # ── Extra resources ───────────────────────────────────────────────────────
    ("DSA: Fundamentals", "Recursion Explained Simply",           "https://www.youtube.com/watch?v=mz6tAJMVmfM",           "video"),
    ("DSA: Fundamentals", "GeeksForGeeks — Asymptotic Notation",  "https://www.geeksforgeeks.org/asymptotic-notation-and-analysis-based-on-input-size-of-algorithms/", "article"),
    ("DSA: Fundamentals", "Harvard CS50 — Asymptotic Notation",   "https://www.youtube.com/watch?v=iOq5kSKqeR4",           "video"),
    ("DSA: Fundamentals", "UC Berkeley — Big O",                  "https://www.youtube.com/watch?v=VIS4YDpuP98",           "video"),
    ("DSA: Fundamentals", "TopCoder — Computational Complexity 1","https://www.topcoder.com/thrive/articles/Computational%20Complexity%20part%20one", "article"),
    ("DSA: Lists",        "Double Linked List Tutorial",          "https://www.youtube.com/watch?v=K5hinb_ORCM",           "video"),
    ("DSA: Lists",        "Programiz — Stack",                    "https://www.programiz.com/dsa/stack",                   "article"),
    ("DSA: Lists",        "Linked Lists CS50 Harvard",            "https://www.youtube.com/watch?v=2T-A_GFuoTo",           "video"),
    ("DSA: Lists",        "Why You Should Avoid Linked Lists",    "https://www.youtube.com/watch?v=YQs6IC-vgmo",           "video"),
    ("DSA: Lists",        "Queue — 3 Minutes",                    "https://youtu.be/D6gu-_tmEpQ",                          "video"),
    ("DSA: Trees",        "AVL Trees Explained",                  "https://www.youtube.com/watch?v=vRwi_UcZGjU",           "video"),
    ("DSA: Trees",        "GeeksForGeeks — Binary Tree",          "https://www.geeksforgeeks.org/binary-tree-data-structure/","article"),
    ("DSA: Trees",        "BFS and DFS — 4 Minutes Each",         "https://youtu.be/HZ5YTanv5QE",                          "video"),
    ("DSA: Trees",        "MIT 6.006 — Binary Heaps",             "https://www.youtube.com/watch?v=Xnpo1atN-Iw",           "video"),
    ("DSA: Sorting",      "Heap Sort Explained",                  "https://www.youtube.com/watch?v=2DmK_H7IdTo",           "video"),
    ("DSA: Sorting",      "Insertion Sort & Merge Sort — MIT",    "https://www.youtube.com/watch?v=Kg4bqzAqRBM",           "video"),
    ("DSA: Sorting",      "Selection Sort",                       "https://www.youtube.com/watch?v=6nDMgr0-Yyo",           "video"),
    ("DSA: Searching",    "Linear vs Binary Search",              "https://www.geeksforgeeks.org/linear-search-vs-binary-search/","article"),
    ("DSA: Searching",    "Binary Search — Khan Academy",         "https://www.khanacademy.org/computing/computer-science/algorithms/binary-search/a/binary-search", "article"),
    ("DSA: Graphs",       "Minimum Spanning Tree — Kruskal",      "https://www.youtube.com/watch?v=JZBQLXgSGfs",           "video"),
    ("DSA: Graphs",       "Graph Theory — William Fiset",         "https://www.youtube.com/watch?v=DgXR2OWQnLc",           "video"),
    ("Python: Fundamentals","Python Crash Course (Traversy)",     "https://www.youtube.com/watch?v=JJmcL1N2KQs",           "video"),
    ("Python: Fundamentals","Automate the Boring Stuff — Free",   "https://automatetheboringstuff.com/",                   "article"),
    ("Python: Data Structures","Python Dictionary Deep Dive",     "https://realpython.com/python-dicts/",                  "article"),
    ("Python: Data Structures","Python Sets — Real Python",       "https://realpython.com/python-sets/",                   "article"),
    ("Python: OOP",       "Dunder Methods in Python",             "https://www.youtube.com/watch?v=3ohzBxoFHAY",           "video"),
    ("Python: OOP",       "Python @property Decorator",           "https://realpython.com/python-property/",               "article"),
    ("Python: File & Modules","Python os Module Guide",           "https://realpython.com/python-os-module/",              "article"),
    ("Python: File & Modules","Python pathlib — Real Python",     "https://realpython.com/python-pathlib/",                "article"),
    ("Python: Error Handling","Logging in Python",                "https://www.youtube.com/watch?v=-ARI4Cz-awo",           "video"),
    ("Python: Error Handling","Python Debugging with pdb",        "https://realpython.com/python-debugging-pdb/",          "article"),
    ("Web: HTML & CSS",   "Flexbox in 100 Seconds",               "https://www.youtube.com/watch?v=K74l26pE4YA",           "video"),
    ("Web: HTML & CSS",   "CSS Grid in 100 Seconds",              "https://www.youtube.com/watch?v=uuOXPWCh-6o",           "video"),
    ("Web: JavaScript",   "Async / Await Explained",              "https://www.youtube.com/watch?v=V_Kr9OSfDeU",           "video"),
    ("Web: JavaScript",   "JavaScript — The Hard Parts",          "https://www.youtube.com/watch?v=aAIqaZlI2zo",           "video"),
    ("Web: React Basics", "React State Management Guide",         "https://www.youtube.com/watch?v=35lXWvCuM8o",           "video"),
    ("Web: React Basics", "React — Full Tutorial freeCodeCamp",   "https://www.youtube.com/watch?v=bMknfKXIFA8",           "video"),
    ("Web: REST APIs",    "Postman API Testing Tutorial",         "https://www.youtube.com/watch?v=VywxIQ2ZXw4",           "video"),
    ("Web: REST APIs",    "What is REST?",                        "https://restfulapi.net/",                               "article"),
    ("Web: Deployment",   "Docker in 100 Seconds",                "https://www.youtube.com/watch?v=Gjnup-PuquQ",           "video"),
    ("Web: Deployment",   "GitHub Actions in 10 Minutes",         "https://www.youtube.com/watch?v=R8_veQiYBjI",           "video"),
    ("DB: Relational Basics","What is SQL?",                      "https://www.youtube.com/watch?v=27axs9dO7AE",           "video"),
    ("DB: Relational Basics","ACID Properties — Simple Explanation","https://www.databricks.com/glossary/acid-transactions","article"),
    ("DB: SQL Queries",   "Advanced SQL Tutorial",                "https://www.youtube.com/watch?v=M-55BmjOuXY",           "video"),
    ("DB: SQL Queries",   "Mode — SQL Tutorial",                  "https://mode.com/sql-tutorial/",                       "article"),
    ("DB: Schema Design", "Database Design Full Course",          "https://www.youtube.com/watch?v=ztHopE5Wnpc",           "video"),
    ("DB: Schema Design", "How to Design a Database",             "https://www.youtube.com/watch?v=cepspxahUMo",           "video"),
    ("DB: Transactions",  "Database Deadlocks Explained",         "https://www.youtube.com/watch?v=oJ5DboeZnN4",           "video"),
    ("DB: Transactions",  "Postgres — Isolation Levels",          "https://www.postgresql.org/docs/current/transaction-iso.html","article"),
    ("DB: NoSQL",         "Redis Crash Course",                   "https://www.youtube.com/watch?v=jgpVdJB2sKQ",           "video"),
    ("DB: NoSQL",         "CAP Theorem Explained",                "https://www.youtube.com/watch?v=k-Yaq8AHlFA",           "video"),
    ("ML: Math Foundations","Probability for ML — Khan",          "https://www.youtube.com/watch?v=uzkc-qNVoOk",           "video"),
    ("ML: Math Foundations","StatQuest — Statistics Fundamentals","https://www.youtube.com/playlist?list=PLblh5JKOoLUK0FLuzwntyYI10UQFUhsY9","video"),
    ("ML: Supervised Learning","Decision Trees Explained",        "https://www.youtube.com/watch?v=7VeUPuFGJHk",           "video"),
    ("ML: Supervised Learning","Google ML Crash Course — Framing","https://developers.google.com/machine-learning/crash-course/framing/video-lecture","article"),
    ("ML: Unsupervised Learning","DBSCAN Clustering",             "https://www.youtube.com/watch?v=RDZUdRSDOok",           "video"),
    ("ML: Unsupervised Learning","StatQuest — PCA Step by Step",  "https://www.youtube.com/watch?v=FgakZw6K1QQ",           "video"),
    ("ML: Neural Networks","PyTorch in 100 Seconds",              "https://www.youtube.com/watch?v=ORMx45xqWkA",           "video"),
    ("ML: Neural Networks","3B1B — Backpropagation Calculus",     "https://www.youtube.com/watch?v=tIeHLnjs5U8",           "video"),
    ("ML: Model Evaluation","Precision vs Recall",                "https://www.youtube.com/watch?v=jJ7ff7Gcank",           "video"),
    ("ML: Model Evaluation","StatQuest — Confusion Matrix",       "https://www.youtube.com/watch?v=Kdsp6soqA7o",           "video"),
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
from datetime import datetime, timedelta
import random
random.seed(42)

alice_ratings = [
    (0,5),(1,4),(2,5),(3,3),(4,5),(5,4),(6,2),(7,5),(8,4),(9,3),
    (10,5),(11,4),(12,3),(13,5),(14,2),(15,4),(16,5),(17,3),(18,4),(19,5),
    (20,2),(21,4),(22,5),(23,3),(24,5),(25,4),(26,2),(27,5),(28,3),(29,4),
]
bob_ratings = [
    (4,4),(5,5),(6,3),(7,4),(8,2),(9,5),(10,4),(11,3),(12,5),(13,4),
    (30,5),(31,3),(32,4),(33,2),(34,5),(35,4),(36,3),(37,5),(38,2),(39,4),
]
for idx, stars_val in alice_ratings:
    if idx >= len(resource_objs): continue
    r = resource_objs[idx]
    if not db.query(Rating).filter_by(user_id=alice.id, resource_id=r.id).first():
        db.add(Rating(user_id=alice.id, resource_id=r.id, stars=stars_val))
    if not db.query(Engagement).filter_by(user_id=alice.id, resource_id=r.id).first():
        db.add(Engagement(user_id=alice.id, resource_id=r.id,
                          watch_completion=1.0 if stars_val >= 4 else 0.5,
                          revisit_count=1 if stars_val == 5 else 0,
                          completed=stars_val >= 3,
                          completed_at=datetime.utcnow() - timedelta(days=random.randint(0, 29)) if stars_val >= 3 else None))
for idx, stars_val in bob_ratings:
    if idx >= len(resource_objs): continue
    r = resource_objs[idx]
    if not db.query(Rating).filter_by(user_id=bob.id, resource_id=r.id).first():
        db.add(Rating(user_id=bob.id, resource_id=r.id, stars=stars_val))
db.commit()

# Demo activity heatmap: spread engagements across last 30 days
# pattern index 0 = today, higher = further back; most days have activity
activity_pattern = [3,2,0,4,2,1,0,3,3,2,1,0,0,4,2,3,1,2,0,3,2,1,3,0,2,4,2,1,3,2]
resource_pool = resource_objs[10:]
ri = 0
for days_ago, count in enumerate(activity_pattern):
    ts = datetime.utcnow() - timedelta(days=days_ago)
    for _ in range(count):
        if ri >= len(resource_pool):
            break
        r = resource_pool[ri]; ri += 1
        if not db.query(Engagement).filter_by(user_id=alice.id, resource_id=r.id).first():
            db.add(Engagement(
                user_id=alice.id, resource_id=r.id,
                watch_completion=1.0, revisit_count=0, completed=True,
                time_spent=random.randint(120, 900), completed_at=ts,
            ))
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

# Demo UserProgress: alice has completed most of DSA + Python, some Web
completed_by_alice = [
    "DSA: Fundamentals", "DSA: Lists", "DSA: Trees", "DSA: Sorting", "DSA: Searching",
    "Python: Fundamentals", "Python: Data Structures", "Python: OOP",
    "Web: HTML & CSS", "Web: JavaScript",
]
for name in completed_by_alice:
    t = T(name)
    if not db.query(UserProgress).filter_by(user_id=alice.id, topic_id=t.id).first():
        db.add(UserProgress(user_id=alice.id, topic_id=t.id, completed=True))

# bob has completed DB basics
completed_by_bob = ["DB: Relational Basics", "DB: SQL Queries", "DSA: Fundamentals"]
for name in completed_by_bob:
    t = T(name)
    if not db.query(UserProgress).filter_by(user_id=bob.id, topic_id=t.id).first():
        db.add(UserProgress(user_id=bob.id, topic_id=t.id, completed=True))

db.commit()

# Demo onboarding answers for alice
q_objs = db.query(OnboardingQuestion).all()
for q in q_objs:
    if not db.query(OnboardingAnswer).filter_by(user_id=alice.id, question_id=q.id).first():
        db.add(OnboardingAnswer(user_id=alice.id, question_id=q.id, answer="yes"))
db.commit()

db.close()
print("Seeded. Admin: admin/admin123 | alice/alice123 | bob/bob123")
print(f"Topics: {len(topics_data)} | Resources: {len(resources_data)}")
