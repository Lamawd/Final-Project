import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";

/** Build array of last N days as YYYY-MM-DD strings */
function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function HeatmapCell({ date, count }) {
  const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3;
  const colors = ["#eef2ff", "#a5b4fc", "#6366f1", "#3730a3"];
  return (
    <div
      className="heatmap-cell"
      style={{ background: colors[level] }}
      title={`${date}: ${count} resource${count !== 1 ? "s" : ""} completed`}
    />
  );
}

export default function Progress() {
  const [activity, setActivity] = useState(null);
  const [topics, setTopics]     = useState([]);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    api.get("/topics/progress/activity").then((r) => setActivity(r.data)).catch(() => {});
    api.get("/topics/").then((r) => setTopics(r.data));
    api.get("/topics/progress/me").then((r) => {
      const map = {};
      r.data.forEach((p) => { map[p.topic_id] = p.completed; });
      setProgress(map);
    }).catch(() => {});
  }, []);

  const days = lastNDays(30);
  const daily = activity?.daily || {};

  // Group completed topics by course
  const courseProgress = COURSES.map((course) => {
    const courseTopics = topics.filter((t) => courseOf(t) === course.id);
    const done = courseTopics.filter((t) => progress[t.id]).length;
    return { ...course, done, total: courseTopics.length };
  });

  const stats = [
    { label: "Resources Done",  value: activity?.total_resources ?? "—", icon: "✅" },
    { label: "Topics Completed", value: activity?.total_topics ?? "—",    icon: "🏆" },
    { label: "Minutes on Opic",   value: activity?.total_minutes ?? "—",    icon: "⏱️" },
  ];

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 style={{ marginBottom: 4 }}>My Progress</h2>
        <p className="muted" style={{ marginBottom: 28 }}>Track what you've learned and how consistently you study.</p>
      </motion.div>

      {/* Stat cards */}
      <div className="stat-cards">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <span className="stat-icon">{s.icon}</span>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </motion.div>
        ))}
      </div>

      {/* 30-day activity heatmap */}
      <motion.div
        className="heatmap-box"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="section-title">📅 Activity — Last 30 Days</h3>
        <div className="heatmap-grid">
          {days.map((day) => (
            <HeatmapCell key={day} date={day} count={daily[day] || 0} />
          ))}
        </div>
        <div className="heatmap-legend">
          <span className="muted" style={{ fontSize: "0.8rem" }}>Less</span>
          {["#eef2ff", "#a5b4fc", "#6366f1", "#3730a3"].map((c) => (
            <div key={c} className="heatmap-cell" style={{ background: c }} />
          ))}
          <span className="muted" style={{ fontSize: "0.8rem" }}>More</span>
        </div>
      </motion.div>

      {/* Per-course progress bars */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>📚 Course Progress</h3>
        <div className="course-progress-list">
          {courseProgress.map((c) => {
            const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <div key={c.id} className="course-progress-row">
                <span className="course-progress-icon">{c.icon}</span>
                <div className="course-progress-body">
                  <div className="course-progress-top">
                    <span className="course-progress-name">{c.title}</span>
                    <span className="course-progress-pct">{c.done}/{c.total}</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <motion.div
                      className="progress-bar"
                      style={{ background: c.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
