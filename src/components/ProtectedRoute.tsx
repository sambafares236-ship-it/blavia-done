import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading, profileLoading } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading || profileLoading) {
      timer.current = setTimeout(() => {
        console.log("ProtectedRoute timeout - forcing render");
        setTimedOut(true);
      }, 3000);
    } else {
      if (timer.current) clearTimeout(timer.current);
      setTimedOut(false);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [loading, profileLoading]);

  const isReady = timedOut || (!loading && !profileLoading);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};