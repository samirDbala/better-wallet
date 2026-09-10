import { useEffect, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { listenToBudgets } from "../firebase/budget";
import { createExpense } from "../firebase/expense";

import "../styles/add-expense.css";

function AddExpense({ onClose, onExpenseAdded }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [budget, setBudget] = useState(null);
  const [loadingBudget, setLoadingBudget] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");

  useEffect(() => {
    if (!user?.uid) {
      setBudget(null);
      setLoadingBudget(false);
      return undefined;
    }

    setLoadingBudget(true);

    const unsubscribe = listenToBudgets(
      user.uid,
      (updatedBudgets) => {
        const now = new Date();

        const activeBudget =
          updatedBudgets
            .filter((item) => {
              if (
                !item.startDate ||
                !item.endDate ||
                item.status === "held" ||
                item.status === "completed"
              ) {
                return false;
              }

              const startDate = item.startDate.toDate();
              const endDate = item.endDate.toDate();

              return startDate <= now && now < endDate;
            })
            .sort((a, b) => {
              const aTime =
                a.createdAt?.toMillis?.() ?? a.startDate?.toMillis?.() ?? 0;

              const bTime =
                b.createdAt?.toMillis?.() ?? b.startDate?.toMillis?.() ?? 0;

              return bTime - aTime;
            })[0] || null;

        setBudget(activeBudget);
        setLoadingBudget(false);
      },
      (error) => {
        console.error("Unable to sync budget:", error);
        setBudget(null);
        setLoadingBudget(false);
        setError("Unable to load your budget.");
      },
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function closeSheet() {
    if (onClose) {
      onClose();
      return;
    }

    navigate(-1);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user) {
      setError("Please log in before adding an expense.");
      return;
    }

    if (!budget) {
      setError("You don't have an active budget.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter an expense name.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setError("");
    setSaving(true);

    const today = new Date();

    const todayString = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    try {
      const expenseId = await createExpense(user.uid, {
        budgetId: budget.id,
        name: name.trim(),
        amount,
        category,
        date: todayString,
      });

      const newExpense = {
        id: expenseId,
        userId: user.uid,
        budgetId: budget.id,
        name: name.trim(),
        amount: Number(amount),
        category,
        date: todayString,
      };

      if (onExpenseAdded) {
        onExpenseAdded(newExpense);
      }

      closeSheet();
    } catch (error) {
      console.error("Unable to create expense:", error);
      setError("Unable to add expense. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="add-expense-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add expense"
    >
      <section className="add-expense-sheet">
        <div className="add-expense-handle" />

        <header className="add-expense-sheet-header">
          <h1>ADD YOUR EXPENSES</h1>

          <button
            className="add-expense-close-button"
            type="button"
            aria-label="Close"
            onClick={closeSheet}
          >
            <X size={22} strokeWidth={1.8} />
          </button>
        </header>

        {loadingBudget ? (
          <div className="add-expense-loading">Loading...</div>
        ) : (
          <form className="add-expense-form" onSubmit={handleSubmit}>
            <div className="add-expense-field">
              <label htmlFor="expense-name">Expense Name</label>

              <input
                id="expense-name"
                type="text"
                placeholder="e.g. January"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="add-expense-field">
              <label htmlFor="expense-amount">Amount</label>

              <div className="add-expense-amount-wrapper">
                <span>₹</span>

                <input
                  id="expense-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="3500"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="add-expense-field">
              <label htmlFor="expense-category">Select Category</label>

              <div className="add-expense-select-wrapper">
                <select
                  id="expense-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Bills">Bills</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Health">Health</option>
                  <option value="Travel">Travel</option>
                  <option value="Other">Other</option>
                </select>

                <ChevronDown size={18} strokeWidth={1.7} />
              </div>
            </div>

            {error && <p className="add-expense-error">{error}</p>}

            <button
              className="add-expense-submit"
              type="submit"
              disabled={saving || !budget}
            >
              <Plus size={17} strokeWidth={1.8} />

              {saving ? "ADDING..." : "ADD EXPENSE"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

export default AddExpense;
