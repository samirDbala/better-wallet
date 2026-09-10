import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";

import {
  loginUser,
  loginWithGoogle,
  loginWithGithub,
  resetPassword,
} from "../firebase/auth";

import "../styles/auth.css";

function getSocialLoginError(error) {
  switch (error.code) {
    case "auth/popup-closed-by-user":
      return "The sign-in window was closed before completing login.";

    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Please allow popups and try again.";

    case "auth/cancelled-popup-request":
      return "Another sign-in window is already open.";

    case "auth/user-disabled":
      return "This account has been disabled.";

    case "auth/internal-error":
      return "Something went wrong while signing in. Please try again.";

    case "auth/account-exists-with-different-credential":
      return "An account already exists with the same email using a different sign-in method.";

    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase.";

    case "auth/unauthorized-domain":
      return "This website domain is not authorized in Firebase Authentication.";

    case "auth/invalid-credential":
      return "Sign-in could not be completed. Please try again.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";

    default:
      return error.message || "Unable to continue with this account.";
  }
}

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await loginUser(email.trim(), password);

      navigate("/", { replace: true });
    } catch (error) {
      console.error("Login error:", error);

      switch (error.code) {
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;

        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setError("Incorrect email or password.");
          break;

        case "auth/user-disabled":
          setError("This account has been disabled.");
          break;

        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;

        case "auth/network-request-failed":
          setError("Network error. Please check your internet connection.");
          break;

        default:
          setError("Unable to log in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await loginWithGoogle();

      navigate("/", { replace: true });
    } catch (error) {
      console.error("Google login error:", error);

      setError(getSocialLoginError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGithubLogin() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await loginWithGithub();

      navigate("/", { replace: true });
    } catch (error) {
      console.error("GitHub login error:", error);

      setError(getSocialLoginError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setResetLoading(true);

    try {
      await resetPassword(email.trim());

      setSuccess("Password reset email sent. Please check your inbox.");
    } catch (error) {
      console.error("Password reset error:", error);

      switch (error.code) {
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;

        case "auth/user-not-found":
          setError("No account was found with this email address.");
          break;

        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;

        case "auth/network-request-failed":
          setError("Network error. Please check your internet connection.");
          break;

        default:
          setError(`${error.code}: ${error.message}`);
      }
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-content">
        <button
          className="auth-back-button"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Go back"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>

        <p className="auth-eyebrow">WELCOME BACK</p>

        <h1>Log in</h1>

        <p className="auth-description">
          Your profile and wallet will stay together wherever you go.
        </p>

        <form className="auth-form" onSubmit={handleLogin}>
          <label htmlFor="login-email">Email</label>

          <div className="auth-password-field">
            <Mail
              size={17}
              strokeWidth={1.8}
              style={{
                position: "absolute",
                left: "14px",
                top: "14px",
                color: "#777",
              }}
            />

            <input
              id="login-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              style={{ paddingLeft: "42px" }}
              required
            />
          </div>

          <label htmlFor="login-password">Password</label>

          <div className="auth-password-field">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              className="auth-password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.8} />
              ) : (
                <Eye size={18} strokeWidth={1.8} />
              )}
            </button>
          </div>

          <button
            className="auth-forgot-button"
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading}
          >
            {resetLoading ? "SENDING..." : "Forgot password?"}
          </button>

          {error && <p className="auth-error">{error}</p>}

          {success && <p className="auth-success">{success}</p>}

          <button
            className="auth-primary-button"
            type="submit"
            disabled={loading || resetLoading}
          >
            {loading ? "LOGGING IN..." : "LOG IN"}
          </button>
        </form>

        <div className="auth-divider">
          <span />
          <p>OR</p>
          <span />
        </div>

        <button
          className="auth-social-button"
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || resetLoading}
        >
          <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
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
          CONTINUE WITH GOOGLE
        </button>

        <button
          className="auth-social-button"
          type="button"
          onClick={handleGithubLogin}
          disabled={loading || resetLoading}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
          </svg>
          CONTINUE WITH GITHUB
        </button>

        <p className="auth-switch">
          Don't have an account?{" "}
          <button type="button" onClick={() => navigate("/register")}>
            Create one
          </button>
        </p>
      </div>
    </main>
  );
}

export default Login;
