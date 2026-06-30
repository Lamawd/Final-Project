import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Map, Target, BarChart2, Users,
  Play, FileText, Star, Film, ArrowRight, BookOpen,
  MessageSquare, Rocket,
} from "lucide-react";
import api from "../api/client";
import { COURSES, courseOf } from "../courses";
import CourseIcon from "../components/CourseIcon";

const TESTIMONIALS = [
  { name: "Đỗ Nam Khánh", role: "ICT Student", text: "The roadmap style makes it so clear what to learn next. I finished DSA in two weeks!", photo: "/friendA.jpeg" },
  { name: "Nguyễn Đức Thành", role: "BIT Student", text: "Love how every topic links to real videos and articles. No more searching around.", photo: "/friendC.jpeg" },
  { name: "Dương Tuấn Kiệt", role: "DS Student", text: "The recommendation engine actually works — it surfaced SQL topics I was missing.", photo: "/friendB.jpeg" },
];

const FEATURES = [
  { Icon: Map,       title: "Guided Roadmaps",      color: "#6366f1", desc: "Every course is a step-by-step path — no guesswork about what comes next." },
  { Icon: Target,    title: "Personalised Picks",   color: "#ec4899", desc: "Rate resources and Opic learns what you like, then recommends what's next." },
  { Icon: BarChart2, title: "Track Your Progress",  color: "#10b981", desc: "Tick off topics, watch your heatmap fill up, and see how far you've come." },
  { Icon: Users,     title: "Community Resources",  color: "#f59e0b", desc: "Submit videos and articles for others to benefit from — reviewed by admins." },
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
        <div className="home-hero-badge">
          <Rocket size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
          Your learning journey starts here
        </div>
        <h1>Learn smarter with <span className="hero-accent">Opic</span></h1>
        <p>Structured roadmaps, curated resources, and personalised recommendations — all in one place.</p>
        <Link to="/courses" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>
          Browse Courses <ArrowRight size={16} />
        </Link>
      </motion.div>

      {/* Continue learning strip */}
      {inProgress.length > 0 && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ marginBottom: 36 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>
            <Play size={16} className="section-title-icon" fill="currentColor" />
            Continue Learning
          </h3>
          <div className="continue-strip">
            {inProgress.map((c) => {
              const topics = topicsByCourse[c.id] || [];
              const done = topics.filter((t) => progress[t.id]).length;
              const pct = Math.round((done / topics.length) * 100);
              return (
                <Link key={c.id} to={`/courses/${c.id}`} className="continue-card" style={{ "--cc": c.color }}>
                  <span className="continue-icon">
                    <CourseIcon icon={c.icon} color={c.color} size={26} />
                  </span>
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
          <h3 className="section-title" style={{ marginBottom: 12 }}>
            <Star size={16} className="section-title-icon" fill="currentColor" />
            Picked for You
          </h3>
          <div className="picks-row">
            {picks.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="pick-card">
                <span className="pick-icon">
                  {p.url.includes("youtube")
                    ? <Play size={16} fill="currentColor" />
                    : <FileText size={16} />}
                </span>
                <span className="pick-title">{p.title}</span>
                <span className="pick-score">
                  <Star size={12} fill="currentColor" style={{ verticalAlign: "middle", marginRight: 2 }} />
                  {Number(p.score).toFixed(2)}
                </span>
              </a>
            ))}
          </div>
        </motion.section>
      )}

      {/* Weekly featured video */}
      {featured && (
        <motion.section className="feed-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>
            <Film size={16} className="section-title-icon" />
            Featured This Week
          </h3>
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
        <h3 className="section-title" style={{ marginBottom: 16 }}>
          <Star size={16} className="section-title-icon" fill="currentColor" />
          What Opic Does For You
        </h3>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} className="feature-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.07 }}>
              <div className="feature-icon" style={{ color: f.color, background: f.color + "18" }}>
                <f.Icon size={22} strokeWidth={1.8} />
              </div>
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
        <h3 className="section-title" style={{ marginBottom: 12 }}>
          <BookOpen size={16} className="section-title-icon" />
          Explore Courses
        </h3>
        <div className="course-teaser-row">
          {notStarted.slice(0, 3).map((c) => (
            <Link key={c.id} to={`/courses/${c.id}`} className="course-teaser-card" style={{ "--cc": c.color, "--cl": c.light }}>
              <span className="course-teaser-icon">
                <CourseIcon icon={c.icon} color={c.color} size={28} />
              </span>
              <span className="course-teaser-title">{c.title}</span>
              <ArrowRight size={15} className="course-teaser-arrow" />
            </Link>
          ))}
          <Link to="/courses" className="course-teaser-card course-teaser-more">
            View all courses <ArrowRight size={14} style={{ display: "inline", verticalAlign: "middle" }} />
          </Link>
        </div>
      </motion.section>

      {/* Testimonials */}
      <motion.section className="feed-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>
          <MessageSquare size={16} className="section-title-icon" />
          What Learners Say
        </h3>
        <div className="testimonials-row">
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={t.name} className="testimonial-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.08 }}>
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">
                  {t.photo
                    ? <img src={t.photo} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    : <span>{t.name[0]}</span>}
                </div>
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
