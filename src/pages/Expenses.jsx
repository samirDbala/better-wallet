import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CarFront,
  ChevronDown,
  CircleEllipsis,
  Clapperboard,
  Filter,
  HeartPulse,
  MoreVertical,
  Plane,
  Receipt,
  Search,
  ShoppingBag,
  Utensils,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import {
  getActiveBudget,
  getBudgets,
  listenToBudgets,
} from "../firebase/budget";
import { formatCurrency } from "../utils/currency";
import {
  deleteAllExpenses,
  deleteExpense,
  getExpenses,
  listenToExpenses,
} from "../firebase/expense";

import "../styles/expenses.css";

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

function Expenses() {
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [filterCategory, setFilterCategory] = useState("All");

  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showClearAllConfirmation, setShowClearAllConfirmation] =
    useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [activeBudget, setActiveBudget] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [showBudgetSelector, setShowBudgetSelector] = useState(false);

  const longPressTimer = useRef(null);

  useEffect(() => {
    async function loadBudgets() {
      if (authLoading) {
        return;
      }

      if (!user) {
        setBudgets([]);
        setActiveBudget(null);
        setSelectedBudget(null);
        setExpenses([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [allBudgets, currentBudget] = await Promise.all([
          getBudgets(user.uid),
          getActiveBudget(user.uid),
        ]);

        setBudgets(allBudgets);
        setActiveBudget(currentBudget);

        if (!currentBudget) {
          setSelectedBudget(null);
          setExpenses([]);
          return;
        }

        setSelectedBudget(currentBudget);
      } catch (error) {
        console.error("Unable to load budgets:", error);
        setBudgets([]);
        setActiveBudget(null);
        setSelectedBudget(null);
        setExpenses([]);
      } finally {
        setLoading(false);
      }
    }

    loadBudgets();
  }, [user, authLoading]);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const unsubscribe = listenToBudgets(
      user.uid,
      (updatedBudgets) => {
        setBudgets(updatedBudgets);

        const now = new Date();

        const currentBudget =
          updatedBudgets
            .filter((budget) => {
              if (
                !budget.startDate ||
                budget.status === "held" ||
                budget.status === "completed"
              ) {
                return false;
              }

              const startDate = budget.startDate.toDate();

              if (!budget.endDate) {
                return startDate <= now;
              }

              const endDate = budget.endDate.toDate();

              return startDate <= now && now < endDate;
            })
            .sort((a, b) => {
              const aTime =
                a.createdAt?.toMillis?.() ?? a.startDate?.toMillis?.() ?? 0;

              const bTime =
                b.createdAt?.toMillis?.() ?? b.startDate?.toMillis?.() ?? 0;

              return bTime - aTime;
            })[0] || null;

        setActiveBudget(currentBudget);

        setSelectedBudget((currentSelectedBudget) => {
          if (!currentSelectedBudget) {
            return currentBudget;
          }

          const updatedSelectedBudget = updatedBudgets.find(
            (budget) => budget.id === currentSelectedBudget.id,
          );

          const selectedBudgetIsHeld = updatedSelectedBudget?.status === "held";

          const selectedBudgetIsCompleted =
            updatedSelectedBudget?.status === "completed";

          if (selectedBudgetIsHeld || selectedBudgetIsCompleted) {
            return currentBudget;
          }

          return updatedSelectedBudget || currentBudget;
        });
      },
      (error) => {
        console.error("Unable to sync budgets:", error);
      },
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user?.uid || !selectedBudget?.id) {
      setExpenses([]);
      return undefined;
    }

    const unsubscribe = listenToExpenses(
      user.uid,
      selectedBudget.id,
      (updatedExpenses) => {
        setExpenses(updatedExpenses);
      },
      (error) => {
        console.error("Unable to sync expenses:", error);
      },
    );

    return unsubscribe;
  }, [user, selectedBudget]);

  useEffect(() => {
    return () => {
      clearTimeout(longPressTimer.current);
    };
  }, []);

  function getExpenseDate(expense) {
    if (!expense?.date) {
      return null;
    }

    if (typeof expense.date !== "string" && expense.date.toDate) {
      return expense.date.toDate();
    }

    return new Date(`${expense.date}T00:00:00`);
  }

  function formatDay(date) {
    if (!date) {
      return "Unknown";
    }

    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "short",
    });
  }

  function formatDate(date) {
    if (!date) {
      return "";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  }

  function formatCreatedTime(expense) {
    if (!expense?.createdAt) {
      return "";
    }

    const createdAt = expense.createdAt?.toDate
      ? expense.createdAt.toDate()
      : new Date(expense.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      return "";
    }

    return createdAt.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const filteredExpenses = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const result = expenses.filter((expense) => {
      const matchesSearch =
        !searchValue ||
        expense.name?.toLowerCase().includes(searchValue) ||
        expense.category?.toLowerCase().includes(searchValue);

      const matchesCategory =
        filterCategory === "All" || expense.category === filterCategory;

      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      const aCreatedAt = a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : new Date(a.createdAt || 0).getTime();

      const bCreatedAt = b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : new Date(b.createdAt || 0).getTime();

      if (sortBy === "amount-high") {
        return Number(b.amount || 0) - Number(a.amount || 0);
      }

      if (sortBy === "amount-low") {
        return Number(a.amount || 0) - Number(b.amount || 0);
      }

      if (sortBy === "oldest") {
        return aCreatedAt - bCreatedAt;
      }

      return bCreatedAt - aCreatedAt;
    });

    return result;
  }, [expenses, search, sortBy, filterCategory]);

  const groupedExpenses = useMemo(() => {
    const groups = {};

    filteredExpenses.forEach((expense) => {
      const date = getExpenseDate(expense);
      const day = formatDay(date);

      if (!groups[day]) {
        groups[day] = [];
      }

      groups[day].push(expense);
    });

    return Object.entries(groups).sort(([, first], [, second]) => {
      const firstDate = getExpenseDate(first[0]);
      const secondDate = getExpenseDate(second[0]);

      return secondDate.getTime() - firstDate.getTime();
    });
  }, [filteredExpenses]);

  const categories = [
    "All",
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Entertainment",
    "Health",
    "Travel",
    "Other",
  ];

  function openActions(expense) {
    setSelectedExpense(expense);
    setShowActions(true);
  }

  function closeActions() {
    if (deleting) {
      return;
    }

    setShowActions(false);
    setSelectedExpense(null);
  }

  function startLongPress(expense) {
    clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      openActions(expense);
    }, 550);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current);
  }

  function handleEdit() {
    if (!selectedExpense) {
      return;
    }

    navigate("/expenses/edit", {
      state: {
        expense: selectedExpense,
      },
    });
  }

  async function handleDelete() {
    if (!selectedExpense || !user) {
      return;
    }

    try {
      setDeleting(true);

      await deleteExpense(user.uid, selectedExpense.id);

      setExpenses((current) =>
        current.filter((expense) => expense.id !== selectedExpense.id),
      );

      setShowActions(false);
      setSelectedExpense(null);
    } catch (error) {
      console.error("Unable to delete expense:", error);
    } finally {
      setDeleting(false);
    }
  }

  async function handleClearAllExpenses() {
    if (!user || !selectedBudget) {
      return;
    }

    try {
      setClearingAll(true);

      await deleteAllExpenses(user.uid, selectedBudget.id);

      setExpenses([]);
      setShowClearAllConfirmation(false);
      setShowHeaderMenu(false);
    } catch (error) {
      console.error("Unable to clear all expenses:", error);
    } finally {
      setClearingAll(false);
    }
  }

  function getCategoryIcon(category) {
    return categoryIcons[category] || categoryIcons.Other;
  }

  function getBudgetLabel(budget) {
    if (!budget) {
      return "Budget";
    }

    const samePeriodBudgets = budgets
      .filter((item) => item.period === budget.period)
      .sort((a, b) => {
        const aDate = a.startDate?.toMillis?.() ?? 0;
        const bDate = b.startDate?.toMillis?.() ?? 0;

        return aDate - bDate;
      });

    const budgetIndex = samePeriodBudgets.findIndex(
      (item) => item.id === budget.id,
    );

    if (budget.period === "weekly") {
      return `Week ${budgetIndex + 1}`;
    }

    if (budget.period === "monthly") {
      return `Month ${budgetIndex + 1}`;
    }

    if (budget.period === "daily") {
      return `Day ${budgetIndex + 1}`;
    }

    if (budget.period === "yearly") {
      return `Year ${budgetIndex + 1}`;
    }

    return "Budget";
  }

  function handleBudgetChange(budget) {
    if (!budget) {
      return;
    }

    setShowBudgetSelector(false);
    setSelectedBudget(budget);
    setSearch("");
    setFilterCategory("All");
  }

  return (
    <main className="expenses-page">
      <div className="expenses-content">
        <header className="expenses-page-header">
          <button
            className="expenses-back-button"
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={22} strokeWidth={1.7} />
          </button>

          <h1>All Expense</h1>

          <button
            className="expenses-header-menu"
            type="button"
            aria-label="More options"
            onClick={() => setShowHeaderMenu(true)}
          >
            <MoreVertical size={20} strokeWidth={1.7} />
          </button>
        </header>

        <div className="expenses-search-row">
          <div className="expenses-search-field">
            <input
              type="text"
              placeholder="search expenses"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {search && (
              <button
                type="button"
                className="expenses-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={15} strokeWidth={1.8} />
              </button>
            )}
          </div>

          <button
            className="expenses-search-button"
            type="button"
            aria-label="Search"
          >
            <Search size={20} strokeWidth={1.8} />
          </button>
        </div>

        <div className="expenses-controls">
          <button
            className="expenses-control-button"
            type="button"
            onClick={() => setShowSort(true)}
          >
            <ChevronDown size={16} strokeWidth={2} />
            SORT
          </button>

          <button
            className="expenses-control-button"
            type="button"
            onClick={() => setShowFilter(true)}
          >
            <Filter size={15} strokeWidth={1.8} />
            FILTER
          </button>
        </div>

        <div className="expenses-summary">
          <strong>
            {filteredExpenses.length}{" "}
            {filteredExpenses.length === 1 ? "Expense" : "Expenses"}
          </strong>
          <button
            className="expenses-week-button"
            type="button"
            onClick={() => setShowBudgetSelector(true)}
          >
            {getBudgetLabel(selectedBudget)}
            <ChevronDown size={15} strokeWidth={1.8} />
          </button>
        </div>

        {loading ? (
          <div className="expenses-empty">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="expenses-empty">
            <strong>
              {search || filterCategory !== "All"
                ? "No expenses found"
                : "No expenses yet"}
            </strong>

            <span>
              {search || filterCategory !== "All"
                ? "Try changing your search or filter"
                : "Add an expense to get started"}
            </span>
          </div>
        ) : (
          <section className="grouped-expenses">
            {groupedExpenses.map(([day, dayExpenses]) => (
              <div className="expense-day-group" key={day}>
                <h2>{day}</h2>

                <div className="expense-day-list">
                  {dayExpenses.map((expense) => {
                    const CategoryIcon = getCategoryIcon(expense.category);

                    const expenseDate = getExpenseDate(expense);

                    return (
                      <article
                        className="expense-row"
                        key={expense.id}
                        onTouchStart={() => startLongPress(expense)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onMouseDown={() => startLongPress(expense)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                      >
                        <div className="expense-row-left">
                          <div className="expense-category-icon">
                            <CategoryIcon size={15} strokeWidth={1.8} />
                          </div>

                          <div className="expense-row-info">
                            <strong>{expense.name}</strong>

                            <span>
                              {expense.category}

                              {expenseDate &&
                                ` • ${formatDate(expenseDate)}${
                                  formatCreatedTime(expense)
                                    ? ` • ${formatCreatedTime(expense)}`
                                    : ""
                                }`}
                            </span>
                          </div>
                        </div>

                        <div className="expense-row-right">
                          <strong>
                            {formatCurrency(-Number(expense.amount || 0))}
                          </strong>

                          <button
                            className="expense-row-menu"
                            type="button"
                            aria-label={`Options for ${expense.name}`}
                            onClick={() => openActions(expense)}
                          >
                            <MoreVertical size={17} strokeWidth={1.7} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {showSort && (
        <div className="expenses-modal-overlay">
          <section className="expenses-action-sheet">
            <div className="expenses-modal-header">
              <h2>Sort Expenses</h2>

              <button
                type="button"
                className="expenses-modal-close"
                aria-label="Close sort"
                onClick={() => setShowSort(false)}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <button
              type="button"
              className={sortBy === "date" ? "active" : ""}
              onClick={() => {
                setSortBy("date");
                setShowSort(false);
              }}
            >
              NEWEST FIRST
            </button>

            <button
              type="button"
              className={sortBy === "oldest" ? "active" : ""}
              onClick={() => {
                setSortBy("oldest");
                setShowSort(false);
              }}
            >
              OLDEST FIRST
            </button>

            <button
              type="button"
              className={sortBy === "amount-high" ? "active" : ""}
              onClick={() => {
                setSortBy("amount-high");
                setShowSort(false);
              }}
            >
              HIGHEST AMOUNT
            </button>

            <button
              type="button"
              className={sortBy === "amount-low" ? "active" : ""}
              onClick={() => {
                setSortBy("amount-low");
                setShowSort(false);
              }}
            >
              LOWEST AMOUNT
            </button>
          </section>
        </div>
      )}

      {showFilter && (
        <div className="expenses-modal-overlay">
          <section className="expenses-action-sheet">
            <div className="expenses-modal-header">
              <h2>Filter Expenses</h2>

              <button
                type="button"
                className="expenses-modal-close"
                aria-label="Close filter"
                onClick={() => setShowFilter(false)}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={filterCategory === category ? "active" : ""}
                onClick={() => {
                  setFilterCategory(category);
                  setShowFilter(false);
                }}
              >
                {category.toUpperCase()}
              </button>
            ))}
          </section>
        </div>
      )}

      {showBudgetSelector && (
        <div className="expenses-modal-overlay">
          <section className="expenses-action-sheet">
            <div className="expenses-modal-header">
              <h2>Select Budget</h2>

              <button
                type="button"
                className="expenses-modal-close"
                aria-label="Close budget selector"
                onClick={() => setShowBudgetSelector(false)}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            {budgets.map((budget) => (
              <button
                key={budget.id}
                type="button"
                className={selectedBudget?.id === budget.id ? "active" : ""}
                onClick={() => handleBudgetChange(budget)}
              >
                {getBudgetLabel(budget)}
              </button>
            ))}

            <button
              type="button"
              className="cancel-action"
              onClick={() => setShowBudgetSelector(false)}
            >
              CANCEL
            </button>
          </section>
        </div>
      )}

      {showHeaderMenu && (
        <div className="expenses-modal-overlay">
          <section className="expenses-action-sheet">
            <div className="expenses-modal-header">
              <h2>Expense Options</h2>

              <button
                type="button"
                className="expenses-modal-close"
                aria-label="Close expense options"
                onClick={() => setShowHeaderMenu(false)}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <button
              type="button"
              className="clear-all-expenses-action"
              onClick={() => {
                setShowHeaderMenu(false);
                setShowClearAllConfirmation(true);
              }}
              disabled={!expenses.length}
            >
              CLEAR ALL EXPENSES
            </button>

            <button
              type="button"
              className="cancel-action"
              onClick={() => setShowHeaderMenu(false)}
            >
              CANCEL
            </button>
          </section>
        </div>
      )}

      {showActions && selectedExpense && (
        <div className="expenses-modal-overlay">
          <section className="expenses-action-sheet">
            <div className="expenses-modal-header">
              <h2>Expense Options</h2>

              <button
                type="button"
                className="expenses-modal-close"
                aria-label="Close expense options"
                onClick={closeActions}
                disabled={deleting}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <div className="selected-expense">
              <strong>{selectedExpense.name}</strong>

              <span>
                {formatCurrency(-Number(selectedExpense.amount || 0))}
              </span>
            </div>

            <button type="button" onClick={handleEdit} disabled={deleting}>
              EDIT EXPENSE
            </button>

            <button
              type="button"
              className="delete-action"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "DELETING..." : "DELETE EXPENSE"}
            </button>

            <button
              type="button"
              className="cancel-action"
              onClick={closeActions}
              disabled={deleting}
            >
              CANCEL
            </button>
          </section>
        </div>
      )}

      {showClearAllConfirmation && (
        <div
          className="expenses-modal-overlay"
          onClick={() => {
            if (!clearingAll) {
              setShowClearAllConfirmation(false);
            }
          }}
        >
          <section
            className="expenses-action-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="expenses-action-handle" />

            <div className="expenses-delete-confirmation">
              <h2>Clear all expenses?</h2>

              <p>This will permanently delete all expenses from this budget.</p>
            </div>

            <button
              type="button"
              className="delete-action"
              onClick={handleClearAllExpenses}
              disabled={clearingAll}
            >
              {clearingAll ? "CLEARING..." : "YES, CLEAR ALL EXPENSES"}
            </button>

            <button
              type="button"
              className="cancel-action"
              onClick={() => setShowClearAllConfirmation(false)}
              disabled={clearingAll}
            >
              CANCEL
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default Expenses;
