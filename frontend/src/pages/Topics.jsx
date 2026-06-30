import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";
import CourseIcon from "../components/CourseIcon";

export default function Topics() {
  const [topics, setTopics] = useState([]);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    api.get("/topics/").then((r) => setTopics(r.data));
    api.get("/topics/progress/me").then((r) => {
      const map = {};
      r.data.forEach((p) => { map[p.topic_id] = p.completed; });
      setProgress(map);
    }).catch(() => {});
  }, []);

  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t.title]));

  // Group topics by course
  const grouped = COURSES.map((course) => ({
    course,
    topics: topics
      .filter((t) => courseOf(t) === course.id)
      .sort((a, b) => a.order_index - b.order_index),
  })).filter((g) => g.topics.length > 0);

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 style={{ marginBottom: 4 }}>Topic Map</h2>
        <p className="muted" style={{ marginBottom: 28 }}>All topics across every course — see what you've completed and what's next.</p>
      </motion.div>

      {grouped.map(({ course, topics: courseTopics }, gi) => {
        const done = courseTopics.filter((t) => progress[t.id]).length;
        const pct = courseTopics.length ? Math.round((done / courseTopics.length) * 100) : 0;
        return (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.06 }}
            style={{ marginBottom: 36 }}
          >
            {/* Course header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <CourseIcon icon={course.icon} color={course.color} size={22} />
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{course.title}</h3>
              <span className="muted" style={{ fontSize: "0.82rem", marginLeft: "auto" }}>
                {done}/{courseTopics.length} done
              </span>
            </div>
            <div className="progress-bar-wrap" style={{ marginBottom: 12 }}>
              <div className="progress-bar" style={{ width: `${pct}%`, background: course.color }} />
            </div>

            <div className="topic-grid">
              {courseTopics.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.06 + i * 0.03 }}
                  className={`topic-card ${progress[t.id] ? "completed" : ""}`}
                  style={{ "--c": course.color }}
                >
                  <div className="topic-card-header">
                    <Link to={`/topics/${t.id}`}>{t.title.replace(/^[^:]+: /, "")}</Link>
                    {progress[t.id] && (
                      <span className="badge" style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Check size={11} /> Done
                      </span>
                    )}
                  </div>
                  {t.description && <p className="muted" style={{ fontSize: "0.82rem", margin: "4px 0 0" }}>{t.description}</p>}
                  {t.prerequisites.length > 0 && (
                    <div className="prereqs" style={{ marginTop: 6 }}>
                      <small>Requires: {t.prerequisites.map((pid) => (
                        <span key={pid} className="prereq-tag">{(topicMap[pid] || `#${pid}`).replace(/^[^:]+: /, "")}</span>
                      ))}</small>
                    </div>
                  )}
                  {t.resource_count > 0 && (
                    <span className="resource-count-badge" style={{ marginTop: 6, display: "inline-block" }}>
                      {t.resource_count} resource{t.resource_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
