import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { auth } from "../firebase/config";
import { listenToBudgets } from "../firebase/budget";
import { useAuth } from "../context/AuthContext";

import "../styles/profile.css";

function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [hasActiveBudget, setHasActiveBudget] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("better-wallet-theme");

    setIsDarkMode(savedTheme === "dark");
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setHasActiveBudget(false);
      return undefined;
    }

    const unsubscribe = listenToBudgets(
      user.uid,
      (updatedBudgets) => {
        const now = new Date();

        const activeBudget = updatedBudgets.some((budget) => {
          if (
            !budget.startDate ||
            !budget.endDate ||
            budget.status === "held" ||
            budget.status === "completed"
          ) {
            return false;
          }

          const startDate = budget.startDate.toDate();
          const endDate = budget.endDate.toDate();

          return startDate <= now && now < endDate;
        });

        setHasActiveBudget(activeBudget);

        setHasActiveBudget(activeBudget);
      },
      (error) => {
        console.error("Unable to sync active budget:", error);
        setHasActiveBudget(false);
      },
    );

    return unsubscribe;
  }, [user]);

  function handleThemeToggle() {
    const nextTheme = !isDarkMode;

    setIsDarkMode(nextTheme);

    if (nextTheme) {
      document.body.classList.add("dark-theme");
      localStorage.setItem("better-wallet-theme", "dark");
    } else {
      document.body.classList.remove("dark-theme");
      localStorage.setItem("better-wallet-theme", "light");
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);

      await signOut(auth);

      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Unable to log out:", error);
      setLoggingOut(false);
    }
  }

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";

  const email = user?.email || "";

  return (
    <main className="profile-page">
      <div className="profile-content">
        <header className="profile-header">
          <button
            className="profile-back-button"
            type="button"
            aria-label="Go back"
            onClick={() => navigate("/home", { replace: true })}
          >
            <ArrowLeft size={21} strokeWidth={1.7} />
          </button>

          <h1>Profile</h1>

          <div className="profile-header-space" />
        </header>

        <section className="profile-identity">
          <div className="profile-avatar">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <User size={28} strokeWidth={1.5} />
            )}
          </div>

          <h2>{displayName}</h2>
          <p>{email}</p>
        </section>

        <section className="profile-preference">
          <h2>Preference</h2>

          <div className="profile-theme-row">
            <div className="profile-theme-info">
              <strong>Theme</strong>
            </div>

            <button
              className={`profile-theme-toggle ${isDarkMode ? "active" : ""}`}
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              onClick={handleThemeToggle}
            >
              <span className="profile-theme-toggle-track">
                <span className="profile-theme-toggle-thumb">
                  {isDarkMode ? (
                    <Moon size={12} strokeWidth={1.8} />
                  ) : (
                    <Sun size={12} strokeWidth={1.8} />
                  )}
                </span>
              </span>

              <span className="profile-theme-label">
                {isDarkMode ? "DARK" : "LIGHT"}
              </span>
            </button>
          </div>
        </section>

        <section className="profile-links">
          <h2>Useful links</h2>

          <button
            className="profile-link-row"
            type="button"
            onClick={() => navigate("/budgets")}
          >
            <div>
              <strong>Budgets</strong>
              <span>see all the budgets</span>
            </div>

            <ChevronRight size={18} strokeWidth={1.7} />
          </button>

          {hasActiveBudget && (
            <button
              className="profile-link-row"
              type="button"
              onClick={() => navigate("/expenses")}
            >
              <div>
                <strong>Expenses</strong>
                <span>see all the expenses</span>
              </div>

              <ChevronRight size={18} strokeWidth={1.7} />
            </button>
          )}
        </section>

        <section className="profile-danger">
          <h2>Danger Zone</h2>

          <div className="profile-danger-row">
            <div>
              <strong>Log out</strong>
              <span>Log out from this device</span>
            </div>

            <button
              className="profile-logout-button"
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut size={14} strokeWidth={1.8} />
              {loggingOut ? "LOGGING OUT..." : "LOG OUT"}
            </button>
          </div>

          <div className="profile-delete-row">
            <div>
              <strong>Delete Account</strong>
              <span>This will delete all your data and the account</span>
            </div>

            <button
              className="profile-delete-button"
              type="button"
              onClick={() => navigate("/reauthenticate")}
            >
              <Trash2 size={14} strokeWidth={1.8} />
              DELETE
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Profile;
