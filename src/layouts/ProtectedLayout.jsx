import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getActiveBudget } from "../firebase/budget";

function ProtectedLayout() {
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    let checking = false;

    async function checkBudgetExpiry() {
      if (checking) {
        return;
      }

      checking = true;

      try {
        await getActiveBudget(user.uid);
      } catch (error) {
        console.error("Unable to process budget expiry:", error);
      } finally {
        checking = false;
      }
    }

    checkBudgetExpiry();

    const intervalId = window.setInterval(checkBudgetExpiry, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user]);

  if (authLoading) {
    return <div className="app-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedLayout;
