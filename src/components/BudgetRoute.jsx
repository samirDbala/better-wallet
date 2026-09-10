import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { getActiveBudget } from "../firebase/budget";
import { useAuth } from "../context/AuthContext";

function BudgetRoute() {
  const { user } = useAuth();

  const [budget, setBudget] = useState(undefined);

  useEffect(() => {
    async function checkBudget() {
      if (!user) {
        setBudget(null);
        return;
      }

      try {
        const activeBudget = await getActiveBudget(user.uid);
        setBudget(activeBudget);
      } catch (error) {
        console.error("Budget check error:", error);
        setBudget(null);
      }
    }

    checkBudget();
  }, [user]);

  if (budget === undefined) {
    return <div className="app-loading">Loading...</div>;
  }

  if (!budget) {
    return <Navigate to="/budget-setup" replace />;
  }

  return <Outlet />;
}

export default BudgetRoute;
