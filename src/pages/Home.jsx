import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BellDot,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
  User,
  X,
  WalletCards,
  Receipt,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import {
  getActiveBudget,
  getLatestFinishedBudget,
  getPreviousBudget,
  listenToBudgets,
} from "../firebase/budget";
import { getExpenses, listenToExpenses } from "../firebase/expense";
import { listenToNotifications } from "../firebase/notifications";

import AddExpense from "./AddExpense";
import BudgetSetup from "./BudgetSetup";

import "../styles/home.css";

function getCachedHomeData(userId) {
  if (!userId) {
    return null;
  }

  try {
    const cachedData = localStorage.getItem(`better-wallet-home-${userId}`);

    if (!cachedData) {
      return null;
    }

    return JSON.parse(cachedData);
  } catch (error) {
    console.error("Unable to read cached home data:", error);
    return null;
  }
}

function getPeriodLabel(period) {
  if (period === "daily") return "Daily";
  if (period === "weekly") return "Weekly";
  if (period === "monthly") return "Monthly";
  if (period === "yearly") return "Yearly";

  return "Week";
}

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const cachedHomeData = getCachedHomeData(user?.uid);

  const [analyticsView, setAnalyticsView] = useState("spending");

  const [categoryPage, setCategoryPage] = useState(0);

  const [analyticsViewLoaded, setAnalyticsViewLoaded] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setAnalyticsView("spending");
      setAnalyticsViewLoaded(false);
      return;
    }

    const savedView = localStorage.getItem(
      `better-wallet-analytics-view-${user.uid}`,
    );

    setAnalyticsView(savedView || "spending");
    setAnalyticsViewLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!user?.uid || !analyticsViewLoaded) {
      return;
    }

    localStorage.setItem(
      `better-wallet-analytics-view-${user.uid}`,
      analyticsView,
    );
  }, [analyticsView, analyticsViewLoaded, user]);

  const [budget, setBudget] = useState(cachedHomeData?.budget || null);

  const [previousBudget, setPreviousBudget] = useState(null);

  const [previousBudgetSpent, setPreviousBudgetSpent] = useState(0);

  const [expenses, setExpenses] = useState(cachedHomeData?.expenses || []);

  const [expensesLoading, setExpensesLoading] = useState(false);

  const [showAddExpense, setShowAddExpense] = useState(false);

  const [showCreateBudget, setShowCreateBudget] = useState(false);

  const [showMenu, setShowMenu] = useState(false);

  const [profileImageLoaded, setProfileImageLoaded] = useState(false);

  useEffect(() => {
    setProfileImageLoaded(false);
  }, [user?.photoURL]);

  useEffect(() => {
    if (location.state?.openMenu) {
      setShowMenu(true);

      navigate("/home", {
        replace: true,
        state: {},
      });
    }
  }, [location.state, navigate]);

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return undefined;
    }

    const unsubscribe = listenToNotifications(
      user.uid,
      (updatedNotifications) => {
        setNotifications(updatedNotifications);
      },
    );

    return unsubscribe;
  }, [user]);

  const hasUnreadNotifications = notifications.some(
    (notification) =>
      notification.budgetId === budget?.id && notification.read === false,
  );

  useEffect(() => {
    async function loadHomeData() {
      if (!user) {
        setBudget(null);
        setExpenses([]);
        setExpensesLoading(false);
        return;
      }

      try {
        const activeBudget = await getActiveBudget(user.uid);

        setBudget(activeBudget);

        if (!activeBudget) {
          const latestPreviousBudget = await getLatestFinishedBudget(user.uid);

          setBudget(null);
          setPreviousBudget(latestPreviousBudget);

          if (latestPreviousBudget) {
            const previousExpenses = await getExpenses(
              user.uid,
              latestPreviousBudget.id,
            );

            const previousTotalSpent = previousExpenses.reduce(
              (total, expense) => total + Number(expense.amount || 0),
              0,
            );

            setPreviousBudgetSpent(previousTotalSpent);
          } else {
            setPreviousBudgetSpent(0);
          }

          setExpenses([]);
          setExpensesLoading(false);

          localStorage.removeItem(`better-wallet-home-${user.uid}`);

          return;
        }

        const completedBudget = await getPreviousBudget(
          user.uid,
          activeBudget.id,
          activeBudget.period,
        );

        setPreviousBudget(completedBudget);

        if (!completedBudget) {
          setPreviousBudgetSpent(0);
        }

        if (completedBudget) {
          const completedBudgetExpenses = await getExpenses(
            user.uid,
            completedBudget.id,
          );

          const completedBudgetTotalSpent = completedBudgetExpenses.reduce(
            (total, expense) => total + Number(expense.amount || 0),
            0,
          );

          setPreviousBudgetSpent(completedBudgetTotalSpent);
        } else {
          setPreviousBudgetSpent(0);
        }

        setExpensesLoading(true);

        const budgetExpenses = await getExpenses(user.uid, activeBudget.id);

        setExpenses(budgetExpenses);

        localStorage.setItem(
          `better-wallet-home-${user.uid}`,
          JSON.stringify({
            budget: activeBudget,
            expenses: budgetExpenses,
          }),
        );
      } catch (error) {
        console.error("Unable to load home data:", error);
      } finally {
        setExpensesLoading(false);
      }
    }

    loadHomeData();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const unsubscribe = listenToBudgets(
      user.uid,
      async () => {
        try {
          const activeBudget = await getActiveBudget(user.uid);

          setBudget(activeBudget);

          if (!activeBudget) {
            setExpenses([]);

            const latestPreviousBudget = await getLatestFinishedBudget(
              user.uid,
            );

            setPreviousBudget(latestPreviousBudget);

            if (!latestPreviousBudget) {
              setPreviousBudgetSpent(0);
            }

            return;
          }

          const completedBudget = await getPreviousBudget(
            user.uid,
            activeBudget.id,
            activeBudget.period,
          );

          setPreviousBudget(completedBudget);

          if (!completedBudget) {
            setPreviousBudgetSpent(0);
          }
        } catch (error) {
          console.error("Unable to sync home budget:", error);
        }
      },
      (error) => {
        console.error("Unable to sync home budgets:", error);
      },
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user?.uid || !budget?.id) {
      return undefined;
    }

    const unsubscribe = listenToExpenses(
      user.uid,
      budget.id,
      (updatedExpenses) => {
        setExpenses(updatedExpenses);

        localStorage.setItem(
          `better-wallet-home-${user.uid}`,
          JSON.stringify({
            budget,
            expenses: updatedExpenses,
          }),
        );
      },
      (error) => {
        console.error("Unable to sync home expenses:", error);
      },
    );

    return unsubscribe;
  }, [user, budget]);

  useEffect(() => {
    if (!user?.uid || !previousBudget?.id) {
      setPreviousBudgetSpent(0);
      return undefined;
    }

    const unsubscribe = listenToExpenses(
      user.uid,
      previousBudget.id,
      (updatedExpenses) => {
        const totalSpent = updatedExpenses.reduce(
          (total, expense) => total + Number(expense.amount || 0),
          0,
        );

        setPreviousBudgetSpent(totalSpent);
      },
      (error) => {
        console.error("Unable to sync previous budget expenses:", error);
      },
    );

    return unsubscribe;
  }, [user, previousBudget]);

  const budgetAmount = budget ? Number(budget.amount) : 0;

  const totalSpent = useMemo(() => {
    return expenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0,
    );
  }, [expenses]);

  const remaining = Math.max(budgetAmount - totalSpent, 0);

  const percentageLeft =
    budgetAmount > 0
      ? Math.max(0, Math.min(100, (remaining / budgetAmount) * 100))
      : 0;

  const percentageSpent =
    budgetAmount > 0
      ? Math.max(0, Math.min(100, (totalSpent / budgetAmount) * 100))
      : 0;

  const previousSpendingChange = useMemo(() => {
    if (!budget) {
      return null;
    }

    if (!previousBudget || previousBudgetSpent <= 0) {
      return previousBudget && totalSpent === 0 ? 0 : null;
    }

    return ((previousBudgetSpent - totalSpent) / previousBudgetSpent) * 100;
  }, [budget, previousBudget, previousBudgetSpent, totalSpent]);

  function getSpendingChangeStatus(change) {
    if (change === null) {
      return "neutral";
    }

    if (change > 0) {
      return "positive";
    }

    if (change < 0) {
      return "negative";
    }

    return "neutral";
  }

  const previousSpendingChangeStatus = getSpendingChangeStatus(
    previousSpendingChange,
  );

  function getBudgetStatusClass(spentPercentage) {
    if (spentPercentage >= 80) {
      return "negative";
    }

    if (spentPercentage >= 50) {
      return "warning";
    }

    return "positive";
  }

  const savingsStatus = getBudgetStatusClass(percentageSpent);

  const budgetPeriod = budget?.period
    ? budget.period.charAt(0).toUpperCase() + budget.period.slice(1)
    : "Week";

  const todayExpenses = useMemo(() => {
    const today = new Date();

    const todayString = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    return expenses.filter((expense) => {
      if (!expense.date) {
        return false;
      }

      let expenseDate = expense.date;

      if (typeof expense.date !== "string" && expense.date.toDate) {
        expenseDate = expense.date.toDate().toISOString().slice(0, 10);
      }

      return expenseDate === todayString;
    });
  }, [expenses]);

  const spendingByDay = useMemo(() => {
    const days = [
      { label: "Mon", value: 0 },
      { label: "Tue", value: 0 },
      { label: "Wed", value: 0 },
      { label: "Thu", value: 0 },
      { label: "Fri", value: 0 },
      { label: "Sat", value: 0 },
      { label: "Sun", value: 0 },
    ];

    const today = new Date();
    const dayOfWeek = today.getDay();

    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);

    monday.setDate(today.getDate() + mondayOffset);

    monday.setHours(0, 0, 0, 0);

    expenses.forEach((expense) => {
      if (!expense.date) {
        return;
      }

      let expenseDate;

      if (typeof expense.date !== "string" && expense.date.toDate) {
        expenseDate = expense.date.toDate();
      } else {
        expenseDate = new Date(`${expense.date}T00:00:00`);
      }

      expenseDate.setHours(0, 0, 0, 0);

      const dayIndex = Math.floor(
        (expenseDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (dayIndex >= 0 && dayIndex < 7) {
        days[dayIndex].value += Number(expense.amount || 0);
      }
    });

    return days;
  }, [expenses]);

  const maxDailySpending = Math.max(
    ...spendingByDay.map((day) => day.value),
    1,
  );

  const spendingChartPoints = useMemo(() => {
    return spendingByDay.map((day, index) => {
      const x = index * 50;

      const y =
        day.value === 0 ? 145 : 145 - (day.value / maxDailySpending) * 120;

      return {
        x,
        y,
      };
    });
  }, [spendingByDay, maxDailySpending]);

  const spendingLinePath = spendingChartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");

  const spendingFillPath = `${spendingLinePath} L300 170 L0 170 Z`;

  const categorySpending = useMemo(() => {
    const categoryNames = [
      "Food",
      "Transport",
      "Shopping",
      "Bills",
      "Entertainment",
      "Health",
      "Travel",
      "Other",
    ];

    const categories = {};

    expenses.forEach((expense) => {
      const category = expense.category || "Other";

      categories[category] =
        (categories[category] || 0) + Number(expense.amount || 0);
    });

    return categoryNames
      .map((name, index) => ({
        name,
        value: categories[name] || 0,
        index,
      }))
      .sort((a, b) => b.value - a.value || a.index - b.index);
  }, [expenses]);

  const categoriesPerPage = 4;

  const categoryPageCount = Math.max(
    1,
    Math.ceil(categorySpending.length / categoriesPerPage),
  );

  const visibleCategories = categorySpending.slice(
    categoryPage * categoriesPerPage,
    categoryPage * categoriesPerPage + categoriesPerPage,
  );

  const maxCategorySpending = Math.max(
    ...categorySpending.map((category) => category.value),
    1,
  );

  function handleExpenseAdded() {
    setShowAddExpense(false);
  }

  return (
    <main className="home">
      <div className="home-content">
        <header className="home-header">
          <button
            className="home-menu-button"
            type="button"
            aria-label="Open menu"
            onClick={() => setShowMenu(true)}
          >
            <Menu size={20} strokeWidth={1.8} />
          </button>

          <div className="home-header-actions">
            <button
              className="home-notification-button"
              type="button"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              {hasUnreadNotifications ? (
                <BellDot size={19} strokeWidth={1.8} />
              ) : (
                <Bell size={19} strokeWidth={1.8} />
              )}
            </button>

            <button
              className="home-profile-button"
              type="button"
              aria-label="Profile"
              onClick={() => navigate("/profile")}
            >
              {user?.photoURL ? (
                <img
                  className="home-profile-image"
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User size={17} strokeWidth={1.8} />
              )}

              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{ display: "none" }}
                  onLoad={() => setProfileImageLoaded(true)}
                  onError={() => setProfileImageLoaded(false)}
                />
              )}
            </button>
          </div>
        </header>

        <section className="budget-card">
          {budget ? (
            <>
              <div className="budget-card-top">
                <span>Total spent</span>

                <button className="budget-period-button" type="button">
                  {budgetPeriod}
                </button>
              </div>

              <h1>₹{totalSpent.toLocaleString("en-IN")}</h1>

              <div className="budget-progress-info">
                <span>₹{remaining.toLocaleString("en-IN")} remaining</span>

                <span>{Math.round(percentageLeft)}% left</span>
              </div>

              <div className="budget-progress">
                <div
                  className="budget-progress-fill"
                  style={{
                    width: `${percentageSpent}%`,
                  }}
                />
              </div>

              <div className="budget-stats">
                <div>
                  <span>
                    {previousBudget
                      ? budget?.period === "daily"
                        ? "previous day"
                        : budget?.period === "weekly"
                          ? "last week"
                          : budget?.period === "monthly"
                            ? "last month"
                            : budget?.period === "yearly"
                              ? "last year"
                              : "previous"
                      : "previous"}
                  </span>

                  <strong
                    className={`saved-amount ${previousSpendingChangeStatus}`}
                  >
                    {previousSpendingChange === null
                      ? "—"
                      : `${previousSpendingChange > 0 ? "+" : ""}${Math.round(
                          previousSpendingChange,
                        )}%`}
                  </strong>
                </div>

                <div>
                  <span>saved</span>

                  <strong className={`saved-amount ${savingsStatus}`}>
                    ₹{remaining.toLocaleString("en-IN")}
                  </strong>
                </div>
              </div>

              <button
                className="add-expense-button"
                type="button"
                onClick={() => setShowAddExpense(true)}
              >
                <Plus size={15} strokeWidth={2} />
                ADD EXPENSE
              </button>
            </>
          ) : (
            <>
              <div className="budget-card-top">
                <span>Previous budget</span>

                <span className="budget-period-button">
                  {previousBudget
                    ? getPeriodLabel(previousBudget.period)
                    : "No budget"}
                </span>
              </div>

              <h1>₹{previousBudgetSpent.toLocaleString("en-IN")}</h1>

              <div className="budget-stats">
                <div>
                  <span>status</span>

                  <strong className="saved-amount">COMPLETED</strong>
                </div>

                <div>
                  <span>saved</span>

                  <strong className="saved-amount positive">
                    ₹
                    {previousBudget
                      ? Math.max(
                          Number(previousBudget.amount || 0) -
                            previousBudgetSpent,
                          0,
                        ).toLocaleString("en-IN")
                      : "0"}
                  </strong>
                </div>
              </div>

              <button
                className="add-expense-button"
                type="button"
                onClick={() => setShowCreateBudget(true)}
              >
                <Plus size={15} strokeWidth={2} />
                CREATE BUDGET
              </button>
            </>
          )}
        </section>

        <div className="analytics-tabs">
          <button
            className={`analytics-tab ${
              analyticsView === "category" ? "active" : ""
            }`}
            type="button"
            onClick={() => {
              setCategoryPage(0);
              setAnalyticsView("category");
            }}
          >
            Top Category
          </button>

          <button
            className={`analytics-tab ${
              analyticsView === "spending" ? "active" : ""
            }`}
            type="button"
            onClick={() => setAnalyticsView("spending")}
          >
            Spending Over Time
          </button>
        </div>

        <section className="analytics-card">
          {analyticsView === "spending" ? (
            <div className="spending-chart">
              <div className="chart-y-axis">
                <span>₹{maxDailySpending.toLocaleString("en-IN")}</span>

                <span>
                  ₹{Math.round(maxDailySpending * 0.66).toLocaleString("en-IN")}
                </span>

                <span>
                  ₹{Math.round(maxDailySpending * 0.33).toLocaleString("en-IN")}
                </span>

                <span>₹0</span>
              </div>

              <div className="chart-area">
                <div className="chart-grid">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <svg
                  className="spending-chart-svg"
                  viewBox="0 0 300 170"
                  preserveAspectRatio="none"
                  aria-label="Spending over time chart"
                >
                  <g className="spending-chart-reveal">
                    <path className="chart-fill" d={spendingFillPath} />

                    <path className="chart-path" d={spendingLinePath} />

                    {spendingChartPoints.map((point, index) => (
                      <circle key={index} cx={point.x} cy={point.y} r="3" />
                    ))}
                  </g>
                </svg>

                <div className="chart-x-axis">
                  {spendingByDay.map((day) => (
                    <span key={day.label}>{day.label}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="category-chart">
              <div className="category-y-axis">
                <span>₹{maxCategorySpending.toLocaleString("en-IN")}</span>

                <span>
                  ₹
                  {Math.round(maxCategorySpending * 0.8).toLocaleString(
                    "en-IN",
                  )}
                </span>

                <span>
                  ₹
                  {Math.round(maxCategorySpending * 0.6).toLocaleString(
                    "en-IN",
                  )}
                </span>

                <span>
                  ₹
                  {Math.round(maxCategorySpending * 0.4).toLocaleString(
                    "en-IN",
                  )}
                </span>

                <span>
                  ₹
                  {Math.round(maxCategorySpending * 0.2).toLocaleString(
                    "en-IN",
                  )}
                </span>

                <span>₹0</span>
              </div>

              <div className="category-chart-area">
                <div className="category-bars">
                  {visibleCategories.map((category) => (
                    <div className="category-bar-item" key={category.name}>
                      <span className="category-value">
                        {category.value > 0
                          ? `₹${category.value.toLocaleString("en-IN")}`
                          : ""}
                      </span>

                      <div
                        className="category-bar"
                        style={{
                          height:
                            category.value > 0
                              ? `${Math.max(
                                  5,
                                  (category.value / maxCategorySpending) * 100,
                                )}%`
                              : "0%",
                        }}
                      />

                      <span className="category-name">{category.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              {categoryPageCount > 1 && (
                <div className="category-pagination">
                  <button
                    className="category-pagination-button"
                    type="button"
                    aria-label="Previous categories"
                    disabled={categoryPage === 0}
                    onClick={() =>
                      setCategoryPage((currentPage) =>
                        Math.max(0, currentPage - 1),
                      )
                    }
                  >
                    <ChevronLeft size={15} strokeWidth={1.8} />
                  </button>

                  <span>
                    {categoryPage + 1} / {categoryPageCount}
                  </span>

                  <button
                    className="category-pagination-button"
                    type="button"
                    aria-label="Next categories"
                    disabled={categoryPage === categoryPageCount - 1}
                    onClick={() =>
                      setCategoryPage((currentPage) =>
                        Math.min(categoryPageCount - 1, currentPage + 1),
                      )
                    }
                  >
                    <ChevronRight size={15} strokeWidth={1.8} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="expenses-section">
          <div className="expenses-header">
            <h2>
              {todayExpenses.length === 0
                ? "No expenses today"
                : "Today's expenses"}
            </h2>

            <button
              className="view-expenses-button"
              type="button"
              aria-label="View all expenses"
              onClick={() => navigate("/expenses")}
            >
              <ArrowUpRight size={17} strokeWidth={1.8} />
            </button>
          </div>

          <div className="expense-list">
            {expensesLoading ? (
              <div className="expense-item">
                <div className="expense-details">
                  <strong>Loading expenses...</strong>
                </div>
              </div>
            ) : todayExpenses.length === 0 ? (
              <div className="expense-item">
                <div className="expense-details">
                  <strong>No expenses today</strong>

                  <span>Create a new expense to start tracking.</span>
                </div>

                <button
                  className="view-expenses-button"
                  type="button"
                  aria-label="Add expense"
                  onClick={() => setShowAddExpense(true)}
                >
                  <Plus size={17} strokeWidth={1.8} />
                </button>
              </div>
            ) : (
              todayExpenses.map((expense) => (
                <div className="expense-item" key={expense.id}>
                  <div className="expense-details">
                    <strong>{expense.name}</strong>

                    <span>{expense.category}</span>
                  </div>

                  <strong>
                    ₹{Number(expense.amount).toLocaleString("en-IN")}
                  </strong>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {showMenu && (
        <div className="home-menu-overlay" onClick={() => setShowMenu(false)}>
          <aside
            className="home-menu-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="home-menu-header">
              <strong>BETTER WALLET</strong>

              <button
                className="home-menu-close"
                type="button"
                aria-label="Close menu"
                onClick={() => setShowMenu(false)}
              >
                <X size={19} strokeWidth={1.8} />
              </button>
            </div>

            <nav className="home-menu-navigation">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  navigate("/home");
                }}
              >
                <WalletCards size={17} strokeWidth={1.8} />
                HOME
              </button>

              {budget && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/expenses");
                  }}
                >
                  <Receipt size={17} strokeWidth={1.8} />
                  EXPENSES
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  navigate("/budgets", {
                    state: { from: "menu" },
                  });
                }}
              >
                <WalletCards size={17} strokeWidth={1.8} />
                BUDGETS
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  navigate("/profile");
                }}
              >
                <User size={17} strokeWidth={1.8} />
                PROFILE
              </button>
            </nav>
          </aside>
        </div>
      )}
      {showAddExpense && (
        <AddExpense
          onClose={() => setShowAddExpense(false)}
          onExpenseAdded={handleExpenseAdded}
        />
      )}

      {showCreateBudget && (
        <BudgetSetup
          mode="modal"
          onClose={() => setShowCreateBudget(false)}
          onBudgetCreated={() => {
            setShowCreateBudget(false);
          }}
        />
      )}
    </main>
  );
}

export default Home;
