import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, FileText, ChevronDown, ChevronRight, ExternalLink,
  Check, Star, Sparkles, Plus, ChevronUp, AlertTriangle,
} from "lucide-react";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";
import CourseIcon from "../components/CourseIcon";

function ytId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch") && u.searchParams.get("v")) return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
    }
  } catch {}
  return null;
}

export default function TopicDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const topicId = parseInt(id);

  const [topic, setTopic]               = useState(null);
  const [resources, setResources]       = useState([]);
  const [recs, setRecs]                 = useState([]);
  const [stars, setStars]               = useState({});
  const [overallRating, setOverallRating] = useState({});
  const [resourceDone, setResourceDone] = useState({});
  const [topicCompleted, setTopicCompleted] = useState(false);
  const [allDone, setAllDone]           = useState(false);
  const [activeVideo, setActiveVideo]   = useState(null);
  const [showSuggest, setShowSuggest]   = useState(false);
  const [suggest, setSuggest]           = useState({ title: "", url: "", resource_type: "video" });
  const [suggestMsg, setSuggestMsg]     = useState("");
  const [suggestErr, setSuggestErr]     = useState("");
  const [ratingModal, setRatingModal]   = useState(null);
  const [quizModal, setQuizModal]       = useState(null);   // {questions, pendingComplete}

  const course = topic ? COURSES.find((c) => c.id === courseOf(topic)) : null;

  useEffect(() => {
    api.get(`/topics/${id}`).then((r) => setTopic(r.data));
    api.get(`/resources/topic/${id}`).then((r) => {
      setResources(r.data);
      const map = {};
      r.data.forEach((res) => { map[res.id] = { avg: res.avg_rating, count: res.rating_count }; });
      setOverallRating(map);
    });
    api.get(`/recommend/topic/${id}`).then((r) => setRecs(r.data)).catch(() => {});
    api.get("/topics/progress/me").then((r) => {
      const found = r.data.find((p) => p.topic_id === topicId);
      if (found) setTopicCompleted(found.completed);
    }).catch(() => {});
  }, [id]);

  const pageStart = useRef(null);
  const pageTime  = useRef(0);

  useEffect(() => {
    if (resources.length === 0) return;
    pageStart.current = Date.now();
    const pause  = () => { if (pageStart.current) { pageTime.current += Date.now() - pageStart.current; pageStart.current = null; } };
    const resume = () => { if (!pageStart.current) pageStart.current = Date.now(); };
    const flush  = () => {
      pause();
      const secs = Math.round(pageTime.current / 1000);
      if (secs > 0) {
        const rid = resources[0]?.id;
        if (rid) api.post(`/resources/${rid}/engage`, { watch_completion: 0, revisit_count: 0, completed: !!resourceDone[rid], time_spent: secs });
      }
    };
    document.addEventListener("visibilitychange", () => document.hidden ? pause() : resume());
    window.addEventListener("beforeunload", flush);
    return () => { flush(); window.removeEventListener("beforeunload", flush); };
  }, [resources]);

  useEffect(() => {
    if (resources.length > 0 && resources.every((r) => resourceDone[r.id])) {
      setAllDone(true);
    }
  }, [resourceDone, resources]);

  const stopTimer = (_rid) => {};
  const getTime   = (_rid) => 0;

  const markResourceDone = async (resource) => {
    const next = !resourceDone[resource.id];
    stopTimer(resource.id);
    await api.post(`/resources/${resource.id}/engage`, {
      watch_completion: next ? 1.0 : 0.0,
      revisit_count: 0,
      completed: next,
      time_spent: getTime(resource.id),
    });
    setResourceDone((prev) => ({ ...prev, [resource.id]: next }));
  };

  const rate = async (resource_id, s, reason = null) => {
    const res = await api.post(`/resources/${resource_id}/rate`, { stars: s, reason });
    setStars((prev) => ({ ...prev, [resource_id]: s }));
    setOverallRating((prev) => ({ ...prev, [resource_id]: { avg: res.data.avg_rating, count: res.data.rating_count } }));
  };

  const handleStarClick = (resource_id, s) => {
    if (s <= 2) setRatingModal({ resource_id, stars: s });
    else rate(resource_id, s);
  };

  const submitSuggest = async (e) => {
    e.preventDefault();
    setSuggestErr("");
    try {
      const u = new URL(suggest.url);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
    } catch {
      setSuggestErr("URL must start with https:// or http://");
      return;
    }
    try {
      await api.post("/resources/", { ...suggest, topic_id: topicId });
      setSuggestMsg("Submitted! An admin will review it shortly.");
      setSuggest({ title: "", url: "", resource_type: "video" });
      setShowSuggest(false);
    } catch (err) {
      setSuggestErr(err.response?.data?.detail || "Submission failed");
    }
  };

  const markTopicComplete = async () => {
    const next = !topicCompleted;
    if (next) {
      try {
        const res = await api.get(`/topics/${id}/quiz`);
        setQuizModal({ questions: res.data.questions });
      } catch {
        // Gemini totally unreachable — show fallback modal anyway
        setQuizModal({ questions: [
          { q: `How well did you understand ${topic?.title}?`,
            options: ["Very well", "Mostly", "A little", "Not really"], answer: 0 },
        ]});
      }
    } else {
      await api.post(`/topics/${id}/progress`, null, { params: { completed: false } });
      setTopicCompleted(false);
    }
  };

  const finishQuiz = async () => {
    await api.post(`/topics/${id}/progress`, null, { params: { completed: true } });
    setTopicCompleted(true);
    setQuizModal(null);
    if (course) setTimeout(() => navigate(`/courses/${course.id}`), 800);
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
              <CourseIcon icon={course.icon} color={course.color} size={16} />
              <span style={{ marginLeft: 5 }}>{course.title}</span>
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
          {topicCompleted
            ? <><Check size={15} style={{ display: "inline", marginRight: 4 }} />Completed</>
            : "Mark Complete"}
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
            <Sparkles size={16} style={{ display: "inline", marginRight: 6 }} />
            You've finished all resources! Mark this topic as complete.
          </motion.div>
        )}
      </AnimatePresence>

      {videos.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h3 className="section-title">
            <Play size={16} className="section-title-icon" fill="currentColor" />
            Videos
          </h3>
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
                      {vid
                        ? expanded
                          ? <ChevronDown size={14} style={{ display: "inline", marginRight: 4 }} />
                          : <ChevronRight size={14} style={{ display: "inline", marginRight: 4 }} />
                        : null}
                      {r.title}
                    </button>
                    <a href={r.url} target="_blank" rel="noreferrer" className="ext-link" title="Open in YouTube">
                      <ExternalLink size={14} />
                    </a>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      className={`done-btn ${resourceDone[r.id] ? "done-active" : ""}`}
                      onClick={() => markResourceDone(r)}
                    >
                      {resourceDone[r.id]
                        ? <><Check size={13} style={{ display: "inline", marginRight: 3 }} />Done</>
                        : "Mark Done"}
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
                        onClick={() => handleStarClick(r.id, s)}
                      >★</span>
                    ))}
                    {overallRating[r.id]?.count > 0 && (
                      <span className="overall-rating">
                        {overallRating[r.id].avg}★ ({overallRating[r.id].count} {overallRating[r.id].count === 1 ? "review" : "reviews"})
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {articles.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h3 className="section-title">
            <FileText size={16} className="section-title-icon" />
            Articles
          </h3>
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
                    {resourceDone[r.id]
                      ? <><Check size={13} style={{ display: "inline", marginRight: 3 }} />Done</>
                      : "Mark Done"}
                  </motion.button>
                </div>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={(stars[r.id] || 0) >= s ? "star on" : "star"}
                      onClick={() => handleStarClick(r.id, s)}
                    >★</span>
                  ))}
                  {overallRating[r.id]?.count > 0 && (
                    <span className="overall-rating">
                      {overallRating[r.id].avg}★ ({overallRating[r.id].count} {overallRating[r.id].count === 1 ? "review" : "reviews"})
                    </span>
                  )}
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
          <h3 className="section-title">
            <Sparkles size={16} className="section-title-icon" />
            Suggested for You
          </h3>
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
                  <span className="rec-score">
                    <Star size={12} fill="currentColor" style={{ verticalAlign: "middle", marginRight: 2 }} />
                    {Number(r.score).toFixed(2)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 40 }}>
        <button
          className="suggest-toggle"
          onClick={() => { setShowSuggest(!showSuggest); setSuggestMsg(""); setSuggestErr(""); }}
        >
          {showSuggest
            ? <><ChevronUp size={14} style={{ display: "inline", marginRight: 4 }} />Cancel</>
            : <><Plus size={14} style={{ display: "inline", marginRight: 4 }} />Suggest a Resource</>}
        </button>
        {suggestMsg && (
          <p className="success-msg" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} /> {suggestMsg}
          </p>
        )}
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
              <select
                value={suggest.resource_type}
                onChange={(e) => setSuggest({ ...suggest, resource_type: e.target.value })}
              >
                <option value="video">Video</option>
                <option value="article">Article</option>
              </select>
              {suggestErr && <p className="error-msg">{suggestErr}</p>}
              <button type="submit" className="btn btn-primary">Submit for Review</button>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {ratingModal && (
          <LowRatingModal
            stars={ratingModal.stars}
            onSubmit={(reason) => { rate(ratingModal.resource_id, ratingModal.stars, reason); setRatingModal(null); }}
            onSkip={() => { rate(ratingModal.resource_id, ratingModal.stars); setRatingModal(null); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quizModal && (
          <QuizModal
            questions={quizModal.questions}
            topicTitle={topic.title}
            onFinish={finishQuiz}
            onSkip={finishQuiz}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LowRatingModal({ stars, onSubmit, onSkip }) {
  const [reason, setReason] = useState("");
  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal-box"
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
      >
        <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={18} color="#f59e0b" />
          Low rating ({stars} {stars === 1 ? "star" : "stars"})
        </h3>
        <p style={{ margin: "10px 0" }}>Mind telling us why? <span className="muted">(optional)</span></p>
        <textarea
          className="reason-input"
          placeholder="e.g. Hard to follow, outdated content, poor audio…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onSubmit(reason || null)}>Submit</button>
          <button className="btn" onClick={onSkip}>Skip</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuizModal({ questions, topicTitle, onFinish, onSkip }) {
  const [step, setStep]       = useState(0);
  const [selected, setSelected] = useState(null);   // index of chosen option
  const [revealed, setRevealed] = useState(false);  // show correct/wrong feedback
  const [score, setScore]     = useState(0);
  const [done, setDone]       = useState(false);

  const current = questions[step];
  const isLast  = step === questions.length - 1;

  const handleSelect = (idx) => {
    if (revealed) return;
    setSelected(idx);
  };

  const handleConfirm = () => {
    if (selected === null) return;
    const correct = selected === current.answer;
    setRevealed(true);
    if (correct) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (isLast) { setDone(true); return; }
    setStep((s) => s + 1);
    setSelected(null);
    setRevealed(false);
  };

  if (done) {
    const total = questions.length;
    const pct   = Math.round((score / total) * 100);
    return (
      <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="modal-box" initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={20} color="#4f46e5" /> Quiz Result
          </h3>
          <p style={{ margin: "14px 0 6px", fontSize: "1.1rem", fontWeight: 600 }}>
            {score} / {total} correct ({pct}%)
          </p>
          <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 16 }}>
            {pct === 100 ? "Perfect! Great understanding 🎉" :
             pct >= 60  ? "Good job! Keep it up 👍" :
                          "No worries — reviewing again helps 📖"}
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onFinish}>
              <Check size={14} style={{ display: "inline", marginRight: 4 }} />
              Mark as Complete
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal-box" style={{ maxWidth: 500 }} initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <Sparkles size={18} color="#4f46e5" /> Quick Quiz
          </h3>
          <span style={{ fontSize: 13, color: "#9ca3af" }}>{step + 1} / {questions.length}</span>
        </div>

        <p style={{ margin: "14px 0 12px", fontWeight: 500, lineHeight: 1.5 }}>{current.q}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {current.options.map((opt, idx) => {
            let bg = "#f9fafb", border = "#e5e7eb", color = "#111827";
            if (revealed) {
              if (idx === current.answer)        { bg = "#d1fae5"; border = "#10b981"; color = "#065f46"; }
              else if (idx === selected)         { bg = "#fee2e2"; border = "#ef4444"; color = "#991b1b"; }
            } else if (idx === selected)         { bg = "#ede9fe"; border = "#4f46e5"; color = "#3730a3"; }
            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                style={{
                  textAlign: "left", padding: "10px 14px", borderRadius: 8,
                  border: `2px solid ${border}`, background: bg, color,
                  cursor: revealed ? "default" : "pointer",
                  fontWeight: idx === selected ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ marginRight: 8, fontWeight: 700 }}>
                  {["A", "B", "C", "D"][idx]}.
                </span>
                {opt}
                {revealed && idx === current.answer && " ✓"}
                {revealed && idx === selected && idx !== current.answer && " ✗"}
              </button>
            );
          })}
        </div>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          {!revealed ? (
            <button className="btn btn-primary" onClick={handleConfirm} disabled={selected === null}>
              Confirm
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleNext}>
              {isLast ? "See Results" : "Next →"}
            </button>
          )}
          <button className="btn" onClick={onSkip} style={{ fontSize: 13 }}>Skip quiz</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
