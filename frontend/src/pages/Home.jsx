import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";

const TESTIMONIALS = [
  { name: "Amir R.", role: "CS Student", text: "The roadmap style makes it so clear what to learn next. I finished DSA in two weeks!", avatar: "A" },
  { name: "Priya S.", role: "Self-taught Dev", text: "Love how every topic links to real videos and articles. No more searching around.", avatar: "P" },
  { name: "Jake T.", role: "Bootcamp Grad", text: "The recommendation engine actually works — it surfaced SQL topics I was missing.", avatar: "J" },
];

const FEATURES = [
  { icon: "🗺️", title: "Guided Roadmaps", desc: "Every course is a step-by-step path — no guesswork about what comes next." },
  { icon: "🎯", title: "Personalised Picks", desc: "Rate resources and Opic learns what you like, then recommends what's next." },
  { icon: "📊", title: "Track Your Progress", desc: "Tick off topics, watch your heatmap fill up, and see how far you've come." },
  { icon: "🤝", title: "Community Resources", desc: "Submit videos and articles for others to benefit from — reviewed by admins." },
];

function ytId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return u.searchParams.get("v");
  } catch {}
  return null;
}

export default function Home() {
  const [progress, setProgress]             = useState({});
  const [topicsByCourse, setTopicsByCourse] = useState({});
  const [feed, setFeed]                     = useState(null);

  useEffect(() => {
    api.get("/topics/").then((r) => {
      const map = {};
      r.data.forEach((t) => { const cid = courseOf(t); if (!map[cid]) map[cid] = []; map[cid].push(t); });
      setTopicsByCourse(map);
    });
    api.get("/topics/progress/me").then((r) => {
      const map = {};
      r.data.forEach((p) => { map[p.topic_id] = p.completed; });
      setProgress(map);
    }).catch(() => {});
    api.get("/recommend/home").then((r) => setFeed(r.data)).catch(() => {});
  }, []);

  const inProgress = COURSES.filter((c) => {
    const topics = topicsByCourse[c.id] || [];
    const done = topics.filter((t) => progress[t.id]).length;
    return done > 0 && done < topics.length;
  });
  const notStarted = COURSES.filter((c) => {
    const topics = topicsByCourse[c.id] || [];
    return topics.filter((t) => progress[t.id]).length === 0;
  });

  const featured = feed?.featured;
  const picks    = feed?.picks || [];
  const vid      = featured ? ytId(featured.url) : null;

  return (
    <div className="page">
      {/* Hero */}
      <motion.div className="home-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="home-hero-badge">🚀 Your learning journey starts here</div>
        <h1>Learn smarter with <span className="hero-accent">Opic</span></h1>
        <p>Structured roadmaps, curated resources, and personalised recommendations — all in one place.</p>
        <Link to="/courses" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>
          Browse Courses →
        </Link>
      </motion.div>

      {/* Continue learning strip */}
      {inProgress.length > 0 && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ marginBottom: 36 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>▶ Continue Learning</h3>
          <div className="continue-strip">
            {inProgress.map((c) => {
              const topics = topicsByCourse[c.id] || [];
              const done = topics.filter((t) => progress[t.id]).length;
              const pct = Math.round((done / topics.length) * 100);
              return (
                <Link key={c.id} to={`/courses/${c.id}`} className="continue-card" style={{ "--cc": c.color }}>
                  <span className="continue-icon">{c.icon}</span>
                  <div className="continue-body">
                    <span className="continue-title">{c.title}</span>
                    <div className="progress-bar-wrap" style={{ marginTop: 6 }}>
                      <div className="progress-bar" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                    <span className="progress-label">{done}/{topics.length} done</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Personalised picks */}
      {picks.length > 0 && (
        <motion.section className="feed-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>✨ Picked for You</h3>
          <div className="picks-row">
            {picks.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="pick-card">
                <span className="pick-icon">{p.url.includes("youtube") ? "📹" : "📄"}</span>
                <span className="pick-title">{p.title}</span>
                <span className="pick-score">⭐ {Number(p.score).toFixed(2)}</span>
              </a>
            ))}
          </div>
        </motion.section>
      )}

      {/* Weekly featured video — rotates every Monday */}
      {featured && (
        <motion.section className="feed-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>🎬 Featured This Week</h3>
          <div className="featured-video-wrap">
            {vid
              ? <iframe src={`https://www.youtube.com/embed/${vid}`} title={featured.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              : <div style={{ padding: "20px 18px" }}><a href={featured.url} target="_blank" rel="noreferrer">{featured.title} ↗</a></div>
            }
            <div className="featured-video-meta">
              <span className="featured-label">{featured.title}</span>
              <span className="muted" style={{ fontSize: "0.82rem" }}>{featured.topic}</span>
            </div>
          </div>
        </motion.section>
      )}

      {/* What Opic does */}
      <motion.section className="feed-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>✨ What Opic Does For You</h3>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} className="feature-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.07 }}>
              <div className="feature-icon">{f.icon}</div>
              <div>
                <strong>{f.title}</strong>
                <p className="muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Explore courses teaser */}
      <motion.section className="feed-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>📚 Explore Courses</h3>
        <div className="course-teaser-row">
          {notStarted.slice(0, 3).map((c) => (
            <Link key={c.id} to={`/courses/${c.id}`} className="course-teaser-card" style={{ "--cc": c.color, "--cl": c.light }}>
              <span className="course-teaser-icon">{c.icon}</span>
              <span className="course-teaser-title">{c.title}</span>
              <span className="course-teaser-arrow">→</span>
            </Link>
          ))}
          <Link to="/courses" className="course-teaser-card course-teaser-more">View all courses →</Link>
        </div>
      </motion.section>

      {/* Testimonials */}
      <motion.section className="feed-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>💬 What Learners Say</h3>
        <div className="testimonials-row">
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={t.name} className="testimonial-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.08 }}>
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.avatar}</div>
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>{t.name}</strong>
                  <span className="muted" style={{ fontSize: "0.8rem", display: "block" }}>{t.role}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
