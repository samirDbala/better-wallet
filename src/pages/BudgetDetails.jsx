import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CarFront,
  ChevronRight,
  CircleEllipsis,
  Clapperboard,
  HeartPulse,
  MoreVertical,
  Plane,
  Receipt,
  ShoppingBag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { deleteBudget, listenToBudgets } from "../firebase/budget";
import { listenToExpenses } from "../firebase/expense";
import { formatCurrency } from "../utils/currency";

import "../styles/budget-details.css";

const categoryIcons = {
  Food: Utensils,
  Transport: CarFront,
  Shopping: ShoppingBag,
  Bills: Receipt,
  Entertainment: Clapperboard,
  Health: HeartPulse,
  Travel: Plane,
  Other: CircleEllipsis,
};

function getDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = getDate(value);

  if (!date) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value) {
  const date = getDate(value);

  if (!date) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function getPeriodLabel(period) {
  const labels = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };

  return labels[period] || period;
}

function getBudgetStatus(budget, spentPercentage) {
  if (budget.status === "held") {
    return "HELD";
  }

  if (budget.status === "completed") {
    return "COMPLETED";
  }

  const endDate = getDate(budget.endDate);

  if (endDate && endDate <= new Date()) {
    return "COMPLETED";
  }

  if (spentPercentage >= 100) {
    return "LIMIT REACHED";
  }

  return "RUNNING";
}

function BudgetDetails() {
  const navigate = useNavigate();
  const { budgetId } = useParams();
  const { user } = useAuth();

  const [budget, setBudget] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user?.uid || !budgetId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribeBudget = listenToBudgets(
      user.uid,
      (updatedBudgets) => {
        const updatedBudget =
          updatedBudgets.find((item) => item.id === budgetId) || null;

        setBudget(updatedBudget);
        setLoading(false);
      },
      (error) => {
        console.error("Unable to sync budget:", error);
        setBudget(null);
        setLoading(false);
      },
    );

    const unsubscribeExpenses = listenToExpenses(
      user.uid,
      budgetId,
      (updatedExpenses) => {
        setExpenses(updatedExpenses);
      },
      (error) => {
        console.error("Unable to sync expenses:", error);
        setExpenses([]);
      },
    );

    return () => {
      unsubscribeBudget();
      unsubscribeExpenses();
    };
  }, [user?.uid, budgetId]);

  const totalSpent = useMemo(() => {
    return expenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0,
    );
  }, [expenses]);

  const budgetAmount = Number(budget?.amount || 0);

  const remaining = Math.max(budgetAmount - totalSpent, 0);

  const spentPercentage =
    budgetAmount > 0 ? Math.min((totalSpent / budgetAmount) * 100, 100) : 0;

  const budgetStatus = useMemo(() => {
    if (!budget) {
      return "";
    }

    return getBudgetStatus(budget, spentPercentage);
  }, [budget, spentPercentage]);

  const categorySpending = useMemo(() => {
    const totals = {};

    expenses.forEach((expense) => {
      const category = expense.category || "Other";

      totals[category] = (totals[category] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(totals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalSpent]);

  async function handleDeleteBudget() {
    if (!user?.uid || !budgetId) {
      return;
    }

    try {
      setDeleting(true);

      await deleteBudget(user.uid, budgetId);

      navigate("/budgets", { replace: true });
    } catch (error) {
      console.error("Unable to delete budget:", error);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="budget-details-page">
        <div className="budget-details-loading">Loading budget...</div>
      </main>
    );
  }

  if (!budget) {
    return (
      <main className="budget-details-page">
        <div className="budget-details-content">
          <header className="budget-details-header">
            <button
              className="budget-details-back-button"
              type="button"
              onClick={() => navigate("/budgets", { replace: true })}
              aria-label="Go back"
            >
              <ArrowLeft size={20} strokeWidth={1.7} />
            </button>

            <h1>Budget</h1>

            <div className="budget-details-header-space" />
          </header>

          <section className="budget-details-empty">
            <h2>Budget not found</h2>

            <p>This budget may have been deleted.</p>

            <button
              className="budget-details-primary-button"
              type="button"
              onClick={() => navigate("/budgets", { replace: true })}
            >
              BACK TO BUDGETS
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="budget-details-page">
      <div className="budget-details-content">
        <header className="budget-details-header">
          <button
            className="budget-details-back-button"
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft size={20} strokeWidth={1.7} />
          </button>

          <h1>Budget Details</h1>

          <button
            className="budget-details-menu-button"
            type="button"
            onClick={() => setShowActions(true)}
            aria-label="Budget actions"
          >
            <MoreVertical size={20} strokeWidth={1.7} />
          </button>
        </header>

        <section className="budget-details-summary">
          <div className="budget-details-summary-top">
            <div>
              <span className="budget-details-period">
                {getPeriodLabel(budget.period)}
              </span>

              <h2>{formatCurrency(budgetAmount)}</h2>
            </div>

            <span className="budget-details-status">{budgetStatus}</span>
          </div>

          <div className="budget-details-progress">
            <div
              className="budget-details-progress-fill"
              style={{
                width: `${spentPercentage}%`,
              }}
            />
          </div>

          <div className="budget-details-progress-labels">
            <span>{formatCurrency(totalSpent)} spent</span>

            <span>{Math.round(spentPercentage)}%</span>
          </div>
        </section>

        <section className="budget-details-overview">
          <div className="budget-details-overview-item">
            <span>Spent</span>
            <strong>{formatCurrency(totalSpent)}</strong>
          </div>

          <div className="budget-details-overview-divider" />

          <div className="budget-details-overview-item">
            <span>Remaining</span>

            <strong>{formatCurrency(remaining)}</strong>
          </div>
        </section>

        <section className="budget-details-dates">
          <h2>Budget period</h2>

          <div className="budget-details-date-row">
            <CalendarDays size={18} strokeWidth={1.6} />

            <div>
              <span>Start</span>

              <strong>{formatDate(budget.startDate)}</strong>
            </div>

            <ChevronRight
              className="budget-details-date-arrow"
              size={17}
              strokeWidth={1.5}
            />

            <div>
              <span>End</span>

              <strong>{formatDate(budget.endDate)}</strong>
            </div>
          </div>
        </section>

        <section className="budget-details-category-section">
          <div className="budget-details-section-heading">
            <h2>Spending by category</h2>
          </div>

          {categorySpending.length === 0 ? (
            <div className="budget-details-no-data">
              <Receipt size={20} strokeWidth={1.5} />

              <span>No spending yet</span>
            </div>
          ) : (
            <div className="budget-details-category-list">
              {categorySpending.map((item) => {
                const CategoryIcon =
                  categoryIcons[item.category] || categoryIcons.Other;

                return (
                  <div
                    className="budget-details-category-row"
                    key={item.category}
                  >
                    <div className="budget-details-category-icon">
                      <CategoryIcon size={16} strokeWidth={1.6} />
                    </div>

                    <div className="budget-details-category-info">
                      <div className="budget-details-category-name">
                        <strong>{item.category}</strong>

                        <span>{formatCurrency(item.amount)}</span>
                      </div>

                      <div className="budget-details-category-bar">
                        <div
                          style={{
                            width: `${item.percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="budget-details-expenses">
          <div className="budget-details-section-heading">
            <h2>Expenses</h2>

            <span>{expenses.length}</span>
          </div>

          {expenses.length === 0 ? (
            <div className="budget-details-no-data">
              <Receipt size={20} strokeWidth={1.5} />

              <span>No expenses in this budget</span>
            </div>
          ) : (
            <div className="budget-details-expense-list">
              {expenses.map((expense) => {
                const CategoryIcon =
                  categoryIcons[expense.category] || categoryIcons.Other;

                return (
                  <div className="budget-details-expense-row" key={expense.id}>
                    <div className="budget-details-expense-icon">
                      <CategoryIcon size={16} strokeWidth={1.6} />
                    </div>

                    <div className="budget-details-expense-info">
                      <strong>{expense.name}</strong>

                      <span>
                        {expense.category || "Other"} ·{" "}
                        {formatShortDate(expense.date)}
                      </span>
                    </div>

                    <strong className="budget-details-expense-amount">
                      {formatCurrency(-Number(expense.amount || 0))}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showActions && (
        <div className="budget-details-action-overlay">
          <section
            className="budget-details-action-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="budget-details-modal-header">
              <h2>Budget Options</h2>

              <button
                type="button"
                className="budget-details-modal-close"
                aria-label="Close budget options"
                onClick={() => setShowActions(false)}
                disabled={deleting}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <button
              type="button"
              className="budget-details-delete-action"
              onClick={() => {
                setShowActions(false);
                setShowDeleteConfirmation(true);
              }}
              disabled={deleting}
            >
              <Trash2 size={16} strokeWidth={1.7} />
              DELETE BUDGET
            </button>

            <button
              type="button"
              className="budget-details-cancel-action"
              onClick={() => setShowActions(false)}
              disabled={deleting}
            >
              CANCEL
            </button>
          </section>
        </div>
      )}

      {showDeleteConfirmation && (
        <div
          className="budget-details-action-overlay"
          onClick={() => {
            if (!deleting) {
              setShowDeleteConfirmation(false);
            }
          }}
        >
          <div
            className="budget-details-action-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="budget-details-action-handle" />

            <div className="budget-details-delete-confirmation">
              <h2>Delete this budget?</h2>

              <p>
                This will permanently delete this budget and all expenses
                associated with it.
              </p>
            </div>

            <button
              className="budget-details-delete-confirm-action"
              type="button"
              onClick={handleDeleteBudget}
              disabled={deleting}
            >
              {deleting ? "DELETING..." : "YES, DELETE BUDGET"}
            </button>

            <button
              className="budget-details-cancel-action"
              type="button"
              onClick={() => setShowDeleteConfirmation(false)}
              disabled={deleting}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default BudgetDetails;
