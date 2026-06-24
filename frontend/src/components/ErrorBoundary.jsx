import { Component } from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>⚠️</div>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Link to="/" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
            ← Back to Home
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}
