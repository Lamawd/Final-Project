import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";

export default function CourseDetail() {
  const { courseId } = useParams();
  const cid = parseInt(courseId);
  const course = COURSES.find((c) => c.id === cid);
  const navigate = useNavigate();

  const [subtopics, setSubtopics] = useState([]);
  const [progress, setProgress] = useState({});
  const [gateModal, setGateModal] = useState(null); // { topic, prereqNames }

  useEffect(() => {
    Promise.all([
      api.get("/topics/"),
      api.get("/topics/progress/me").catch(() => ({ data: [] })),
    ]).then(([topicsRes, progressRes]) => {
      const mine = topicsRes.data.filter((t) => courseOf(t) === cid)
        .sort((a, b) => a.order_index - b.order_index);
      setSubtopics(mine);
      const map = {};
      progressRes.data.forEach((p) => { map[p.topic_id] = p.completed; });
      setProgress(map);
    });
  }, [cid]);

  if (!course) return <p className="loading">Course not found.</p>;

  const topicMap = Object.fromEntries(subtopics.map((t) => [t.id, t.title]));

  const handleClick = (topic) => {
    // Check hard prerequisites that are not yet completed
    const unmetHard = (topic.prerequisites || []).filter(
      (pid) => progress[pid] !== true
    );
    if (unmetHard.length > 0) {
      const names = unmetHard.map((pid) => topicMap[pid] || `Topic #${pid}`);
      setGateModal({ topic, prereqNames: names });
    } else {
      navigate(`/topics/${topic.id}`);
    }
  };

  return (
    <div className="page">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="course-detail-header"
        style={{ borderLeft: `4px solid ${course.color}` }}
      >
        <span className="course-icon-lg">{course.icon}</span>
        <div>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
      </motion.div>

      <div className="roadmap">
        {subtopics.map((topic, i) => {
          const done = progress[topic.id];
          const hasUnmet = (topic.prerequisites || []).some((pid) => !progress[pid]);

          return (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className={`roadmap-item ${done ? "done" : ""} ${hasUnmet ? "locked" : ""}`}
              onClick={() => handleClick(topic)}
              style={{ "--c": course.color }}
            >
              <div className="roadmap-dot">
                {done ? "✓" : i + 1}
              </div>
              <div className="roadmap-body">
                <span className="roadmap-title">{topic.title.replace(/^[^:]+: /, "")}</span>
                <span className="roadmap-desc">{topic.description}</span>
                <div className="roadmap-meta">
                  {topic.resource_count > 0 && (
                    <span className="resource-count-badge">{topic.resource_count} resources</span>
                  )}
                  {hasUnmet && <span className="locked-badge">🔒 Complete prerequisites first</span>}
                </div>
              </div>
              <span className="roadmap-arrow">{done ? "✓" : "→"}</span>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {gateModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setGateModal(null)}
          >
            <motion.div
              className="modal-box"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>⚠️ Prerequisites Required</h3>
              <p>
                <strong>{gateModal.topic.title.replace(/^[^:]+: /, "")}</strong> requires you to
                complete these topics first:
              </p>
              <ul className="prereq-list">
                {gateModal.prereqNames.map((n) => <li key={n}>• {n.replace(/^[^:]+: /, "")}</li>)}
              </ul>
              <p className="modal-question">Do you already know this material?</p>
              <div className="modal-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => { setGateModal(null); navigate(`/topics/${gateModal.topic.id}`); }}
                >
                  Yes, I know it — continue
                </button>
                <button className="btn" onClick={() => setGateModal(null)}>
                  No, go back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
