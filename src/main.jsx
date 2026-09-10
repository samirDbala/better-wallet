const savedTheme = localStorage.getItem("better-wallet-theme");

if (savedTheme === "dark") {
  document.body.classList.add("dark-theme");
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import "./styles/main.css";
import "./styles/dark-mode.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
