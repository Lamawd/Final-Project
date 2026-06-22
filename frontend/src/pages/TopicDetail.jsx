import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";

/** Extract YouTube video ID. Returns null for playlists or non-YT URLs. */
function ytId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch") && u.searchParams.get("v")) return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
      // playlists — not embeddable
    }
  } catch {}
  return null;
}

export default function TopicDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const topicId = parseInt(id);

  const [topic, setTopic]           = useState(null);
  const [resources, setResources]   = useState([]);
  const [recs, setRecs]             = useState([]);
  const [stars, setStars]           = useState({});
  const [resourceDone, setResourceDone] = useState({});
  const [topicCompleted, setTopicCompleted] = useState(false);
  const [allDone, setAllDone]       = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggest, setSuggest]       = useState({ title: "", url: "", resource_type: "video" });
  const [suggestMsg, setSuggestMsg] = useState("");
  const [suggestErr, setSuggestErr] = useState("");

  const course = topic ? COURSES.find((c) => c.id === courseOf(topic)) : null;

  useEffect(() => {
    api.get(`/topics/${id}`).then((r) => setTopic(r.data));
    api.get(`/resources/topic/${id}`).then((r) => setResources(r.data));
    api.get(`/recommend/topic/${id}`).then((r) => setRecs(r.data)).catch(() => {});
    api.get("/topics/progress/me").then((r) => {
      const found = r.data.find((p) => p.topic_id === topicId);
      if (found) setTopicCompleted(found.completed);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (resources.length > 0 && resources.every((r) => resourceDone[r.id])) {
      setAllDone(true);
    }
  }, [resourceDone, resources]);

  const markResourceDone = async (resource) => {
    const next = !resourceDone[resource.id];
    await api.post(`/resources/${resource.id}/engage`, {
      watch_completion: next ? 1.0 : 0.0,
      revisit_count: 0,
      completed: next,
    });
    setResourceDone((prev) => ({ ...prev, [resource.id]: next }));
  };

  const rate = async (resource_id, s) => {
    await api.post(`/resources/${resource_id}/rate`, { stars: s });
    setStars((prev) => ({ ...prev, [resource_id]: s }));
  };

  const submitSuggest = async (e) => {
    e.preventDefault();
    setSuggestErr("");
    // Frontend URL safety check
    try {
      const u = new URL(suggest.url);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
    } catch {
      setSuggestErr("URL must start with https:// or http://");
      return;
    }
    try {
      await api.post("/resources/", { ...suggest, topic_id: topicId });
      setSuggestMsg("✅ Submitted! An admin will review it shortly.");
      setSuggest({ title: "", url: "", resource_type: "video" });
      setShowSuggest(false);
    } catch (err) {
      setSuggestErr(err.response?.data?.detail || "Submission failed");
    }
  };

  const markTopicComplete = async () => {
    const next = !topicCompleted;
    await api.post(`/topics/${id}/progress`, null, { params: { completed: next } });
    setTopicCompleted(next);
    if (next && course) setTimeout(() => navigate(`/courses/${course.id}`), 800);
  };

  if (!topic) return <p className="loading">Loading…</p>;

  const videos   = resources.filter((r) => r.type === "video");
  const articles = resources.filter((r) => r.type === "article");

  return (
    <div className="page">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="topic-detail-header"
        style={{ "--c": course?.color || "#4f46e5" }}
      >
        <div>
          {course && (
            <span className="breadcrumb" onClick={() => navigate(`/courses/${course.id}`)}>
              {course.icon} {course.title}
            </span>
          )}
          <h2>{topic.title.replace(/^[^:]+: /, "")}</h2>
          <p>{topic.description}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className={`btn ${topicCompleted ? "btn-done" : "btn-primary"}`}
          onClick={markTopicComplete}
          style={!topicCompleted ? { background: course?.color } : {}}
        >
          {topicCompleted ? "✓ Completed" : "Mark Complete"}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {allDone && !topicCompleted && (
          <motion.div
            className="all-done-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            🎉 You've finished all resources! Mark this topic as complete.
          </motion.div>
        )}
      </AnimatePresence>

      {videos.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h3 className="section-title">📹 Videos</h3>
          <div className="resource-cards">
            {videos.map((r, i) => {
              const vid = ytId(r.url);
              const expanded = activeVideo === r.id;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`resource-card ${resourceDone[r.id] ? "resource-done" : ""}`}
                  style={{ "--c": course?.color }}
                >
                  <div className="resource-card-top">
                    <button
                      className="resource-link-btn"
                      onClick={() => vid ? setActiveVideo(expanded ? null : r.id) : window.open(r.url, "_blank")}
                    >
                      {vid ? (expanded ? "▼ " : "▶ ") : ""}{r.title}
                    </button>
                    <a href={r.url} target="_blank" rel="noreferrer" className="ext-link" title="Open in YouTube">↗</a>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      className={`done-btn ${resourceDone[r.id] ? "done-active" : ""}`}
                      onClick={() => markResourceDone(r)}
                    >
                      {resourceDone[r.id] ? "✓ Done" : "Mark Done"}
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {expanded && vid && (
                      <motion.div
                        className="yt-embed-wrap"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <iframe
                          src={`https://www.youtube.com/embed/${vid}`}
                          title={r.title}
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span
                        key={s}
                        className={(stars[r.id] || 0) >= s ? "star on" : "star"}
                        onClick={() => rate(r.id, s)}
                      >★</span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {articles.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h3 className="section-title">📄 Articles</h3>
          <div className="resource-cards">
            {articles.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`resource-card ${resourceDone[r.id] ? "resource-done" : ""}`}
                style={{ "--c": course?.color }}
              >
                <div className="resource-card-top">
                  <a href={r.url} target="_blank" rel="noreferrer" className="resource-link">
                    {r.title}
                  </a>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className={`done-btn ${resourceDone[r.id] ? "done-active" : ""}`}
                    onClick={() => markResourceDone(r)}
                  >
                    {resourceDone[r.id] ? "✓ Done" : "Mark Done"}
                  </motion.button>
                </div>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={(stars[r.id] || 0) >= s ? "star on" : "star"}
                      onClick={() => rate(r.id, s)}
                    >★</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {resources.length === 0 && (
        <p className="muted" style={{ marginTop: 24 }}>No approved resources yet.</p>
      )}

      {recs.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h3 className="section-title">✨ Recommended for You</h3>
          <div className="resource-cards">
            {recs.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="resource-card rec-card"
              >
                <div className="resource-card-top">
                  <a href={r.url} target="_blank" rel="noreferrer" className="resource-link">
                    {r.title}
                  </a>
                  <span className="rec-score">⭐ {Number(r.score).toFixed(1)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 40 }}>
        <button className="suggest-toggle" onClick={() => { setShowSuggest(!showSuggest); setSuggestMsg(""); setSuggestErr(""); }}>
          {showSuggest ? "▲ Cancel" : "+ Suggest a Resource"}
        </button>
        {suggestMsg && <p className="success-msg" style={{ marginTop: 10 }}>{suggestMsg}</p>}
        <AnimatePresence>
          {showSuggest && (
            <motion.form
              className="suggest-form"
              onSubmit={submitSuggest}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <input
                placeholder="Title"
                value={suggest.title}
                onChange={(e) => setSuggest({ ...suggest, title: e.target.value })}
                required
              />
              <input
                placeholder="URL (https://...)"
                value={suggest.url}
                onChange={(e) => setSuggest({ ...suggest, url: e.target.value })}
                required
              />
              <select value={suggest.resource_type} onChange={(e) => setSuggest({ ...suggest, resource_type: e.target.value })}>
                <option value="video">Video</option>
                <option value="article">Article</option>
              </select>
              {suggestErr && <p className="error-msg">{suggestErr}</p>}
              <button type="submit" className="btn btn-primary">Submit for Review</button>
            </motion.form>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
