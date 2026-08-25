import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Lobby from "@/pages/Lobby";
import Training from "@/pages/Training";
import Bot from "@/pages/Bot";
import Play from "@/pages/Play";
import Admin from "@/pages/Admin";
import { Privacy, Terms } from "@/pages/Legal";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          {/* Open to guests — login is not required to play */}
          <Route path="/lobby" element={<Lobby />} />
          <Route
            path="/training"
            element={
              <ProtectedRoute>
                <Training />
              </ProtectedRoute>
            }
          />
          {/* Open to guests — login is not required to play */}
          <Route path="/bot" element={<Bot />} />
          {/* Playable without an account — invite links work for guests */}
          <Route path="/play/:code" element={<Play />} />
          {/* Admin panel — server enforces the admin role; the page itself
              also gates rendering for non-admin accounts. */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
