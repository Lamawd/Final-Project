import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";
import CourseIcon from "../components/CourseIcon";

export default function Courses() {
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
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 style={{ marginBottom: 4 }}>Courses</h2>
        <p className="muted" style={{ marginBottom: 28 }}>Choose a course and follow the roadmap at your own pace.</p>
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
              <div className="course-icon">
                <CourseIcon icon={course.icon} color={course.color} size={36} />
              </div>
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
