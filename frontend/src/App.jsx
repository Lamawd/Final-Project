import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import CourseDetail from "./pages/CourseDetail";
import TopicDetail from "./pages/TopicDetail";
import AdminReview from "./pages/AdminReview";
import Onboarding from "./pages/Onboarding";
import SuggestPage from "./pages/SuggestPage";
import Progress from "./pages/Progress";
import UserProfile from "./pages/UserProfile";
import Courses from "./pages/Courses";
import Topics from "./pages/Topics";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

import ErrorBoundary from "./components/ErrorBoundary";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" />;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user?.is_admin ? children : <Navigate to="/" />;
}

function Layout() {
  const location = useLocation();
  const showNav = !AUTH_ROUTES.includes(location.pathname);
  return (
    <>
      {showNav && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/courses" element={<Protected><Courses /></Protected>} />
        <Route path="/topics" element={<Protected><Topics /></Protected>} />
        <Route path="/courses/:courseId" element={<Protected><CourseDetail /></Protected>} />
        <Route path="/topics/:id" element={<Protected><TopicDetail /></Protected>} />
        <Route path="/progress" element={<Protected><Progress /></Protected>} />
        <Route path="/profile" element={<Protected><UserProfile /></Protected>} />
        <Route path="/admin" element={<AdminOnly><AdminReview /></AdminOnly>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Layout />
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
