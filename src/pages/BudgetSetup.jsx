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

function getTodayDate() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

  const [budgetType, setBudgetType] = useState(
    editBudget?.period === "custom" ? "custom" : "standard",
  );

  const [animationKey, setAnimationKey] = useState(0);

  const [customDuration, setCustomDuration] = useState(
    editBudget?.period === "custom"
      ? editBudget.endDate
        ? "duration"
        : "none"
      : "duration",
  );

  const [customStartDate, setCustomStartDate] = useState(
    editBudget?.period === "custom" && editBudget.startDate?.toDate
      ? editBudget.startDate.toDate().toISOString().split("T")[0]
      : getTodayDate(),
  );

  const [customEndDate, setCustomEndDate] = useState(
    editBudget?.period === "custom" && editBudget.endDate?.toDate
      ? (() => {
          const date = editBudget.endDate.toDate();
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");

          return `${year}-${month}-${day}`;
        })()
      : "",
  );

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
              if (budget.status !== "running" || !budget.startDate?.toDate) {
                return false;
              }

              const startDate = budget.startDate.toDate();

              if (!budget.endDate?.toDate) {
                return startDate <= now;
              }

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

    if (budgetType === "custom") {
      if (
        customDuration === "duration" &&
        (!customStartDate || !customEndDate)
      ) {
        setError("Please select a start date and end date.");
        return;
      }

      if (
        customDuration === "duration" &&
        new Date(customEndDate) <= new Date(customStartDate)
      ) {
        setError("End date must be after the start date.");
        return;
      }
    }

    setError("");
    setLoading(true);

    try {
      let budgetId;

      const selectedPeriod = budgetType === "custom" ? "custom" : period;

      const selectedStartDate =
        budgetType === "custom" ? customStartDate : null;

      const selectedEndDate =
        budgetType === "custom" && customDuration === "duration"
          ? customEndDate
          : null;

      if (isEditing) {
        await updateBudget(
          user.uid,
          editBudget.id,
          amount,
          selectedPeriod,
          selectedStartDate,
          selectedEndDate,
        );

        budgetId = editBudget.id;
      } else {
        budgetId = await createBudget(
          user.uid,
          amount,
          selectedPeriod,
          selectedStartDate,
          selectedEndDate,
        );
      }

      const createdBudget = await getBudget(user.uid, budgetId);

      if (!createdBudget) {
        throw new Error("BUDGET_NOT_FOUND");
      }

      if (!isEditing) {
        try {
          await createBudgetNotification(
            user.uid,
            budgetId,
            amount,
            selectedPeriod,
          );
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
      } else if (error.message === "INVALID_CUSTOM_DATES") {
        setError("Please select valid custom dates.");
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
            key={animationKey}
            className="budget-setup-form budget-setup-modal-form"
            onSubmit={handleCreateBudget}
          >
            <h1>{isEditing ? "EDIT BUDGET" : "SET UP A NEW BUDGET"}</h1>

            <label htmlFor="budget-period">Select Budget</label>

            <select
              id="budget-period"
              value={budgetType === "custom" ? "custom" : period}
              onChange={(event) => {
                const value = event.target.value;

                setAnimationKey((current) => current + 1);

                if (value === "custom") {
                  setBudgetType("custom");
                  return;
                }

                setBudgetType("standard");
                setPeriod(value);
              }}
              disabled={loading}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>

            {budgetType === "custom" && (
              <div className="budget-custom-section">
                <label htmlFor="custom-duration">Duration</label>

                <select
                  id="custom-duration"
                  value={customDuration}
                  onChange={(event) => {
                    const value = event.target.value;

                    setCustomDuration(value);

                    requestAnimationFrame(() => {
                      setAnimationKey((current) => current + 1);
                    });
                  }}
                  disabled={loading}
                >
                  <option value="duration">Set Duration</option>
                  <option value="none">No Duration</option>
                </select>

                {customDuration === "duration" && (
                  <div className="budget-custom-dates">
                    <label htmlFor="custom-start-date">Start Date</label>

                    <input
                      id="custom-start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(event) =>
                        setCustomStartDate(event.target.value)
                      }
                      disabled={loading}
                    />

                    <label htmlFor="custom-end-date">End Date</label>

                    <input
                      id="custom-end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(event) => setCustomEndDate(event.target.value)}
                      disabled={loading}
                    />
                  </div>
                )}
              </div>
            )}

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

      <form
        key={animationKey}
        className="budget-setup-form"
        onSubmit={handleCreateBudget}
      >
        <h1>Would you like to setup a budget</h1>

        <label htmlFor="budget-period">Select Budget</label>

        <select
          id="budget-period"
          value={budgetType === "custom" ? "custom" : period}
          onChange={(event) => {
            const value = event.target.value;

            setAnimationKey((current) => current + 1);

            if (value === "custom") {
              setBudgetType("custom");
              return;
            }

            setBudgetType("standard");
            setPeriod(value);
          }}
          disabled={loading}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom</option>
        </select>

        {budgetType === "custom" && (
          <div className="budget-custom-section">
            <label htmlFor="custom-duration">Duration</label>

            <select
              id="custom-duration"
              value={customDuration}
              onChange={(event) => {
                const value = event.target.value;

                setCustomDuration(value);

                requestAnimationFrame(() => {
                  setAnimationKey((current) => current + 1);
                });
              }}
              disabled={loading}
            >
              <option value="duration">Set Duration</option>
              <option value="none">No Duration</option>
            </select>

            {customDuration === "duration" && (
              <div className="budget-custom-dates">
                <label htmlFor="custom-start-date">Start Date</label>

                <input
                  id="custom-start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  disabled={loading}
                />

                <label htmlFor="custom-end-date">End Date</label>

                <input
                  id="custom-end-date"
                  type="date"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        )}

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
