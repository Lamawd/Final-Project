// Courses config — matches seed.py order_index hundreds digit
// Each topic's order_index: 1xx = DSA, 2xx = Python, 3xx = Web, 4xx = DB, 5xx = ML
export const COURSES = [
  {
    id: 1,
    title: "Data Structures & Algorithms",
    description: "Master fundamental CS concepts: complexity, lists, trees, sorting, searching, and graphs.",
    icon: "dsa",
    color: "#6366f1",
    light: "#eef2ff",
  },
  {
    id: 2,
    title: "Python Programming",
    description: "From basics to OOP, file I/O, and error handling in Python.",
    icon: "python",
    color: "#10b981",
    light: "#ecfdf5",
  },
  {
    id: 3,
    title: "Web Development",
    description: "HTML, CSS, JavaScript, React, REST APIs, and deployment.",
    icon: "web",
    color: "#f59e0b",
    light: "#fffbeb",
  },
  {
    id: 4,
    title: "Databases & SQL",
    description: "Relational databases, SQL queries, schema design, and NoSQL.",
    icon: "db",
    color: "#3b82f6",
    light: "#eff6ff",
  },
  {
    id: 5,
    title: "Machine Learning",
    description: "Math foundations, supervised/unsupervised learning, neural networks, and evaluation.",
    icon: "ml",
    color: "#ec4899",
    light: "#fdf2f8",
  },
];

/** Extract course number from order_index (hundreds digit) */
export function courseOf(topic) {
  return Math.floor(topic.order_index / 100);
}
