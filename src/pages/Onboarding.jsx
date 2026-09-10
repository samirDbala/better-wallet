import { useNavigate } from "react-router-dom";
import WalletIllustration from "../components/WalletIllustration";
import "../styles/onboarding.css";

function Onboarding() {
  const navigate = useNavigate();

  function handleGetStarted() {
    navigate("/register");
  }

  function handleExistingAccount() {
    navigate("/login");
  }

  return (
    <main className="onboarding">
      <div className="onboarding-content">
        <WalletIllustration />

        <h1>Just spent the money!</h1>

        <p className="onboarding-text">
          <span>Don’t worry about managing it. We’ll take</span>
          <span>care of the rest.</span>
        </p>

        <div className="onboarding-actions">
          <button
            className="onboarding-button"
            type="button"
            onClick={handleGetStarted}
          >
            GET STARTED
          </button>

          <button
            className="onboarding-account-button"
            type="button"
            onClick={handleExistingAccount}
          >
            ALREADY HAVE AN ACCOUNT
          </button>
        </div>
      </div>
    </main>
  );
}

export default Onboarding;
