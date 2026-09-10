import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getActiveBudget, getLatestFinishedBudget } from "../firebase/budget";

import { useAuth } from "../context/AuthContext";

function EntryRoute() {
  const { user, authLoading } = useAuth();

  const [budget, setBudget] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkBudget() {
      if (!user) {
        setBudget(null);
        setBudgetLoading(false);
        return;
      }

      setBudgetLoading(true);
      setBudget(null);

      try {
        const activeBudget = await getActiveBudget(user.uid);

        if (cancelled) {
          return;
        }

        if (activeBudget) {
          setBudget(activeBudget);
          setBudgetLoading(false);
          return;
        }

        const latestFinishedBudget = await getLatestFinishedBudget(user.uid);

        if (cancelled) {
          return;
        }

        setBudget(latestFinishedBudget || null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Entry route budget check error:", error);
        setBudget(null);
      } finally {
        if (!cancelled) {
          setBudgetLoading(false);
        }
      }
    }

    if (!authLoading) {
      checkBudget();
    }

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || (user && budgetLoading)) {
    return <div className="app-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!budget) {
    return <Navigate to="/budget-setup" replace />;
  }

  return <Navigate to="/home" replace />;
}

export default EntryRoute;
