import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, X } from "lucide-react";

import {
  createBudget,
  getActiveBudget,
  getBudget,
  listenToBudgets,
  updateBudget,
} from "../firebase/budget";
import { createBudgetNotification } from "../firebase/notifications";
import { logoutUser } from "../firebase/auth";
import { useAuth } from "../context/AuthContext";

import "../styles/budget-setup.css";

function BudgetSetup({
  mode = "page",
  onClose,
  onBudgetCreated,
  editBudget = null,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isModal = mode === "modal";
  const isEditing = Boolean(editBudget?.id);
  const [period, setPeriod] = useState(editBudget?.period || "weekly");
  const [amount, setAmount] = useState(editBudget?.amount?.toString() || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!user || isModal) {
      return;
    }

    let unsubscribe = () => {};
    let mounted = true;

    async function checkExistingBudget() {
      try {
        const activeBudget = await getActiveBudget(user.uid);

        if (mounted && activeBudget) {
          navigate("/home", { replace: true });
          return;
        }

        unsubscribe = listenToBudgets(
          user.uid,
          (budgets) => {
            const now = new Date();

            const activeBudget = budgets.find((budget) => {
              if (
                budget.status !== "running" ||
                !budget.startDate?.toDate ||
                !budget.endDate?.toDate
              ) {
                return false;
              }

              const startDate = budget.startDate.toDate();
              const endDate = budget.endDate.toDate();

              return startDate <= now && now < endDate;
            });

            if (mounted && activeBudget) {
              navigate("/home", { replace: true });
            }
          },
          (error) => {
            console.error("Unable to listen for budget changes:", error);
          },
        );
      } catch (error) {
        console.error("Unable to check active budget:", error);
      }
    }

    checkExistingBudget();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [user, isModal, navigate]);

  async function handleCreateBudget(event) {
    event.preventDefault();

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid budget amount.");
      return;
    }

    if (!user) {
      setError("Please log in before creating a budget.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      let budgetId;

      if (isEditing) {
        await updateBudget(user.uid, editBudget.id, amount, period);
        budgetId = editBudget.id;
      } else {
        budgetId = await createBudget(user.uid, amount, period);
      }
      const createdBudget = await getBudget(user.uid, budgetId);

      if (!createdBudget) {
        throw new Error("BUDGET_NOT_FOUND");
      }

      if (!isEditing) {
        try {
          await createBudgetNotification(user.uid, budgetId, amount, period);
        } catch (notificationError) {
          console.error(
            "Unable to create budget notification:",
            notificationError,
          );
        }
      }

      if (isModal) {
        onBudgetCreated?.(createdBudget);
        onClose?.();
      } else {
        navigate("/home", { replace: true });
      }
    } catch (error) {
      if (error.message === "ACTIVE_BUDGET_EXISTS") {
        setError("You already have a running budget.");
      } else {
        setError("Unable to create budget. Please try again.");
      }

      console.error("Unable to create budget:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      await logoutUser();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Unable to log out:", error);
      setError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }

  if (isModal) {
    return (
      <div className="budget-setup-modal-overlay">
        <section className="budget-setup-modal">
          <button
            className="budget-setup-close"
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={loading}
          >
            <X size={19} strokeWidth={1.8} />
          </button>

          <form
            className="budget-setup-form budget-setup-modal-form"
            onSubmit={handleCreateBudget}
          >
            <h1>{isEditing ? "EDIT BUDGET" : "SET UP A NEW BUDGET"}</h1>

            <label htmlFor="budget-period">Select Budget</label>

            <select
              id="budget-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              disabled={loading}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>

            <label htmlFor="budget-amount">Budget</label>

            <input
              id="budget-amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="Set a budget amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={loading}
              required
            />

            {error && <p className="budget-error">{error}</p>}

            <button
              className="budget-create-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? isEditing
                  ? "SAVING..."
                  : "CREATING..."
                : isEditing
                  ? "SAVE CHANGES"
                  : "CREATE BUDGET"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <main className="budget-setup-page">
      <button
        className="budget-setup-logout"
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        aria-label="Log out"
      >
        <span>{loggingOut ? "LOGGING OUT..." : "LOGOUT"}</span>
        <LogOut size={14} strokeWidth={1.8} />
      </button>

      <form className="budget-setup-form" onSubmit={handleCreateBudget}>
        <h1>Would you like to setup a budget</h1>

        <label htmlFor="budget-period">Select Budget</label>

        <select
          id="budget-period"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          disabled={loading}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        <label htmlFor="budget-amount">Budget</label>

        <input
          id="budget-amount"
          type="number"
          min="1"
          step="0.01"
          placeholder="Set a budget amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={loading}
          required
        />

        {error && <p className="budget-error">{error}</p>}

        <button
          className="budget-create-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "CREATING..." : "CREATE BUDGET"}
        </button>
      </form>
    </main>
  );
}

export default BudgetSetup;
