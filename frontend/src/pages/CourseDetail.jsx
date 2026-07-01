import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, AlertTriangle, Check, ArrowRight, Sparkles } from "lucide-react";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";
import CourseIcon from "../components/CourseIcon";

export default function CourseDetail() {
  const { courseId } = useParams();
  const cid = parseInt(courseId);
  const course = COURSES.find((c) => c.id === cid);
  const navigate = useNavigate();

  const [subtopics, setSubtopics] = useState([]);
  const [progress, setProgress] = useState({});
  const [gateModal, setGateModal] = useState(null); // { topic, prereqNames }
  const [courseQuizModal, setCourseQuizModal] = useState(null); // { questions, has_coding }
  const [courseComplete, setCourseComplete] = useState(false);
  const prevAllDone = useRef(false);

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

  // Detect when all topics just became complete → trigger course quiz
  useEffect(() => {
    if (subtopics.length === 0) return;
    const allDone = subtopics.every((t) => progress[t.id] === true);
    if (allDone && !prevAllDone.current && !courseComplete) {
      prevAllDone.current = true;
      api.get(`/topics/course/${cid}/quiz`)
        .then((r) => setCourseQuizModal({ questions: r.data.questions, has_coding: r.data.has_coding }))
        .catch(() => {});
    } else if (!allDone) {
      prevAllDone.current = false;
    }
  }, [progress, subtopics, cid, courseComplete]);

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
        <span className="course-icon-lg">
          <CourseIcon icon={course.icon} color={course.color} size={44} />
        </span>
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
                {done ? <Check size={14} /> : i + 1}
              </div>
              <div className="roadmap-body">
                <span className="roadmap-title">{topic.title.replace(/^[^:]+: /, "")}</span>
                <span className="roadmap-desc">{topic.description}</span>
                <div className="roadmap-meta">
                  {topic.resource_count > 0 && (
                    <span className="resource-count-badge">{topic.resource_count} resources</span>
                  )}
                  {hasUnmet && (
                    <span className="locked-badge">
                      <Lock size={11} style={{ display: "inline", marginRight: 3 }} />
                      Complete prerequisites first
                    </span>
                  )}
                </div>
              </div>
              <span className="roadmap-arrow">{done ? <Check size={15} /> : <ArrowRight size={15} />}</span>
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
              <h3>
                <AlertTriangle size={18} color="#f59e0b" style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Prerequisites Required
              </h3>
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

      <AnimatePresence>
        {courseComplete && (
          <motion.div
            className="all-done-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: 24 }}
          >
            <Sparkles size={16} style={{ display: "inline", marginRight: 6 }} />
            🎉 Congratulations! You've completed <strong>{course.title}</strong>!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {courseQuizModal && (
          <CourseQuizModal
            questions={courseQuizModal.questions}
            hasCoding={courseQuizModal.has_coding}
            courseTitle={course.title}
            onPass={() => { setCourseComplete(true); setCourseQuizModal(null); }}
            onClose={() => setCourseQuizModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Completion Quiz Modal
// ---------------------------------------------------------------------------
function CourseQuizModal({ questions, hasCoding, courseTitle, onPass, onClose }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);       // MCQ: index
  const [code, setCode] = useState("");                  // code: user's code
  const [revealed, setRevealed] = useState(false);
  const [codeResult, setCodeResult] = useState(null);   // { passed, feedback, results }
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState(0);                 // correct answers so far
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  const current = questions[step];
  const isLast = step === questions.length - 1;
  const isMcq = current?.type === "mcq";

  // Reset code editor when question changes
  useEffect(() => {
    setCode(current?.starter || "");
    setSelected(null);
    setRevealed(false);
    setCodeResult(null);
  }, [step]);

  const handleConfirmMcq = () => {
    if (selected === null) return;
    const correct = selected === current.answer;
    if (correct) setScore((s) => s + 1);
    setRevealed(true);
  };

  const handleCheckCode = async () => {
    if (!code.trim()) return;
    setChecking(true);
    try {
      const res = await api.post("/topics/course/quiz/check-code", {
        code,
        language: current.language || "python",
        test_cases: current.test_cases || [],
      });
      setCodeResult(res.data);
      if (res.data.passed) setScore((s) => s + 1);
      setRevealed(true);
    } catch {
      setCodeResult({ passed: false, feedback: "Could not evaluate — check your code.", results: [] });
      setRevealed(true);
    }
    setChecking(false);
  };

  const handleNext = () => {
    if (isLast) {
      const total = questions.length;
      const pct = Math.round((score / total) * 100);
      if (pct >= 50) setDone(true);
      else setFailed(true);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleRetry = () => {
    setStep(0);
    setSelected(null);
    setCode(questions[0]?.starter || "");
    setRevealed(false);
    setCodeResult(null);
    setScore(0);
    setDone(false);
    setFailed(false);
  };

  // ── Failed screen ──────────────────────────────────────────────────────────
  if (failed) {
    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    return (
      <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="modal-box" style={{ maxWidth: 480 }}
          initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>⚠️ Not quite ready yet</h3>
          <p style={{ margin: "12px 0 4px", fontSize: "1rem" }}>
            You scored <strong>{score}/{total} ({pct}%)</strong>.
          </p>
          <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 16 }}>
            You need at least <strong>50%</strong> to complete this course. Review the topics and try again!
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={handleRetry}>Try Again</button>
            <button className="btn" onClick={onClose} style={{ fontSize: 13 }}>Close — keep studying</button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Pass screen ────────────────────────────────────────────────────────────
  if (done) {
    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    return (
      <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="modal-box" style={{ maxWidth: 480 }}
          initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={20} color="#4f46e5" />
            {pct === 100 ? "Perfect! 🎉" : pct >= 80 ? "Excellent! 🎉" : "Well done! 🎉"}
          </h3>
          <p style={{ margin: "14px 0 6px", fontSize: "1.1rem", fontWeight: 600 }}>
            {score}/{total} correct ({pct}%)
          </p>
          <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 16 }}>
            You've demonstrated solid understanding of <strong>{courseTitle}</strong>. Course marked as complete!
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onPass}>
              <Check size={14} style={{ display: "inline", marginRight: 4 }} />
              Finish
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Question screen ────────────────────────────────────────────────────────
  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal-box" style={{ maxWidth: 580, maxHeight: "85vh", overflowY: "auto" }}
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} color="#4f46e5" /> Course Exam
          </h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: isMcq ? "#6366f1" : "#10b981", fontWeight: 600,
              background: isMcq ? "#eef2ff" : "#ecfdf5", padding: "2px 8px", borderRadius: 99 }}>
              {isMcq ? "Multiple Choice" : "Coding Challenge"}
            </span>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>{step + 1} / {questions.length}</span>
          </div>
        </div>

        <p style={{ margin: "14px 0 12px", fontWeight: 500, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {current.q}
        </p>

        {/* MCQ options */}
        {isMcq && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {current.options.map((opt, idx) => {
              let bg = "#f9fafb", border = "#e5e7eb", color = "#111827";
              if (revealed) {
                if (idx === current.answer)      { bg = "#d1fae5"; border = "#10b981"; color = "#065f46"; }
                else if (idx === selected)       { bg = "#fee2e2"; border = "#ef4444"; color = "#991b1b"; }
              } else if (idx === selected)       { bg = "#ede9fe"; border = "#4f46e5"; color = "#3730a3"; }
              return (
                <button key={idx} onClick={() => { if (!revealed) setSelected(idx); }}
                  style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8,
                    border: `2px solid ${border}`, background: bg, color,
                    cursor: revealed ? "default" : "pointer",
                    fontWeight: idx === selected ? 600 : 400, transition: "all 0.15s" }}>
                  <span style={{ marginRight: 8, fontWeight: 700 }}>{["A","B","C","D"][idx]}.</span>
                  {opt}
                  {revealed && idx === current.answer && " ✓"}
                  {revealed && idx === selected && idx !== current.answer && " ✗"}
                </button>
              );
            })}
          </div>
        )}

        {/* Code editor */}
        {!isMcq && (
          <div>
            <textarea
              value={code}
              onChange={(e) => { if (!revealed) setCode(e.target.value); }}
              spellCheck={false}
              style={{
                width: "100%", minHeight: 160, fontFamily: "monospace", fontSize: 13,
                padding: "10px 12px", borderRadius: 8, border: "2px solid #e5e7eb",
                background: revealed ? "#f9fafb" : "#fff", resize: "vertical",
                boxSizing: "border-box", lineHeight: 1.6,
                borderColor: revealed ? (codeResult?.passed ? "#10b981" : "#ef4444") : "#e5e7eb",
              }}
            />
            {/* Test case results */}
            {revealed && codeResult && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontWeight: 600, fontSize: 13,
                  color: codeResult.passed ? "#065f46" : "#991b1b", marginBottom: 6 }}>
                  {codeResult.passed ? "✓ All tests passed!" : "✗ Some tests failed"}
                </p>
                {codeResult.feedback && (
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>{codeResult.feedback}</p>
                )}
                {codeResult.results?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {codeResult.results.map((tc, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: "monospace",
                        padding: "4px 8px", borderRadius: 6,
                        background: tc.ok ? "#d1fae5" : "#fee2e2",
                        color: tc.ok ? "#065f46" : "#991b1b" }}>
                        {tc.ok ? "✓" : "✗"} Input: {JSON.stringify(tc.input)} → Expected: {JSON.stringify(tc.expected)}
                        {!tc.ok && tc.got !== undefined && <> | Got: {JSON.stringify(tc.got)}</>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Score progress bar */}
        <div style={{ marginTop: 16, height: 4, background: "#f3f4f6", borderRadius: 2 }}>
          <div style={{ height: "100%", borderRadius: 2, background: "#4f46e5",
            width: `${Math.round((score / questions.length) * 100)}%`, transition: "width 0.3s" }} />
        </div>
        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
          {score} correct so far — need {Math.ceil(questions.length * 0.5)} to pass
        </p>

        {/* Actions */}
        <div className="modal-actions" style={{ marginTop: 14 }}>
          {!revealed ? (
            isMcq ? (
              <button className="btn btn-primary" onClick={handleConfirmMcq} disabled={selected === null}>
                Confirm
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleCheckCode}
                disabled={checking || !code.trim()}
                style={{ minWidth: 120 }}>
                {checking ? "Checking…" : "Run & Check"}
              </button>
            )
          ) : (
            <button className="btn btn-primary" onClick={handleNext}>
              {isLast ? "See Results" : "Next →"}
            </button>
          )}
          <button className="btn" onClick={onClose} style={{ fontSize: 13 }}>
            Close — come back later
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
