import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "./config";
import { updateBudgetNotification } from "./notifications";

function getBudgetDates(period, customStartDate = null, customEndDate = null) {
  const startDate = customStartDate ? new Date(customStartDate) : new Date();

  startDate.setHours(0, 0, 0, 0);

  if (period === "custom") {
    if (customEndDate === null) {
      return {
        startDate,
        endDate: null,
      };
    }

    const endDate = new Date(customEndDate);
    endDate.setHours(0, 0, 0, 0);

    if (endDate <= startDate) {
      throw new Error("INVALID_CUSTOM_DATES");
    }

    return {
      startDate,
      endDate,
    };
  }

  const endDate = calculateEndDate(startDate, period);

  return {
    startDate,
    endDate,
  };
}

function calculateEndDate(startDate, period) {
  const endDate = new Date(startDate);

  if (period === "daily") {
    endDate.setDate(endDate.getDate() + 1);
  } else if (period === "weekly") {
    endDate.setDate(endDate.getDate() + 7);
  } else if (period === "monthly") {
    const originalDay = endDate.getDate();

    endDate.setDate(1);
    endDate.setMonth(endDate.getMonth() + 1);

    const lastDayOfMonth = new Date(
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      0,
    ).getDate();

    endDate.setDate(Math.min(originalDay, lastDayOfMonth));
  } else if (period === "yearly") {
    const originalMonth = endDate.getMonth();
    const originalDay = endDate.getDate();

    endDate.setDate(1);
    endDate.setFullYear(endDate.getFullYear() + 1);
    endDate.setMonth(originalMonth);

    const lastDayOfMonth = new Date(
      endDate.getFullYear(),
      originalMonth + 1,
      0,
    ).getDate();

    endDate.setDate(Math.min(originalDay, lastDayOfMonth));
  } else {
    throw new Error("INVALID_BUDGET_PERIOD");
  }

  return endDate;
}

function getActiveBudgetControlRef(userId) {
  return doc(db, "users", userId, "budgetControl", "active");
}

export async function createBudget(
  userId,
  amount,
  period,
  customStartDate = null,
  customEndDate = null,
) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const { startDate, endDate } = getBudgetDates(
    period,
    customStartDate,
    customEndDate,
  );

  const budgetRef = doc(db, "users", userId, "budgets", `${Date.now()}`);

  const activeBudgetRef = getActiveBudgetControlRef(userId);

  await runTransaction(db, async (transaction) => {
    const activeBudgetSnapshot = await transaction.get(activeBudgetRef);

    if (activeBudgetSnapshot.exists()) {
      const activeBudget = activeBudgetSnapshot.data();

      if (activeBudget.budgetId) {
        const existingBudgetRef = doc(
          db,
          "users",
          userId,
          "budgets",
          activeBudget.budgetId,
        );

        const existingBudgetSnapshot = await transaction.get(existingBudgetRef);

        if (existingBudgetSnapshot.exists()) {
          const existingBudget = existingBudgetSnapshot.data();

          const now = new Date();

          if (
            existingBudget.status === "running" &&
            existingBudget.startDate?.toDate
          ) {
            const startDate = existingBudget.startDate.toDate();

            const isActive = existingBudget.endDate?.toDate
              ? startDate <= now && now < existingBudget.endDate.toDate()
              : startDate <= now;

            if (isActive) {
              throw new Error("ACTIVE_BUDGET_EXISTS");
            }
          }
        }
      }
    }

    transaction.set(budgetRef, {
      userId,
      amount: Number(amount),
      period,
      startDate,
      endDate,
      status: "running",
      repeatEnabled: false,
      createdAt: serverTimestamp(),
    });

    transaction.set(activeBudgetRef, {
      budgetId: budgetRef.id,
      updatedAt: serverTimestamp(),
    });
  });

  return budgetRef.id;
}

export async function updateBudget(
  userId,
  budgetId,
  amount,
  period,
  customStartDate = null,
  customEndDate = null,
) {
  if (!userId || !budgetId) {
    throw new Error("USER_ID_AND_BUDGET_ID_REQUIRED");
  }

  const budget = await getBudget(userId, budgetId);

  if (!budget) {
    throw new Error("BUDGET_NOT_FOUND");
  }

  if (budget.status === "completed") {
    throw new Error("BUDGET_COMPLETED");
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error("INVALID_BUDGET_AMOUNT");
  }

  const originalStartDate = budget.startDate?.toDate?.();

  if (!originalStartDate) {
    throw new Error("INVALID_BUDGET_DATES");
  }

  let startDate;
  let endDate;

  if (period === "custom") {
    startDate = customStartDate
      ? new Date(customStartDate)
      : new Date(originalStartDate);

    startDate.setHours(0, 0, 0, 0);

    if (customEndDate === null) {
      endDate = null;
    } else {
      endDate = new Date(customEndDate);
      endDate.setHours(0, 0, 0, 0);

      if (endDate <= startDate) {
        throw new Error("INVALID_CUSTOM_DATES");
      }
    }
  } else {
    startDate = new Date(originalStartDate);
    endDate = calculateEndDate(startDate, period);
  }

  if (budget.status === "held" && budget.heldAt?.toDate) {
    const heldAt = budget.heldAt.toDate();
    const pausedDuration = Date.now() - heldAt.getTime();

    startDate.setTime(startDate.getTime() + pausedDuration);

    if (endDate) {
      endDate.setTime(endDate.getTime() + pausedDuration);
    }
  }

  const budgetRef = doc(db, "users", userId, "budgets", budgetId);

  await updateDoc(budgetRef, {
    amount: Number(amount),
    period,
    startDate,
    endDate,
    updatedAt: serverTimestamp(),
  });

  await updateBudgetNotification(userId, budgetId, amount, period);
}

export async function setBudgetRepeat(userId, budgetId, repeatEnabled) {
  if (!userId || !budgetId) {
    throw new Error("USER_ID_AND_BUDGET_ID_REQUIRED");
  }

  const budget = await getBudget(userId, budgetId);

  if (!budget) {
    throw new Error("BUDGET_NOT_FOUND");
  }

  if (budget.status === "completed") {
    throw new Error("BUDGET_COMPLETED");
  }

  if (budget.period === "custom" && repeatEnabled) {
    throw new Error("CUSTOM_BUDGET_CANNOT_REPEAT");
  }

  await updateDoc(doc(db, "users", userId, "budgets", budgetId), {
    repeatEnabled: Boolean(repeatEnabled),
    updatedAt: serverTimestamp(),
  });
}

export async function createNextRepeatingBudget(
  userId,
  budgetId,
  startFromDate = null,
) {
  if (!userId || !budgetId) {
    throw new Error("USER_ID_AND_BUDGET_ID_REQUIRED");
  }

  const budget = await getBudget(userId, budgetId);

  if (!budget) {
    throw new Error("BUDGET_NOT_FOUND");
  }

  if (!budget.repeatEnabled) {
    return null;
  }

  if (!budget.startDate?.toDate || !budget.endDate?.toDate) {
    throw new Error("INVALID_BUDGET_DATES");
  }

  const currentEndDate = budget.endDate.toDate();

  const startDate = startFromDate
    ? new Date(startFromDate)
    : new Date(currentEndDate);

  const endDate = calculateEndDate(startDate, budget.period);

  const nextBudgetId = `${budgetId}_${startDate.getTime()}`;

  const nextBudgetRef = doc(db, "users", userId, "budgets", nextBudgetId);

  await runTransaction(db, async (transaction) => {
    const existingNextBudget = await transaction.get(nextBudgetRef);

    if (existingNextBudget.exists()) {
      return;
    }

    transaction.set(nextBudgetRef, {
      userId,
      amount: Number(budget.amount),
      period: budget.period,
      startDate,
      endDate,
      status: "running",
      repeatEnabled: true,
      createdAt: serverTimestamp(),
    });

    transaction.set(getActiveBudgetControlRef(userId), {
      budgetId: nextBudgetRef.id,
      updatedAt: serverTimestamp(),
    });
  });

  return nextBudgetId;
}

export async function getActiveBudget(userId) {
  if (!userId) {
    return null;
  }

  await processRepeatingBudgets(userId);

  const budgetsRef = collection(db, "users", userId, "budgets");

  const snapshot = await getDocs(budgetsRef);

  const now = new Date();

  const activeBudgets = snapshot.docs
    .map((budgetDoc) => ({
      id: budgetDoc.id,
      ...budgetDoc.data(),
    }))
    .filter((budget) => {
      if (!budget.startDate?.toDate) {
        return false;
      }

      if (budget.status === "held" || budget.status === "completed") {
        return false;
      }

      const startDate = budget.startDate.toDate();

      if (!budget.endDate?.toDate) {
        return startDate <= now;
      }

      const endDate = budget.endDate.toDate();

      return startDate <= now && now < endDate;
    });

  if (activeBudgets.length === 0) {
    return null;
  }

  activeBudgets.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.startDate?.toMillis?.() ?? 0;

    const bTime = b.createdAt?.toMillis?.() ?? b.startDate?.toMillis?.() ?? 0;

    return bTime - aTime;
  });

  return activeBudgets[0];
}

export async function getBudgets(userId) {
  if (!userId) {
    return [];
  }

  const budgetsRef = collection(db, "users", userId, "budgets");

  const snapshot = await getDocs(budgetsRef);

  const budgets = snapshot.docs.map((budgetDoc) => ({
    id: budgetDoc.id,
    ...budgetDoc.data(),
  }));

  budgets.sort((a, b) => {
    const aDate = a.startDate?.toMillis?.() ?? 0;
    const bDate = b.startDate?.toMillis?.() ?? 0;

    return bDate - aDate;
  });

  return budgets;
}

export async function processRepeatingBudgets(userId) {
  if (!userId) {
    return;
  }

  const budgets = await getBudgets(userId);
  const now = new Date();

  const expiredBudgets = budgets
    .filter((budget) => {
      if (!budget.startDate?.toDate || !budget.endDate?.toDate) {
        return false;
      }

      if (budget.status !== "running") {
        return false;
      }

      return budget.endDate.toDate() <= now;
    })
    .sort((a, b) => {
      const aEnd = a.endDate.toMillis();
      const bEnd = b.endDate.toMillis();

      return aEnd - bEnd;
    });

  for (const budget of expiredBudgets) {
    const latestBudget = await getBudget(userId, budget.id);

    if (!latestBudget || latestBudget.status !== "running") {
      continue;
    }

    await updateDoc(doc(db, "users", userId, "budgets", budget.id), {
      status: "completed",
      completedAt: serverTimestamp(),
    });

    if (!latestBudget.repeatEnabled) {
      const activeBudgetControlRef = getActiveBudgetControlRef(userId);
      const activeBudgetControlSnapshot = await getDoc(activeBudgetControlRef);

      if (
        activeBudgetControlSnapshot.exists() &&
        activeBudgetControlSnapshot.data().budgetId === budget.id
      ) {
        await deleteDoc(activeBudgetControlRef);
      }

      continue;
    }

    let currentBudget = latestBudget;

    while (
      currentBudget.repeatEnabled &&
      currentBudget.endDate?.toDate &&
      currentBudget.endDate.toDate() <= now
    ) {
      const nextBudgetId = await createNextRepeatingBudget(
        userId,
        currentBudget.id,
      );

      if (!nextBudgetId) {
        break;
      }

      currentBudget = await getBudget(userId, nextBudgetId);

      if (!currentBudget) {
        break;
      }

      if (currentBudget.endDate.toDate() > now) {
        break;
      }

      await updateDoc(doc(db, "users", userId, "budgets", currentBudget.id), {
        status: "completed",
        completedAt: serverTimestamp(),
      });

      const activeBudgetControlRef = getActiveBudgetControlRef(userId);
      const activeBudgetControlSnapshot = await getDoc(activeBudgetControlRef);

      if (
        activeBudgetControlSnapshot.exists() &&
        activeBudgetControlSnapshot.data().budgetId === currentBudget.id
      ) {
        await deleteDoc(activeBudgetControlRef);
      }
    }
  }
}

export function listenToBudgets(userId, callback, onError) {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const budgetsRef = collection(db, "users", userId, "budgets");

  return onSnapshot(
    budgetsRef,
    (snapshot) => {
      const budgets = snapshot.docs.map((budgetDoc) => ({
        id: budgetDoc.id,
        ...budgetDoc.data(),
      }));

      budgets.sort((a, b) => {
        const aDate = a.startDate?.toMillis?.() ?? 0;
        const bDate = b.startDate?.toMillis?.() ?? 0;

        return bDate - aDate;
      });

      callback(budgets);
    },
    (error) => {
      console.error("Unable to listen to budgets:", error);

      if (onError) {
        onError(error);
      }
    },
  );
}

export async function getPreviousBudget(
  userId,
  currentBudgetId,
  currentPeriod,
) {
  if (!userId || !currentBudgetId || !currentPeriod) {
    return null;
  }

  const budgetsRef = collection(db, "users", userId, "budgets");

  const snapshot = await getDocs(budgetsRef);

  const now = new Date();

  const previousBudgets = snapshot.docs
    .map((budgetDoc) => ({
      id: budgetDoc.id,
      ...budgetDoc.data(),
    }))
    .filter((budget) => {
      if (
        budget.id === currentBudgetId ||
        budget.period !== currentPeriod ||
        !budget.startDate
      ) {
        return false;
      }

      if (budget.status === "held") {
        return false;
      }

      if (budget.status === "completed") {
        return true;
      }

      if (!budget.endDate?.toDate) {
        return false;
      }

      return budget.endDate.toDate() <= now;
    });

  if (previousBudgets.length === 0) {
    return null;
  }

  previousBudgets.sort((a, b) => {
    const aEndDate = a.endDate?.toMillis?.() ?? 0;
    const bEndDate = b.endDate?.toMillis?.() ?? 0;

    return bEndDate - aEndDate;
  });

  return previousBudgets[0];
}

export async function getBudget(userId, budgetId) {
  if (!userId || !budgetId) {
    return null;
  }

  const budgetRef = doc(db, "users", userId, "budgets", budgetId);

  const budgetSnapshot = await getDoc(budgetRef);

  if (!budgetSnapshot.exists()) {
    return null;
  }

  return {
    id: budgetSnapshot.id,
    ...budgetSnapshot.data(),
  };
}

export async function holdBudget(userId, budgetId) {
  const budgetRef = doc(db, "users", userId, "budgets", budgetId);
  const activeBudgetControlRef = getActiveBudgetControlRef(userId);

  await runTransaction(db, async (transaction) => {
    const budgetSnapshot = await transaction.get(budgetRef);

    if (!budgetSnapshot.exists()) {
      throw new Error("BUDGET_NOT_FOUND");
    }

    const budget = budgetSnapshot.data();

    if (budget.status === "completed") {
      throw new Error("BUDGET_ALREADY_COMPLETED");
    }

    if (budget.status === "held") {
      throw new Error("BUDGET_ALREADY_HELD");
    }

    const activeBudgetControlSnapshot = await transaction.get(
      activeBudgetControlRef,
    );

    transaction.update(budgetRef, {
      status: "held",
      heldAt: serverTimestamp(),
    });

    if (
      activeBudgetControlSnapshot.exists() &&
      activeBudgetControlSnapshot.data().budgetId === budgetId
    ) {
      transaction.delete(activeBudgetControlRef);
    }
  });
}

export async function resumeBudget(userId, budgetId) {
  const budgetRef = doc(db, "users", userId, "budgets", budgetId);
  const activeBudgetControlRef = getActiveBudgetControlRef(userId);

  await runTransaction(db, async (transaction) => {
    const budgetSnapshot = await transaction.get(budgetRef);

    if (!budgetSnapshot.exists()) {
      throw new Error("BUDGET_NOT_FOUND");
    }

    const budget = {
      id: budgetSnapshot.id,
      ...budgetSnapshot.data(),
    };

    if (budget.status !== "held") {
      throw new Error("BUDGET_NOT_HELD");
    }

    let startDate = budget.startDate?.toDate?.();
    let endDate = budget.endDate?.toDate?.();

    if (!startDate) {
      throw new Error("INVALID_BUDGET_DATES");
    }

    if (budget.period === "custom" && !budget.endDate?.toDate) {
      endDate = null;
    }

    // Pause the budget countdown while it is held.
    if (budget.heldAt?.toDate) {
      const heldAt = budget.heldAt.toDate();

      const pausedDuration = Date.now() - heldAt.getTime();

      startDate = new Date(startDate.getTime() + pausedDuration);

      if (endDate) {
        endDate = new Date(endDate.getTime() + pausedDuration);
      }
    }

    const activeBudgetControlSnapshot = await transaction.get(
      activeBudgetControlRef,
    );

    if (activeBudgetControlSnapshot.exists()) {
      const activeBudgetControl = activeBudgetControlSnapshot.data();

      if (
        activeBudgetControl.budgetId &&
        activeBudgetControl.budgetId !== budgetId
      ) {
        const currentBudgetRef = doc(
          db,
          "users",
          userId,
          "budgets",
          activeBudgetControl.budgetId,
        );

        const currentBudgetSnapshot = await transaction.get(currentBudgetRef);

        if (currentBudgetSnapshot.exists()) {
          const currentBudget = currentBudgetSnapshot.data();

          if (currentBudget.status === "running") {
            transaction.update(currentBudgetRef, {
              status: "held",
              heldAt: serverTimestamp(),
            });
          }
        }
      }
    }

    transaction.update(budgetRef, {
      status: "running",
      startDate,
      endDate,
      heldAt: null,
      resumedAt: serverTimestamp(),
    });

    transaction.set(activeBudgetControlRef, {
      budgetId,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function completeBudget(userId, budgetId) {
  const budgetRef = doc(db, "users", userId, "budgets", budgetId);
  const activeBudgetControlRef = getActiveBudgetControlRef(userId);

  const completedAt = new Date();

  await runTransaction(db, async (transaction) => {
    const budgetSnapshot = await transaction.get(budgetRef);

    if (!budgetSnapshot.exists()) {
      throw new Error("BUDGET_NOT_FOUND");
    }

    const budget = {
      id: budgetSnapshot.id,
      ...budgetSnapshot.data(),
    };

    if (budget.status === "completed") {
      throw new Error("BUDGET_ALREADY_COMPLETED");
    }

    let nextBudgetRef = null;
    let nextBudgetSnapshot = null;
    let nextBudgetId = null;

    if (budget.repeatEnabled) {
      if (!budget.startDate?.toDate || !budget.endDate?.toDate) {
        throw new Error("INVALID_BUDGET_DATES");
      }

      const startDate = new Date(completedAt);
      const endDate = calculateEndDate(startDate, budget.period);

      nextBudgetId = `${budgetId}_${startDate.getTime()}`;

      nextBudgetRef = doc(db, "users", userId, "budgets", nextBudgetId);

      nextBudgetSnapshot = await transaction.get(nextBudgetRef);
    }

    transaction.update(budgetRef, {
      status: "completed",
      completedAt: serverTimestamp(),
    });

    if (budget.repeatEnabled) {
      const startDate = new Date(completedAt);
      const endDate = calculateEndDate(startDate, budget.period);

      if (!nextBudgetSnapshot.exists()) {
        transaction.set(nextBudgetRef, {
          userId,
          amount: Number(budget.amount),
          period: budget.period,
          startDate,
          endDate,
          status: "running",
          repeatEnabled: true,
          createdAt: serverTimestamp(),
        });
      }

      transaction.set(activeBudgetControlRef, {
        budgetId: nextBudgetId,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.delete(activeBudgetControlRef);
    }
  });
}

async function deleteInBatches(documentRefs) {
  const batchSize = 450;

  for (let index = 0; index < documentRefs.length; index += batchSize) {
    const batch = writeBatch(db);

    const batchRefs = documentRefs.slice(index, index + batchSize);

    batchRefs.forEach((documentRef) => {
      batch.delete(documentRef);
    });

    await batch.commit();
  }
}

export async function deleteBudget(userId, budgetId) {
  if (!userId || !budgetId) {
    throw new Error("USER_ID_AND_BUDGET_ID_REQUIRED");
  }

  const budgetRef = doc(db, "users", userId, "budgets", budgetId);

  const budgetSnapshot = await getDoc(budgetRef);

  if (!budgetSnapshot.exists()) {
    throw new Error("BUDGET_NOT_FOUND");
  }

  const expensesRef = collection(db, "users", userId, "expenses");

  const expensesSnapshot = await getDocs(expensesRef);

  const relatedExpenseRefs = expensesSnapshot.docs
    .filter((expenseDoc) => {
      const expense = expenseDoc.data();

      return expense.budgetId === budgetId;
    })
    .map((expenseDoc) => doc(db, "users", userId, "expenses", expenseDoc.id));

  const notificationsRef = collection(db, "users", userId, "notifications");

  const notificationsSnapshot = await getDocs(notificationsRef);

  const relatedNotificationRefs = notificationsSnapshot.docs
    .filter((notificationDoc) => {
      const notification = notificationDoc.data();

      return notification.budgetId === budgetId;
    })
    .map((notificationDoc) =>
      doc(db, "users", userId, "notifications", notificationDoc.id),
    );

  // *Delete budget notifications before expenses.*
  await deleteInBatches(relatedNotificationRefs);

  // *Delete budget expenses before the budget.*
  await deleteInBatches(relatedExpenseRefs);

  // *Delete the budget only after related data is removed.*
  await deleteDoc(budgetRef);

  const activeBudgetControlRef = getActiveBudgetControlRef(userId);
  const activeBudgetControlSnapshot = await getDoc(activeBudgetControlRef);

  if (
    activeBudgetControlSnapshot.exists() &&
    activeBudgetControlSnapshot.data().budgetId === budgetId
  ) {
    await deleteDoc(activeBudgetControlRef);
  }
}

export async function deleteAllBudgets(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const budgetsRef = collection(db, "users", userId, "budgets");

  const expensesRef = collection(db, "users", userId, "expenses");

  const notificationsRef = collection(db, "users", userId, "notifications");

  const [budgetsSnapshot, expensesSnapshot, notificationsSnapshot] =
    await Promise.all([
      getDocs(budgetsRef),
      getDocs(expensesRef),
      getDocs(notificationsRef),
    ]);

  const budgetIds = new Set(
    budgetsSnapshot.docs.map((budgetDoc) => budgetDoc.id),
  );

  const relatedNotificationRefs = notificationsSnapshot.docs
    .filter((notificationDoc) => {
      const notification = notificationDoc.data();

      return notification.budgetId && budgetIds.has(notification.budgetId);
    })
    .map((notificationDoc) =>
      doc(db, "users", userId, "notifications", notificationDoc.id),
    );

  const relatedExpenseRefs = expensesSnapshot.docs
    .filter((expenseDoc) => {
      const expense = expenseDoc.data();

      return expense.budgetId && budgetIds.has(expense.budgetId);
    })
    .map((expenseDoc) => doc(db, "users", userId, "expenses", expenseDoc.id));

  const budgetRefs = budgetsSnapshot.docs.map((budgetDoc) =>
    doc(db, "users", userId, "budgets", budgetDoc.id),
  );

  // *Delete all budget notifications first.*
  await deleteInBatches(relatedNotificationRefs);

  // *Delete all budget expenses second.*
  await deleteInBatches(relatedExpenseRefs);

  // *Delete all budgets last.*
  await deleteInBatches(budgetRefs);
  await deleteDoc(getActiveBudgetControlRef(userId));
}

export async function getLatestFinishedBudget(userId) {
  if (!userId) {
    return null;
  }

  const budgetsRef = collection(db, "users", userId, "budgets");

  const snapshot = await getDocs(budgetsRef);

  const now = new Date();

  const finishedBudgets = snapshot.docs
    .map((budgetDoc) => ({
      id: budgetDoc.id,
      ...budgetDoc.data(),
    }))
    .filter((budget) => {
      if (!budget.startDate) {
        return false;
      }

      if (budget.status === "held") {
        return false;
      }

      if (budget.status === "completed") {
        return true;
      }

      if (!budget.endDate?.toDate) {
        return false;
      }

      return budget.endDate.toDate() <= now;
    });

  if (finishedBudgets.length === 0) {
    return null;
  }

  finishedBudgets.sort((a, b) => {
    const aEnd = a.endDate?.toMillis?.() ?? 0;
    const bEnd = b.endDate?.toMillis?.() ?? 0;

    return bEnd - aEnd;
  });

  return finishedBudgets[0];
}
