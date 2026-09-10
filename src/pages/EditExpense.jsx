import { useEffect, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { listenToExpenses, updateExpense } from "../firebase/expense";

import "../styles/edit-expense.css";

function EditExpense() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const expense = location.state?.expense;

  const [name, setName] = useState(expense?.name || "");
  const [amount, setAmount] = useState(
    expense?.amount !== undefined ? String(expense.amount) : "",
  );
  const [category, setCategory] = useState(expense?.category || "Food");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expenseExists, setExpenseExists] = useState(Boolean(expense));

  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!user?.uid || !expense?.id || !expense?.budgetId) {
      return undefined;
    }

    const unsubscribe = listenToExpenses(
      user.uid,
      expense.budgetId,
      (updatedExpenses) => {
        const updatedExpense = updatedExpenses.find(
          (item) => item.id === expense.id,
        );

        setExpenseExists(Boolean(updatedExpense));
      },
      (error) => {
        console.error("Unable to sync expense:", error);
      },
    );

    return unsubscribe;
  }, [user, expense]);

  function closeSheet() {
    navigate(-1);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user) {
      setError("Please log in before editing an expense.");
      return;
    }

    if (!expense?.id) {
      setError("Expense could not be found.");
      return;
    }

    if (!expenseExists) {
      setError("This expense no longer exists.");
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

    try {
      await updateExpense(user.uid, expense.id, {
        name: name.trim(),
        amount,
        category,
        date: expense.date,
      });

      navigate("/expenses", { replace: true });
    } catch (error) {
      console.error("Unable to update expense:", error);
      setError("Unable to update expense. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!expense) {
    return (
      <div className="edit-expense-overlay">
        <section className="edit-expense-sheet edit-expense-error-sheet">
          <header className="edit-expense-sheet-header">
            <h1>EDIT EXPENSE</h1>

            <button
              className="edit-expense-close-button"
              type="button"
              aria-label="Close"
              onClick={closeSheet}
            >
              <X size={22} strokeWidth={1.8} />
            </button>
          </header>

          <div className="edit-expense-error-message">
            <strong>Expense not found</strong>
            <span>This expense could not be loaded for editing.</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="edit-expense-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Edit expense"
    >
      <section className="edit-expense-sheet">
        <header className="edit-expense-sheet-header">
          <h1>EDIT EXPENSE</h1>

          <button
            className="edit-expense-close-button"
            type="button"
            aria-label="Close"
            onClick={closeSheet}
            disabled={saving}
          >
            <X size={22} strokeWidth={1.8} />
          </button>
        </header>

        <form className="edit-expense-form" onSubmit={handleSubmit}>
          <div className="edit-expense-field">
            <label htmlFor="edit-expense-name">Expense Name</label>

            <input
              id="edit-expense-name"
              type="text"
              placeholder="e.g. January"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="edit-expense-field">
            <label htmlFor="edit-expense-amount">Amount</label>

            <div className="edit-expense-amount-wrapper">
              <span>₹</span>

              <input
                id="edit-expense-amount"
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

          <div className="edit-expense-field">
            <label htmlFor="edit-expense-category">Select Category</label>

            <div className="edit-expense-select-wrapper">
              <select
                id="edit-expense-category"
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

          {error && <p className="edit-expense-error">{error}</p>}

          <button
            className="edit-expense-submit"
            type="submit"
            disabled={saving || !expenseExists}
          >
            <Check size={17} strokeWidth={1.8} />

            {saving ? "SAVING..." : "SAVE CHANGES"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default EditExpense;
