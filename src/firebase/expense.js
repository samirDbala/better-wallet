import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./config";

import { getActiveBudget } from "./budget";

import {
  createBudgetAlertNotification,
  createExpenseNotification,
  deleteNotificationsByExpense,
  syncBudgetAlertNotifications,
} from "./notifications";

export async function createExpense(userId, expenseData) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const expenseRef = await addDoc(collection(db, "users", userId, "expenses"), {
    userId,
    budgetId: expenseData.budgetId,
    name: expenseData.name,
    amount: Number(expenseData.amount),
    category: expenseData.category,
    date: expenseData.date,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await createExpenseNotification(
      userId,
      expenseRef.id,
      expenseData.budgetId,
      expenseData.name,
      expenseData.amount,
    );
  } catch (error) {
    console.error("Unable to create expense notification:", error);
  }

  try {
    const activeBudget = await getActiveBudget(userId);

    if (activeBudget && activeBudget.id === expenseData.budgetId) {
      const budgetExpenses = await getExpenses(userId, expenseData.budgetId);

      const totalSpent = budgetExpenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      );

      const newExpenseAmount = Number(expenseData.amount || 0);
      const previousTotalSpent = totalSpent - newExpenseAmount;

      const budgetAmount = Number(activeBudget.amount);

      const previousPercentage =
        budgetAmount > 0 ? (previousTotalSpent / budgetAmount) * 100 : 0;

      const currentPercentage =
        budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

      if (
        previousPercentage < 80 &&
        currentPercentage >= 80 &&
        currentPercentage < 90
      ) {
        await createBudgetAlertNotification(
          userId,
          activeBudget.id,
          80,
          budgetAmount,
          totalSpent,
        );
      }

      if (
        previousPercentage < 90 &&
        currentPercentage >= 90 &&
        currentPercentage < 100
      ) {
        await createBudgetAlertNotification(
          userId,
          activeBudget.id,
          90,
          budgetAmount,
          totalSpent,
        );
      }

      if (currentPercentage >= 100) {
        await createBudgetAlertNotification(
          userId,
          activeBudget.id,
          100,
          budgetAmount,
          totalSpent,
        );
      }
    }
  } catch (error) {
    console.error("Unable to create budget alert:", error);
  }

  return expenseRef.id;
}

export async function getExpenses(userId, budgetId) {
  if (!userId || !budgetId) {
    return [];
  }

  const expensesRef = collection(db, "users", userId, "expenses");

  const expensesQuery = query(expensesRef, where("budgetId", "==", budgetId));

  const snapshot = await getDocs(expensesQuery);

  const expenses = snapshot.docs.map((expenseDoc) => ({
    id: expenseDoc.id,
    ...expenseDoc.data(),
  }));

  expenses.sort((a, b) => {
    const aDate = a.date || "";
    const bDate = b.date || "";

    return bDate.localeCompare(aDate);
  });

  return expenses;
}

export function listenToExpenses(userId, budgetId, callback, onError) {
  if (!userId || !budgetId) {
    callback([]);
    return () => {};
  }

  const expensesRef = collection(db, "users", userId, "expenses");

  const expensesQuery = query(expensesRef, where("budgetId", "==", budgetId));

  return onSnapshot(
    expensesQuery,
    (snapshot) => {
      const expenses = snapshot.docs.map((expenseDoc) => ({
        id: expenseDoc.id,
        ...expenseDoc.data(),
      }));

      expenses.sort((a, b) => {
        const aDate = a.date || "";
        const bDate = b.date || "";

        return bDate.localeCompare(aDate);
      });

      callback(expenses);
    },
    (error) => {
      console.error("Unable to listen to expenses:", error);

      if (onError) {
        onError(error);
      }
    },
  );
}

export async function updateExpense(userId, expenseId, expenseData) {
  if (!userId || !expenseId) {
    throw new Error("User ID and expense ID are required.");
  }

  const expenseRef = doc(db, "users", userId, "expenses", expenseId);

  const expenseSnapshot = await getDoc(expenseRef);

  if (!expenseSnapshot.exists()) {
    throw new Error("Expense could not be found.");
  }

  const existingExpense = expenseSnapshot.data();

  await updateDoc(expenseRef, {
    name: expenseData.name,
    amount: Number(expenseData.amount),
    category: expenseData.category,
    date: expenseData.date,
    updatedAt: serverTimestamp(),
  });

  try {
    await deleteNotificationsByExpense(userId, expenseId);

    await createExpenseNotification(
      userId,
      expenseId,
      existingExpense.budgetId,
      expenseData.name,
      expenseData.amount,
    );
  } catch (error) {
    console.error("Unable to update expense notification:", error);
  }

  try {
    const activeBudget = await getActiveBudget(userId);

    if (activeBudget && activeBudget.id === existingExpense.budgetId) {
      const budgetExpenses = await getExpenses(
        userId,
        existingExpense.budgetId,
      );

      const totalSpent = budgetExpenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      );

      const budgetAmount = Number(activeBudget.amount);

      const previousTotalSpent =
        totalSpent -
        Number(expenseData.amount || 0) +
        Number(existingExpense.amount || 0);

      const previousPercentage =
        budgetAmount > 0 ? (previousTotalSpent / budgetAmount) * 100 : 0;

      const currentPercentage =
        budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

      if (
        previousPercentage < 80 &&
        currentPercentage >= 80 &&
        currentPercentage < 90
      ) {
        await createBudgetAlertNotification(
          userId,
          activeBudget.id,
          80,
          budgetAmount,
          totalSpent,
        );
      }

      if (
        previousPercentage < 90 &&
        currentPercentage >= 90 &&
        currentPercentage < 100
      ) {
        await createBudgetAlertNotification(
          userId,
          activeBudget.id,
          90,
          budgetAmount,
          totalSpent,
        );
      }

      if (previousPercentage < 100 && currentPercentage >= 100) {
        await createBudgetAlertNotification(
          userId,
          activeBudget.id,
          100,
          budgetAmount,
          totalSpent,
        );
      }

      await syncBudgetAlertNotifications(
        userId,
        activeBudget.id,
        budgetAmount,
        totalSpent,
      );
    }
  } catch (error) {
    console.error("Unable to sync budget alerts:", error);
  }
}

export async function deleteExpense(userId, expenseId) {
  if (!userId || !expenseId) {
    throw new Error("User ID and expense ID are required.");
  }

  const expenseRef = doc(db, "users", userId, "expenses", expenseId);

  const expenseSnapshot = await getDoc(expenseRef);

  const expense = expenseSnapshot.exists() ? expenseSnapshot.data() : null;

  if (!expense) {
    throw new Error("Expense could not be found.");
  }

  await deleteNotificationsByExpense(userId, expenseId);

  await deleteDoc(expenseRef);

  const budget = await getActiveBudget(userId);

  if (budget && budget.id === expense.budgetId) {
    const budgetExpenses = await getExpenses(userId, expense.budgetId);

    const totalSpent = budgetExpenses.reduce(
      (total, currentExpense) => total + Number(currentExpense.amount || 0),
      0,
    );

    await syncBudgetAlertNotifications(
      userId,
      budget.id,
      Number(budget.amount),
      totalSpent,
    );
  }
}

export async function deleteAllExpenses(userId, budgetId) {
  if (!userId || !budgetId) {
    throw new Error("User ID and budget ID are required.");
  }

  const expensesRef = collection(db, "users", userId, "expenses");

  const expensesQuery = query(expensesRef, where("budgetId", "==", budgetId));

  const snapshot = await getDocs(expensesQuery);

  for (const expenseDoc of snapshot.docs) {
    const expenseId = expenseDoc.id;

    // *Delete the expense notification first.*
    await deleteNotificationsByExpense(userId, expenseId);

    // *Delete the expense after its notification is removed.*
    await deleteDoc(doc(db, "users", userId, "expenses", expenseId));
  }
}
