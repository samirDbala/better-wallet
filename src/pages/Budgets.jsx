import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Trash2,
  Check,
  X,
  Edit3,
  Repeat2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import {
  completeBudget,
  deleteAllBudgets,
  deleteBudget,
  holdBudget,
  listenToBudgets,
  resumeBudget,
  setBudgetRepeat,
} from "../firebase/budget";

import BudgetSetup from "./BudgetSetup";

import { formatCurrency } from "../utils/currency";

import "../styles/budgets.css";

function Budgets() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedBudget, setSelectedBudget] = useState(null);

  const [showCreateChoice, setShowCreateChoice] = useState(false);
  const [showCreateBudget, setShowCreateBudget] = useState(false);
  const [showEditBudget, setShowEditBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);

  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showDeleteAllConfirmation, setShowDeleteAllConfirmation] =
    useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setBudgets([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribe = listenToBudgets(
      user.uid,
      (updatedBudgets) => {
        setBudgets(updatedBudgets);
        setLoading(false);
      },
      (error) => {
        console.error("Unable to sync budgets:", error);
        setBudgets([]);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  function getDate(value) {
    if (!value) {
      return null;
    }

    if (typeof value !== "string" && value.toDate) {
      return value.toDate();
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = getDate(value);

    if (!date) {
      return "";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getPeriodLabel(period) {
    if (!period) {
      return "Budget";
    }

    return period.charAt(0).toUpperCase() + period.slice(1);
  }

  function isRunning(budget) {
    const now = new Date();

    const startDate = getDate(budget.startDate);
    const endDate = getDate(budget.endDate);

    if (!startDate) {
      return false;
    }

    if (budget.status === "held" || budget.status === "completed") {
      return false;
    }

    if (!endDate) {
      return startDate <= now;
    }

    return startDate <= now && now < endDate;
  }

  function isHeld(budget) {
    return budget.status === "held";
  }

  function isCompleted(budget) {
    if (budget.status === "completed") {
      return true;
    }

    if (budget.status === "held") {
      return false;
    }

    const endDate = getDate(budget.endDate);

    return endDate ? endDate <= new Date() : false;
  }

  const currentBudget = useMemo(() => {
    return budgets.find((budget) => isRunning(budget)) || null;
  }, [budgets]);

  const heldBudgets = useMemo(() => {
    return budgets.filter((budget) => isHeld(budget));
  }, [budgets]);

  const completedBudgets = useMemo(() => {
    return budgets.filter((budget) => isCompleted(budget));
  }, [budgets]);

  function openBudgetDetails(budget) {
    navigate(`/budgets/${budget.id}`);
  }

  function openBudgetActions(budget) {
    setSelectedBudget(budget);
  }

  function handleEditBudget() {
    if (!selectedBudget || isCompleted(selectedBudget)) {
      return;
    }

    setEditingBudget(selectedBudget);
    setSelectedBudget(null);
    setShowEditBudget(true);
  }

  function handleCreateBudget() {
    if (currentBudget) {
      setShowCreateChoice(true);
      return;
    }

    setShowCreateBudget(true);
  }

  async function handleHoldBudget() {
    if (!selectedBudget || !user) {
      return;
    }

    try {
      setActionLoading("hold");

      await holdBudget(user.uid, selectedBudget.id);

      setSelectedBudget(null);
    } catch (error) {
      console.error("Unable to hold budget:", error);
    } finally {
      setActionLoading("");
    }
  }

  async function handleResumeBudget() {
    if (!selectedBudget || !user) {
      return;
    }

    try {
      setActionLoading("resume");

      await resumeBudget(user.uid, selectedBudget.id);

      setSelectedBudget(null);
    } catch (error) {
      console.error("Unable to resume budget:", error);
    } finally {
      setActionLoading("");
    }
  }

  async function handleCompleteBudget() {
    if (!selectedBudget || !user) {
      return;
    }

    try {
      setActionLoading("complete");

      await completeBudget(user.uid, selectedBudget.id);

      setSelectedBudget(null);
    } catch (error) {
      console.error("Unable to complete budget:", error);
    } finally {
      setActionLoading("");
    }
  }

  async function handleToggleRepeat() {
    if (!selectedBudget || !user || isCompleted(selectedBudget)) {
      return;
    }

    const nextRepeatEnabled = !selectedBudget.repeatEnabled;

    try {
      setActionLoading("repeat");

      await setBudgetRepeat(user.uid, selectedBudget.id, nextRepeatEnabled);

      setSelectedBudget((currentBudget) => {
        if (!currentBudget) {
          return currentBudget;
        }

        return {
          ...currentBudget,
          repeatEnabled: nextRepeatEnabled,
        };
      });
    } catch (error) {
      console.error("Unable to update budget repeat setting:", error);
    } finally {
      setActionLoading("");
    }
  }

  async function handleDeleteAllBudgets() {
    if (!user || deletingAll) return;

    try {
      setDeletingAll(true);

      await deleteAllBudgets(user.uid);

      setSelectedBudget(null);
      setShowDeleteAllConfirmation(false);
      setShowHeaderMenu(false);
    } catch (error) {
      console.error("Delete all budgets error:", error);
    } finally {
      setDeletingAll(false);
    }
  }

  async function handleDeleteBudget() {
    if (!selectedBudget || !user) {
      return;
    }

    try {
      setDeleting(true);

      await deleteBudget(user.uid, selectedBudget.id);

      setSelectedBudget(null);
    } catch (error) {
      console.error("Unable to delete budget:", error);
    } finally {
      setDeleting(false);
    }
  }

  async function handleHoldAndCreate() {
    if (!currentBudget || !user) {
      return;
    }

    try {
      setActionLoading("create");

      await holdBudget(user.uid, currentBudget.id);

      setShowCreateChoice(false);
      setShowCreateBudget(true);
    } catch (error) {
      console.error("Unable to hold current budget:", error);
    } finally {
      setActionLoading("");
    }
  }

  async function handleDeleteAndCreate() {
    if (!currentBudget || !user) {
      return;
    }

    try {
      setActionLoading("create");

      await deleteBudget(user.uid, currentBudget.id);

      setShowCreateChoice(false);
      setShowCreateBudget(true);
    } catch (error) {
      console.error("Unable to delete current budget:", error);
    } finally {
      setActionLoading("");
    }
  }

  function handleBudgetCreated(createdBudget) {
    if (!createdBudget) {
      return;
    }

    setShowCreateBudget(false);
  }

  return (
    <main className="budgets-page">
      <div className="budgets-content">
        <header className="budgets-header">
          <button
            className="budgets-back-button"
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={21} strokeWidth={1.7} />
          </button>

          <h1>Budgets</h1>

          <button
            className="budgets-header-menu"
            type="button"
            aria-label="More options"
            onClick={() => setShowHeaderMenu(true)}
          >
            <MoreVertical size={20} strokeWidth={1.7} />
          </button>
        </header>

        <section className="budgets-section current-budget-section">
          <div className="budgets-section-heading">
            <h2>Current Budget</h2>

            <button
              className="budgets-add-button"
              type="button"
              onClick={handleCreateBudget}
              aria-label="Create budget"
            >
              <Plus size={17} strokeWidth={1.9} />
            </button>
          </div>

          {loading ? (
            <div className="budgets-loading" />
          ) : currentBudget ? (
            <article className="current-budget-card">
              <button
                className="current-budget-details"
                type="button"
                onClick={() => openBudgetDetails(currentBudget)}
              >
                <div className="budget-card-heading">
                  <div>
                    <span className="budget-period">
                      {getPeriodLabel(currentBudget.period)}
                    </span>

                    <h3>{formatCurrency(currentBudget.amount)}</h3>
                  </div>

                  <span className="budget-status">RUNNING</span>
                </div>

                <div className="budget-date-row">
                  <span>{formatDate(currentBudget.startDate)}</span>

                  <ChevronRight size={14} strokeWidth={1.5} />

                  <span>{formatDate(currentBudget.endDate)}</span>

                  {currentBudget.repeatEnabled && (
                    <Repeat2
                      className="budget-repeat-icon"
                      size={15}
                      strokeWidth={1.7}
                      aria-label="Repeating budget"
                    />
                  )}
                </div>

                <div className="budget-view-details">
                  <span>VIEW DETAILS</span>

                  <ChevronRight size={15} strokeWidth={1.7} />
                </div>
              </button>

              <button
                className="current-budget-menu"
                type="button"
                aria-label="Budget options"
                onClick={() => openBudgetActions(currentBudget)}
              >
                <MoreVertical size={18} strokeWidth={1.7} />
              </button>
            </article>
          ) : (
            <div className="budgets-empty-card">
              <strong>No active budget</strong>

              <span>Create a budget to start tracking your spending.</span>

              <button type="button" onClick={handleCreateBudget}>
                CREATE BUDGET
              </button>
            </div>
          )}
        </section>

        {heldBudgets.length > 0 && (
          <section className="budgets-section held-budget-section">
            <div className="budgets-section-heading">
              <h2>Held Budgets</h2>
            </div>

            <div className="completed-budget-list">
              {heldBudgets.map((budget) => (
                <article className="completed-budget-row" key={budget.id}>
                  <button
                    className="completed-budget-main"
                    type="button"
                    onClick={() => openBudgetDetails(budget)}
                  >
                    <div>
                      <strong>{formatCurrency(budget.amount)}</strong>

                      <span>{getPeriodLabel(budget.period)} • HELD</span>
                    </div>

                    <ChevronRight size={17} strokeWidth={1.7} />
                  </button>

                  <button
                    className="completed-budget-menu"
                    type="button"
                    aria-label="Budget options"
                    onClick={() => openBudgetActions(budget)}
                  >
                    <MoreVertical size={17} strokeWidth={1.7} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="budgets-section completed-budget-section">
          <div className="budgets-section-heading">
            <h2>Completed Budgets</h2>
          </div>

          {loading ? (
            <div className="budgets-loading-list">
              <div />
              <div />
            </div>
          ) : completedBudgets.length === 0 ? (
            <div className="completed-empty">
              <span>No completed budgets yet.</span>
            </div>
          ) : (
            <div className="completed-budget-list">
              {completedBudgets.map((budget) => (
                <article className="completed-budget-row" key={budget.id}>
                  <button
                    className="completed-budget-main"
                    type="button"
                    onClick={() => openBudgetDetails(budget)}
                  >
                    <div>
                      <strong>{formatCurrency(budget.amount)}</strong>

                      <span>
                        {getPeriodLabel(budget.period)} •{" "}
                        {formatDate(budget.startDate)}
                      </span>
                    </div>

                    <ChevronRight size={17} strokeWidth={1.7} />
                  </button>

                  <button
                    className="completed-budget-menu"
                    type="button"
                    aria-label="Budget options"
                    onClick={() => openBudgetActions(budget)}
                  >
                    <MoreVertical size={17} strokeWidth={1.7} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedBudget && (
        <div className="budgets-modal-overlay">
          <section
            className="budgets-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Budget options"
          >
            <header className="budgets-modal-header">
              <div>
                <h2>BUDGET OPTIONS</h2>
              </div>

              <button
                className="budgets-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (!deleting && actionLoading === "") {
                    setSelectedBudget(null);
                  }
                }}
                disabled={deleting || actionLoading !== ""}
              >
                <X size={22} strokeWidth={1.8} />
              </button>
            </header>

            <div className="selected-budget">
              <div>
                <strong>{formatCurrency(selectedBudget.amount)}</strong>

                <span>{getPeriodLabel(selectedBudget.period)}</span>
              </div>

              <span>
                {isHeld(selectedBudget)
                  ? "HELD"
                  : isCompleted(selectedBudget)
                    ? "COMPLETED"
                    : "RUNNING"}
              </span>
            </div>

            {!isCompleted(selectedBudget) && (
              <button
                className="budget-sheet-action"
                type="button"
                onClick={handleEditBudget}
                disabled={actionLoading !== "" || deleting}
              >
                <Edit3 size={15} strokeWidth={1.8} />
                EDIT BUDGET
              </button>
            )}

            {!isCompleted(selectedBudget) &&
              !isHeld(selectedBudget) &&
              selectedBudget.period !== "custom" && (
                <button
                  className="budget-sheet-action"
                  type="button"
                  onClick={handleToggleRepeat}
                  disabled={actionLoading !== "" || deleting}
                >
                  <Repeat2 size={15} strokeWidth={1.8} />

                  {actionLoading === "repeat"
                    ? "PLEASE WAIT..."
                    : selectedBudget.repeatEnabled
                      ? "REPEAT BUDGET: ON"
                      : "REPEAT BUDGET: OFF"}
                </button>
              )}

            {isRunning(selectedBudget) && (
              <>
                <button
                  className="budget-sheet-action"
                  type="button"
                  onClick={handleHoldBudget}
                  disabled={actionLoading !== "" || deleting}
                >
                  <Pause size={15} strokeWidth={1.8} />

                  {actionLoading === "hold" ? "PLEASE WAIT..." : "HOLD BUDGET"}
                </button>

                <button
                  className="budget-sheet-action"
                  type="button"
                  onClick={handleCompleteBudget}
                  disabled={actionLoading !== "" || deleting}
                >
                  <Check size={15} strokeWidth={1.8} />

                  {actionLoading === "complete"
                    ? "PLEASE WAIT..."
                    : "COMPLETE EARLY"}
                </button>
              </>
            )}

            {isHeld(selectedBudget) && (
              <button
                className="budget-sheet-action"
                type="button"
                onClick={handleResumeBudget}
                disabled={actionLoading !== "" || deleting}
              >
                <Play size={15} strokeWidth={1.8} />

                {actionLoading === "resume" ? "RESUMING..." : "RESUME BUDGET"}
              </button>
            )}

            <button
              className="budget-delete-action"
              type="button"
              onClick={handleDeleteBudget}
              disabled={deleting || actionLoading !== ""}
            >
              <Trash2 size={15} strokeWidth={1.8} />

              {deleting ? "DELETING..." : "DELETE BUDGET"}
            </button>

            <button
              className="budget-cancel-action"
              type="button"
              onClick={() => setSelectedBudget(null)}
              disabled={deleting || actionLoading !== ""}
            >
              CANCEL
            </button>
          </section>
        </div>
      )}

      {showHeaderMenu && (
        <div className="budgets-modal-overlay">
          <section
            className="budgets-action-sheet budgets-header-menu-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Budget options"
          >
            <header className="budgets-modal-header">
              <h2>BUDGET OPTIONS</h2>

              <button
                className="budgets-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setShowHeaderMenu(false)}
              >
                <X size={22} strokeWidth={1.8} />
              </button>
            </header>

            <button
              className="budget-delete-action"
              type="button"
              onClick={() => {
                setShowHeaderMenu(false);
                setShowDeleteAllConfirmation(true);
              }}
            >
              <Trash2 size={15} strokeWidth={1.8} />
              DELETE ALL BUDGETS
            </button>
            <button
              className="budget-cancel-action"
              type="button"
              onClick={() => setShowHeaderMenu(false)}
            >
              CANCEL
            </button>
          </section>
        </div>
      )}

      {showCreateChoice && (
        <div className="budgets-modal-overlay">
          <section
            className="budgets-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Create budget"
          >
            <header className="budgets-modal-header">
              <h2>CREATE BUDGET</h2>

              <button
                className="budgets-modal-close"
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (!actionLoading) {
                    setShowCreateChoice(false);
                  }
                }}
                disabled={actionLoading}
              >
                <X size={22} strokeWidth={1.8} />
              </button>
            </header>

            <div className="budget-create-choice">
              <h2>Current budget is running</h2>

              <p>
                Hold or delete the current budget before creating a new one.
              </p>
            </div>

            <button
              className="budget-sheet-action"
              type="button"
              onClick={handleHoldAndCreate}
              disabled={actionLoading}
            >
              <Pause size={15} strokeWidth={1.8} />
              {actionLoading ? "PLEASE WAIT..." : "HOLD & CREATE"}
            </button>

            <button
              className="budget-delete-action"
              type="button"
              onClick={handleDeleteAndCreate}
              disabled={actionLoading}
            >
              <Trash2 size={15} strokeWidth={1.8} />
              {actionLoading ? "PLEASE WAIT..." : "DELETE & CREATE"}
            </button>
          </section>
        </div>
      )}

      {showCreateBudget && (
        <BudgetSetup
          mode="modal"
          onClose={() => setShowCreateBudget(false)}
          onBudgetCreated={handleBudgetCreated}
        />
      )}
      {showEditBudget && editingBudget && (
        <BudgetSetup
          mode="modal"
          editBudget={editingBudget}
          onClose={() => {
            setShowEditBudget(false);
            setEditingBudget(null);
          }}
          onBudgetCreated={() => {
            setShowEditBudget(false);
            setEditingBudget(null);
          }}
        />
      )}
      {showDeleteAllConfirmation && (
        <div className="budgets-modal-overlay">
          <section
            className="budgets-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Delete all budgets"
          >
            <div className="budget-create-choice">
              <h2>Delete all budgets?</h2>

              <p>
                This will permanently delete all budgets, their expenses, and
                notifications.
              </p>
            </div>

            <button
              className="budget-delete-action"
              type="button"
              onClick={handleDeleteAllBudgets}
              disabled={deletingAll}
            >
              <Trash2 size={15} strokeWidth={1.8} />
              {deletingAll ? "DELETING..." : "DELETE ALL BUDGETS"}
            </button>

            <button
              className="budget-cancel-action"
              type="button"
              onClick={() => setShowDeleteAllConfirmation(false)}
              disabled={deletingAll}
            >
              CANCEL
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default Budgets;
