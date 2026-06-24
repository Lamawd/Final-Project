import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <motion.div
        className="not-found-box"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="not-found-code">404</div>
        <h2>Page not found</h2>
        <p className="muted">That URL doesn't exist — maybe it was moved or mistyped.</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
          ← Back to Home
        </Link>
      </motion.div>
    </div>
  );
}
