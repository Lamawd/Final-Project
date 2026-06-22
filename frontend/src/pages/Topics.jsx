import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

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

  return (
    <div className="page">
      <h2>Topic Map</h2>
      <div className="topic-grid">
        {topics.map((t) => (
          <div key={t.id} className={`topic-card ${progress[t.id] ? "completed" : ""}`}>
            <div className="topic-card-header">
              <Link to={`/topics/${t.id}`}>{t.title}</Link>
              {progress[t.id] && <span className="badge">✓ Done</span>}
            </div>
            <p>{t.description}</p>
            {t.prerequisites.length > 0 && (
              <div className="prereqs">
                <small>Requires: {t.prerequisites.map((pid) => (
                  <span key={pid} className="prereq-tag">{topicMap[pid] || pid}</span>
                ))}</small>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
