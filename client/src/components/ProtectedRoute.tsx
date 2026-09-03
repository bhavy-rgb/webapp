import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CardsSkeleton } from "@/components/Skeleton";

export default function ProtectedRoute({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  /** When true, the route also requires the account to be an admin. */
  isAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grain min-h-screen bg-cream">
        <CardsSkeleton />
      </div>
    );
  }

  if (!user) {
    // Preserve where the user was heading so Login can send them back
    // (e.g. an invite link /play/ABC123 opened while logged out).
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isAdmin && !user.isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
