import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedLayout from "./layouts/ProtectedLayout";

import EntryRoute from "./components/EntryRoute";
import BudgetRoute from "./components/BudgetRoute";
import PublicRoute from "./components/PublicRoute";

import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BudgetSetup from "./pages/BudgetSetup";
import Home from "./pages/Home";
import AddExpense from "./pages/AddExpense";
import Expenses from "./pages/Expenses";
import EditExpense from "./pages/EditExpense";
import Profile from "./pages/Profile";
import Budgets from "./pages/Budgets";
import BudgetDetails from "./pages/BudgetDetails";
import Notifications from "./pages/Notifications";
import Reauthenticate from "./pages/Reauthenticate";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}

        <Route path="/" element={<EntryRoute />} />

        <Route element={<PublicRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected pages */}

        <Route element={<ProtectedLayout />}>
          <Route path="/budget-setup" element={<BudgetSetup />} />

          {/* Pages that work without an active budget */}

          <Route path="/home" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/budgets/:budgetId" element={<BudgetDetails />} />

          <Route path="/reauthenticate" element={<Reauthenticate />} />

          {/* Pages that require an active budget */}

          <Route element={<BudgetRoute />}>
            <Route path="/add-expense" element={<AddExpense />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expenses/edit" element={<EditExpense />} />
          </Route>
        </Route>

        {/* Unknown routes */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
