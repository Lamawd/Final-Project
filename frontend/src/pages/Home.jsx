import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";

export default function Home() {
  const [progress, setProgress] = useState({});
  const [topicsByCourse, setTopicsByCourse] = useState({});

  useEffect(() => {
    api.get("/topics/").then((r) => {
      const map = {};
      r.data.forEach((t) => {
        const cid = courseOf(t);
        if (!map[cid]) map[cid] = [];
        map[cid].push(t);
      });
      setTopicsByCourse(map);
    });
    api.get("/topics/progress/me").then((r) => {
      const map = {};
      r.data.forEach((p) => { map[p.topic_id] = p.completed; });
      setProgress(map);
    }).catch(() => {});
  }, []);

  return (
    <div className="page">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="home-hero"
      >
        <h1>Welcome to Opic</h1>
        <p>Choose a course and start learning at your own pace.</p>
      </motion.div>

      <div className="course-grid">
        {COURSES.map((course, i) => {
          const topics = topicsByCourse[course.id] || [];
          const done = topics.filter((t) => progress[t.id]).length;
          const pct = topics.length ? Math.round((done / topics.length) * 100) : 0;

          return (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -4, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
              className="course-card"
              style={{ "--course-color": course.color, "--course-light": course.light }}
            >
              <div className="course-icon">{course.icon}</div>
              <div className="course-body">
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="progress-bar-wrap">
                  <div className="progress-bar" style={{ width: `${pct}%`, background: course.color }} />
                </div>
                <span className="progress-label">{done}/{topics.length} subtopics</span>
              </div>
              <Link to={`/courses/${course.id}`} className="course-btn" style={{ background: course.color }}>
                {pct > 0 ? "Continue" : "Start"} →
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
