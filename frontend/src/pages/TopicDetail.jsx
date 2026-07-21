import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, FileText, ChevronDown, ChevronRight, ExternalLink,
  Check, Star, Sparkles, Plus, ChevronUp, AlertTriangle,
  MessageSquare, Trash2, FileType,
} from "lucide-react";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";
import CourseIcon from "../components/CourseIcon";
import { useAuth } from "../context/AuthContext";

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
  const { user } = useAuth();

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
  const [quizModal, setQuizModal]       = useState(null);

  // Reviews & comments: { [resource_id]: { reviews: [], comments: [], showReviews: false, showComments: false, newComment: "" } }
  const [reviewData, setReviewData]     = useState({});

  const course = topic ? COURSES.find((c) => c.id === courseOf(topic)) : null;

  // ── Per-resource time tracking ──────────────────────────────────────────
  // Tracks time spent on the page per resource (approximated by page-open time)
  const resourceTimers = useRef({});  // { [rid]: { start: Date, accumulated: ms } }

  const startTimer = useCallback((rid) => {
    if (!resourceTimers.current[rid]) {
      resourceTimers.current[rid] = { start: Date.now(), accumulated: 0 };
    } else if (!resourceTimers.current[rid].start) {
      resourceTimers.current[rid].start = Date.now();
    }
  }, []);

  const pauseTimer = useCallback((rid) => {
    const t = resourceTimers.current[rid];
    if (t?.start) {
      t.accumulated += Date.now() - t.start;
      t.start = null;
    }
  }, []);

  const getTimeSecs = useCallback((rid) => {
    const t = resourceTimers.current[rid];
    if (!t) return 0;
    const extra = t.start ? Date.now() - t.start : 0;
    return Math.round((t.accumulated + extra) / 1000);
  }, []);

  // ── YouTube watch-completion tracking via IFrame API ───────────────────
  // ytPlayers: { [rid]: YT.Player }  ytProgress: { [rid]: float 0-1 }
  const ytPlayers  = useRef({});
  const ytProgress = useRef({});   // last known completion ratio
  const ytPollRef  = useRef(null); // interval handle

  // Load the YouTube IFrame API script once
  useEffect(() => {
    if (window.YT) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  }, []);

  // Poll all active YT players every 3 s to record watch progress
  useEffect(() => {
    ytPollRef.current = setInterval(() => {
      Object.entries(ytPlayers.current).forEach(([rid, player]) => {
        try {
          const dur = player.getDuration?.();
          const cur = player.getCurrentTime?.();
          if (dur && dur > 0) {
            ytProgress.current[rid] = Math.min(cur / dur, 1.0);
          }
        } catch {}
      });
    }, 3000);
    return () => clearInterval(ytPollRef.current);
  }, []);

  // Flush engagement for a resource (called on pause/stop/mark-done/unload)
  const flushEngage = useCallback((rid, completed = null) => {
    const secs = getTimeSecs(rid);
    const wc   = ytProgress.current[rid] ?? (resourceDone[rid] ? 1.0 : 0.0);
    api.post(`/resources/${rid}/engage`, {
      watch_completion: completed === false ? wc : (completed ? Math.max(wc, 0.9) : wc),
      revisit_count: 0,
      completed: completed ?? !!resourceDone[rid],
      time_spent: secs,
    }).catch(() => {});
  }, [getTimeSecs, resourceDone]);

  const initReviewData = (resId) => {
    setReviewData((prev) => prev[resId] ? prev : {
      ...prev,
      [resId]: { reviews: [], comments: [], showReviews: false, showComments: false, newComment: "", submitting: false }
    });
  };

  const toggleReviews = async (resId) => {
    initReviewData(resId);
    const current = reviewData[resId];
    if (!current?.showReviews && (!current?.reviews?.length)) {
      const res = await api.get(`/resources/${resId}/reviews`).catch(() => ({ data: [] }));
      setReviewData((prev) => ({ ...prev, [resId]: { ...prev[resId], reviews: res.data, showReviews: true } }));
    } else {
      setReviewData((prev) => ({ ...prev, [resId]: { ...prev[resId], showReviews: !prev[resId].showReviews } }));
    }
  };

  const toggleComments = async (resId) => {
    initReviewData(resId);
    const current = reviewData[resId];
    if (!current?.showComments && (!current?.comments?.length)) {
      const res = await api.get(`/resources/${resId}/comments`).catch(() => ({ data: [] }));
      setReviewData((prev) => ({ ...prev, [resId]: { ...prev[resId], comments: res.data, showComments: true } }));
    } else {
      setReviewData((prev) => ({ ...prev, [resId]: { ...prev[resId], showComments: !prev[resId].showComments } }));
    }
  };

  const submitComment = async (resId) => {
    const body = reviewData[resId]?.newComment?.trim();
    if (!body) return;
    setReviewData((prev) => ({ ...prev, [resId]: { ...prev[resId], submitting: true } }));
    try {
      const res = await api.post(`/resources/${resId}/comments`, { body });
      setReviewData((prev) => ({
        ...prev,
        [resId]: { ...prev[resId], comments: [res.data, ...(prev[resId].comments || [])], newComment: "", submitting: false }
      }));
    } catch {
      setReviewData((prev) => ({ ...prev, [resId]: { ...prev[resId], submitting: false } }));
    }
  };

  const deleteComment = async (resId, commentId) => {
    await api.delete(`/resources/${resId}/comments/${commentId}`).catch(() => {});
    setReviewData((prev) => ({
      ...prev,
      [resId]: { ...prev[resId], comments: prev[resId].comments.filter((c) => c.id !== commentId) }
    }));
  };

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

  // Start timers for all resources when they load; flush on page leave
  useEffect(() => {
    if (resources.length === 0) return;
    resources.forEach((r) => startTimer(r.id));

    const handleVisibility = () => {
      if (document.hidden) resources.forEach((r) => pauseTimer(r.id));
      else                  resources.forEach((r) => startTimer(r.id));
    };
    const handleUnload = () => resources.forEach((r) => flushEngage(r.id));

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      handleUnload();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [resources]);

  useEffect(() => {
    if (resources.length > 0 && resources.every((r) => resourceDone[r.id])) {
      setAllDone(true);
    }
  }, [resourceDone, resources]);

  const markResourceDone = async (resource) => {
    const next = !resourceDone[resource.id];
    flushEngage(resource.id, next);
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
                        <YouTubePlayer
                          videoId={vid}
                          resourceId={r.id}
                          ytPlayers={ytPlayers}
                          ytProgress={ytProgress}
                          onProgress={(pct) => {
                            // Auto-mark done when user watches ≥80%
                            if (pct >= 0.8 && !resourceDone[r.id]) {
                              flushEngage(r.id, true);
                              setResourceDone((prev) => ({ ...prev, [r.id]: true }));
                            }
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <ResourceActions r={r} stars={stars} overallRating={overallRating}
                    handleStarClick={handleStarClick} reviewData={reviewData}
                    toggleReviews={toggleReviews} toggleComments={toggleComments}
                    submitComment={submitComment} deleteComment={deleteComment}
                    setReviewData={setReviewData} user={user} />
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
                <ResourceActions r={r} stars={stars} overallRating={overallRating}
                  handleStarClick={handleStarClick} reviewData={reviewData}
                  toggleReviews={toggleReviews} toggleComments={toggleComments}
                  submitComment={submitComment} deleteComment={deleteComment}
                  setReviewData={setReviewData} user={user} />
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
                <option value="pdf">PDF</option>
                <option value="doc">Document (Word/Doc)</option>
                <option value="other">Other</option>
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
            onGoBack={() => setQuizModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── YouTube IFrame API player component ─────────────────────────────────────
// Mounts a div that the YT IFrame API turns into a real player.
// Polls getCurrentTime/getDuration to track watch_completion accurately.
function YouTubePlayer({ videoId, resourceId, ytPlayers, ytProgress, onProgress }) {
  const containerRef = useRef(null);
  const playerRef    = useRef(null);
  const pollRef      = useRef(null);

  useEffect(() => {
    const mountPlayer = () => {
      if (!containerRef.current || !window.YT?.Player) return;
      const divId = `yt-player-${resourceId}`;
      if (!document.getElementById(divId)) return;

      playerRef.current = new window.YT.Player(divId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            ytPlayers.current[resourceId] = playerRef.current;
          },
          onStateChange: (e) => {
            // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0
            if (e.data === 1) {
              // Started playing — begin polling
              pollRef.current = setInterval(() => {
                try {
                  const dur = playerRef.current.getDuration();
                  const cur = playerRef.current.getCurrentTime();
                  if (dur > 0) {
                    const pct = Math.min(cur / dur, 1.0);
                    ytProgress.current[resourceId] = pct;
                    onProgress(pct);
                  }
                } catch {}
              }, 3000);
            } else {
              // Paused or ended — stop polling
              clearInterval(pollRef.current);
              if (e.data === 0) {
                // Video ended — mark as fully watched
                ytProgress.current[resourceId] = 1.0;
                onProgress(1.0);
              }
            }
          },
        },
      });
    };

    // YT API may not be ready yet — wait for onYouTubeIframeAPIReady
    if (window.YT?.Player) {
      mountPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        mountPlayer();
      };
    }

    return () => {
      clearInterval(pollRef.current);
      try { playerRef.current?.destroy(); } catch {}
      delete ytPlayers.current[resourceId];
    };
  }, [videoId, resourceId]);

  return (
    <div ref={containerRef} style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
      <div
        id={`yt-player-${resourceId}`}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}

function ResourceActions({ r, stars, overallRating, handleStarClick, reviewData, toggleReviews,
  toggleComments, submitComment, deleteComment, setReviewData, user }) {
  const rd = reviewData[r.id] || {};
  return (
    <div>
      <div className="stars" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={(stars[r.id] || 0) >= s ? "star on" : "star"}
            onClick={() => handleStarClick(r.id, s)}>★</span>
        ))}
        {overallRating[r.id]?.count > 0 && (
          <button className="btn" style={{ fontSize: 12, padding: "2px 8px", marginLeft: 4 }}
            onClick={() => toggleReviews(r.id)}>
            {overallRating[r.id].avg}★ ({overallRating[r.id].count}) — see reviews
          </button>
        )}
        <button className="btn" style={{ fontSize: 12, padding: "2px 8px", display: "flex", alignItems: "center", gap: 3 }}
          onClick={() => toggleComments(r.id)}>
          <MessageSquare size={12} />
          {r.comment_count > 0 ? `${r.comment_count} comment${r.comment_count !== 1 ? "s" : ""}` : "Comment"}
        </button>
      </div>

      {/* Reviews panel */}
      <AnimatePresence>
        {rd.showReviews && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {rd.reviews?.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No reviews yet.</p>}
              {rd.reviews?.map((rv) => (
                <div key={rv.user_id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                  {rv.avatar_url
                    ? <img src={rv.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#6b7280" }}>{rv.username?.[0]?.toUpperCase()}</div>
                  }
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{rv.username}</span>
                    <span style={{ marginLeft: 6, color: "#f59e0b", fontSize: 13 }}>{"★".repeat(rv.stars)}{"☆".repeat(5 - rv.stars)}</span>
                    {rv.reason && <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>{rv.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments panel */}
      <AnimatePresence>
        {rd.showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: 8 }}>
              {/* Comment input */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input
                  placeholder="Write a comment…"
                  value={rd.newComment || ""}
                  onChange={(e) => setReviewData((prev) => ({ ...prev, [r.id]: { ...prev[r.id], newComment: e.target.value } }))}
                  onKeyDown={(e) => e.key === "Enter" && submitComment(r.id)}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
                <button className="btn btn-primary" style={{ fontSize: 12, padding: "4px 12px" }}
                  disabled={rd.submitting || !rd.newComment?.trim()}
                  onClick={() => submitComment(r.id)}>
                  Post
                </button>
              </div>
              {rd.comments?.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No comments yet. Be the first!</p>}
              {rd.comments?.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                  {c.avatar_url
                    ? <img src={c.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#6b7280" }}>{c.username?.[0]?.toUpperCase()}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.username}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>{c.created_at}</span>
                    <p style={{ margin: "2px 0 0", fontSize: 13 }}>{c.body}</p>
                  </div>
                  {(user?.id === c.user_id || user?.is_admin) && (
                    <button onClick={() => deleteComment(r.id, c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
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

function QuizModal({ questions, topicTitle, onFinish, onGoBack }) {
  const [step, setStep]       = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [wrongs, setWrongs]   = useState(0);       // count of wrong answers
  const [score, setScore]     = useState(0);
  const [done, setDone]       = useState(false);
  const [retrying, setRetrying] = useState(false);  // showing retry screen

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
    else         setWrongs((w) => w + 1);
  };

  const handleNext = () => {
    if (isLast) {
      // Check if too many wrong — show retry screen
      const newWrongs = wrongs + (revealed && selected !== current.answer ? 0 : 0); // already counted
      if (wrongs >= 3) { setRetrying(true); return; }
      setDone(true);
      return;
    }
    setStep((s) => s + 1);
    setSelected(null);
    setRevealed(false);
  };

  // After last question revealed, check wrongs before moving to done
  const handleFinish = () => {
    if (wrongs >= 3) { setRetrying(true); }
    else             { setDone(true); }
  };

  const handleRetry = () => {
    setStep(0);
    setSelected(null);
    setRevealed(false);
    setWrongs(0);
    setScore(0);
    setDone(false);
    setRetrying(false);
  };

  // Retry screen
  if (retrying) {
    return (
      <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="modal-box" initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            ⚠️ Not quite there yet
          </h3>
          <p style={{ margin: "12px 0 6px", fontSize: "1rem" }}>
            You got <strong>{wrongs} question{wrongs !== 1 ? "s" : ""} wrong</strong> (3 or more means a retry).
          </p>
          <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 16 }}>
            Review the topic materials and try again — you can do it! 💪
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={handleRetry}>
              Try Again
            </button>
            <button className="btn" onClick={onGoBack} style={{ fontSize: 13 }}>Go Back</button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Done screen
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
            {pct === 100 ? "Perfect score! Outstanding 🎉" :
             pct >= 80   ? "Great job! Solid understanding 👍" :
             pct >= 60   ? "Good effort! Keep reviewing 📖" :
                           "Keep studying — you'll get there! 💪"}
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {wrongs > 0 && (
              <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                {wrongs} wrong {wrongs >= 2 ? "⚠️" : ""}
              </span>
            )}
            <span style={{ fontSize: 13, color: "#9ca3af" }}>{step + 1} / {questions.length}</span>
          </div>
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

        {revealed && wrongs >= 2 && !isLast && (
          <p style={{ marginTop: 10, fontSize: 13, color: "#f59e0b", fontWeight: 500 }}>
            ⚠️ One more wrong answer and you'll need to retry!
          </p>
        )}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          {!revealed ? (
            <button className="btn btn-primary" onClick={handleConfirm} disabled={selected === null}>
              Confirm
            </button>
          ) : (
            <button className="btn btn-primary" onClick={isLast ? handleFinish : handleNext}>
              {isLast ? "See Results" : "Next →"}
            </button>
          )}
          <button className="btn" onClick={onGoBack} style={{ fontSize: 13 }}>Go Back</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
