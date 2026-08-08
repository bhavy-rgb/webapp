import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Lobby from "@/pages/Lobby";
import Training from "@/pages/Training";
import Bot from "@/pages/Bot";
import Play from "@/pages/Play";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
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
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
