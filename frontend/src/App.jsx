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

const AUTH_ROUTES = ["/login", "/register"];

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
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/courses/:courseId" element={<Protected><CourseDetail /></Protected>} />
        <Route path="/topics/:id" element={<Protected><TopicDetail /></Protected>} />
        <Route path="/suggest" element={<Protected><SuggestPage /></Protected>} />
        <Route path="/admin" element={<AdminOnly><AdminReview /></AdminOnly>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  );
}
