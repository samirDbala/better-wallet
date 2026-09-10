import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { auth } from "../firebase/config";

import {
  reauthenticatePasswordUser,
  reauthenticateGoogleUser,
  reauthenticateGithubUser,
} from "../firebase/reauthenticate";

import { deleteAccountCompletely } from "../firebase/deleteAccount";

import "../styles/reauthenticate.css";

function Reauthenticate() {
  const navigate = useNavigate();

  const user = auth.currentUser;

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const providerId = useMemo(() => {
    if (!user) {
      return "password";
    }

    const providerIds = user.providerData.map(
      (provider) => provider.providerId,
    );

    if (providerIds.includes("google.com")) {
      return "google.com";
    }

    if (providerIds.includes("github.com")) {
      return "github.com";
    }

    return "password";
  }, [user]);

  const providerName =
    providerId === "google.com"
      ? "Google"
      : providerId === "github.com"
        ? "GitHub"
        : "Email & Password";

  const subtitle =
    providerId === "google.com"
      ? "For security reasons, please verify your Google account before deleting your account."
      : providerId === "github.com"
        ? "For security reasons, please verify your GitHub account before deleting your account."
        : "For security reasons, please confirm your password before deleting your account.";

  async function handleDelete(reauthenticate) {
    if (isDeleting) {
      return;
    }

    setError("");
    setIsDeleting(true);

    try {
      await reauthenticate();

      await deleteAccountCompletely();

      navigate("/onboarding", { replace: true });
    } catch (error) {
      console.error("Account deletion error:", error);

      switch (error.code) {
        case "auth/wrong-password":
          setError("Incorrect password. Please try again.");
          break;

        case "auth/invalid-credential":
          if (providerId === "password") {
            setError("Incorrect password. Please try again.");
          } else {
            setError(
              `Unable to verify your ${providerName} account. Please try again.`,
            );
          }
          break;
        case "auth/user-mismatch":
          setError(
            "The selected account does not match your Better Wallet account.",
          );
          break;

        case "auth/popup-closed-by-user":
          setError(
            "The sign-in window was closed before completing verification.",
          );
          break;

        case "auth/popup-blocked":
          setError(
            "Your browser blocked the sign-in window. Please allow popups and try again.",
          );
          break;

        case "auth/cancelled-popup-request":
          setError("Another sign-in window is already open.");
          break;

        case "auth/unauthorized-domain":
          setError(
            "This website domain is not authorized in Firebase Authentication.",
          );
          break;

        case "auth/network-request-failed":
          setError("Network error. Please check your internet connection.");
          break;

        case "auth/requires-recent-login":
          setError(
            "Your session has expired. Please sign in again and try deleting your account.",
          );
          break;

        case "auth/user-disabled":
          setError("This account has been disabled.");
          break;

        default:
          setError("Unable to delete your account. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  }

  async function handlePasswordVerification(event) {
    event.preventDefault();

    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    await handleDelete(() => reauthenticatePasswordUser(password));
  }

  async function handleGoogleVerification() {
    await handleDelete(reauthenticateGoogleUser);
  }

  async function handleGithubVerification() {
    await handleDelete(reauthenticateGithubUser);
  }

  if (!user) {
    return null;
  }

  return (
    <main className="reauthenticate-page">
      <div className="reauthenticate-content">
        <header className="reauthenticate-header">
          <button
            className="reauthenticate-back-button"
            type="button"
            aria-label="Go back"
            onClick={() => navigate("/profile")}
            disabled={isDeleting}
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>

          <h1>Verify Your Identity</h1>

          <div className="reauthenticate-header-space" />
        </header>

        <section className="reauthenticate-intro">
          <h2>
            Before deleting your <span>account</span>
          </h2>

          <p>{subtitle}</p>
        </section>

        <section className="reauthenticate-card">
          <div className="reauthenticate-provider-icon">
            {providerId === "password" && <Mail size={25} strokeWidth={1.7} />}

            {providerId === "google.com" && (
              <svg
                className="reauthenticate-google-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M21.35 12.27c0-.79-.07-1.55-.23-2.27H12v4.3h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.93-4.18 2.93-7.39Z"
                />

                <path
                  fill="#34A853"
                  d="M12 21.99c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.5A9.74 9.74 0 0 0 12 21.99Z"
                />

                <path
                  fill="#FBBC05"
                  d="M6.51 14.08A5.85 5.85 0 0 1 6.2 12c0-.72.12-1.42.31-2.08v-2.5H3.27A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.27 4.5l3.24-2.42Z"
                />

                <path
                  fill="#EA4335"
                  d="M12 5.88c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 2.96 14.63 2 12 2a9.74 9.74 0 0 0-8.73 5.42l3.24 2.5C7.29 7.6 9.45 5.88 12 5.88Z"
                />
              </svg>
            )}

            {providerId === "github.com" && (
              <svg
                className="reauthenticate-github-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z"
                />
              </svg>
            )}
          </div>

          <span className="reauthenticate-signed-in">
            You are signed in with
          </span>

          <strong className="reauthenticate-provider-name">
            {providerName}
          </strong>

          <div className="reauthenticate-divider">
            <span />
            <ShieldCheck size={17} strokeWidth={1.8} />
            <span />
          </div>

          {providerId === "password" && (
            <form
              className="reauthenticate-form"
              onSubmit={handlePasswordVerification}
            >
              <label htmlFor="reauthenticate-password">
                Enter your password
              </label>

              <div className="reauthenticate-password-box">
                <input
                  id="reauthenticate-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  autoComplete="current-password"
                  disabled={isDeleting}
                />

                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={isDeleting}
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.8} />
                  ) : (
                    <Eye size={18} strokeWidth={1.8} />
                  )}
                </button>
              </div>

              <button
                className="reauthenticate-primary-button"
                type="submit"
                disabled={isDeleting}
              >
                <Trash2 size={15} strokeWidth={1.8} />

                {isDeleting ? "DELETING ACCOUNT..." : "VERIFY & DELETE ACCOUNT"}
              </button>
            </form>
          )}

          {providerId === "google.com" && (
            <div className="reauthenticate-provider-content">
              <p>
                To continue, please re-authenticate with Google. A secure Google
                sign-in window will open.
              </p>

              <button
                className="reauthenticate-primary-button"
                type="button"
                onClick={handleGoogleVerification}
                disabled={isDeleting}
              >
                <svg
                  className="reauthenticate-google-button-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M21.35 12.27c0-.79-.07-1.55-.23-2.27H12v4.3h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.93-4.18 2.93-7.39Z"
                  />

                  <path
                    fill="#34A853"
                    d="M12 21.99c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.5A9.74 9.74 0 0 0 12 21.99Z"
                  />

                  <path
                    fill="#FBBC05"
                    d="M6.51 14.08A5.85 5.85 0 0 1 6.2 12c0-.72.12-1.42.31-2.08v-2.5H3.27A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.27 4.5l3.24-2.42Z"
                  />

                  <path
                    fill="#EA4335"
                    d="M12 5.88c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 2.96 14.63 2 12 2a9.74 9.74 0 0 0-8.73 5.42l3.24 2.5C7.29 7.6 9.45 5.88 12 5.88Z"
                  />
                </svg>

                {isDeleting ? "DELETING ACCOUNT..." : "CONTINUE WITH GOOGLE"}
              </button>
            </div>
          )}

          {providerId === "github.com" && (
            <div className="reauthenticate-provider-content">
              <p>
                To continue, please re-authenticate with GitHub. A secure GitHub
                sign-in window will open.
              </p>

              <button
                className="reauthenticate-primary-button"
                type="button"
                onClick={handleGithubVerification}
                disabled={isDeleting}
              >
                <svg
                  className="reauthenticate-github-button-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z"
                  />
                </svg>

                {isDeleting ? "DELETING ACCOUNT..." : "CONTINUE WITH GITHUB"}
              </button>
            </div>
          )}

          {error && (
            <div className="reauthenticate-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="reauthenticate-cancel-button"
            type="button"
            onClick={() => navigate("/profile")}
            disabled={isDeleting}
          >
            CANCEL
          </button>

          <div className="reauthenticate-warning">
            <Trash2 size={18} strokeWidth={1.8} />

            <div>
              <strong>Account deletion is permanent.</strong>

              <span>
                All your budgets, expenses, notifications, and account data will
                be deleted and cannot be recovered.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Reauthenticate;
