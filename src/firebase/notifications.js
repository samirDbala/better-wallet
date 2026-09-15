import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./config";
import { formatCurrency } from "../utils/currency";

export async function createNotification(userId, notification) {
  if (!userId) {
    return;
  }

  await addDoc(collection(db, "users", userId, "notifications"), {
    ...notification,
    read: false,
    createdAt: new Date(),
  });
}

export async function createBudgetNotification(
  userId,
  budgetId,
  amount,
  period,
) {
  if (!userId || !budgetId) {
    return;
  }

  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

  await setDoc(
    doc(db, "users", userId, "notifications", `budget_${budgetId}`),
    {
      type: "budget_created",
      budgetId,
      amount: Number(amount),
      period,
      title: "Budget created",
      message: `Your ${formatCurrency(
        Number(amount),
      )} ${periodLabel.toLowerCase()} budget is now active.`,
      read: false,
      createdAt: new Date(),
    },
  );
}

export async function updateBudgetNotification(
  userId,
  budgetId,
  amount,
  period,
) {
  if (!userId || !budgetId) {
    return;
  }

  const periodLabel = period.toLowerCase();

  await setDoc(
    doc(db, "users", userId, "notifications", `budget_${budgetId}`),
    {
      type: "budget_created",
      budgetId,
      amount: Number(amount),
      period,
      title: "Budget created",
      message: `Your ${formatCurrency(
        Number(amount),
      )} ${periodLabel} budget is now active.`,
    },
    {
      merge: true,
    },
  );
}

export async function createExpenseNotification(
  userId,
  expenseId,
  budgetId,
  expenseName,
  amount,
) {
  if (!userId || !expenseId || !budgetId) {
    return;
  }

  await setDoc(
    doc(db, "users", userId, "notifications", `expense_${expenseId}`),
    {
      type: "expense_added",
      expenseId,
      budgetId,
      expenseName,
      amount: Number(amount),
      title: "Expense added",
      message: `${formatCurrency(Number(amount))} spent on ${expenseName}.`,
      read: false,
      createdAt: new Date(),
    },
  );
}

export async function createBudgetAlertNotification(
  userId,
  budgetId,
  threshold,
  budgetAmount,
  totalSpent,
) {
  if (!userId || !budgetId || !threshold || !budgetAmount) {
    return;
  }

  const actualRemaining = Math.max(budgetAmount - totalSpent, 0);
  const overAmount = Math.max(totalSpent - budgetAmount, 0);

  let title = "";
  let message = "";

  if (threshold === 80) {
    title = "Budget alert";

    message = `You've used 80% of your ${formatCurrency(
      budgetAmount,
    )} budget. ${formatCurrency(actualRemaining)} remaining.`;
  }

  if (threshold === 90) {
    title = "Budget warning";

    message = `You've used 90% of your ${formatCurrency(
      budgetAmount,
    )} budget. Only ${formatCurrency(actualRemaining)} remaining.`;
  }

  if (threshold === 100) {
    title = "Budget exhausted";

    if (overAmount > 0) {
      message = `You've exceeded your ${formatCurrency(
        budgetAmount,
      )} budget by ${formatCurrency(overAmount)}.`;
    } else {
      message = `You've completely used your ${formatCurrency(
        budgetAmount,
      )} budget for this period.`;
    }
  }

  if (!title || !message) {
    return;
  }

  const notificationId = `budget_${budgetId}_${threshold}`;

  await setDoc(
    doc(db, "users", userId, "notifications", notificationId),
    {
      type: "budget_alert",
      budgetId,
      threshold,
      title,
      message,
      read: false,
      createdAt: new Date(),
    },
    {
      merge: true,
    },
  );
}

export async function syncBudgetAlertNotifications(
  userId,
  budgetId,
  budgetAmount,
  totalSpent,
) {
  if (!userId || !budgetId || !budgetAmount) {
    return;
  }

  const percentageSpent = (totalSpent / budgetAmount) * 100;

  const thresholds = [80, 90, 100];

  for (const threshold of thresholds) {
    const notificationId = `budget_${budgetId}_${threshold}`;

    if (percentageSpent < threshold) {
      await deleteNotification(userId, notificationId);
    }
  }
}

export function listenToNotifications(userId, callback) {
  if (!userId) {
    return () => {};
  }

  const notificationsRef = collection(db, "users", userId, "notifications");

  const notificationsQuery = query(
    notificationsRef,
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map((notificationDoc) => ({
        id: notificationDoc.id,
        ...notificationDoc.data(),
      }));

      callback(notifications);
    },
    (error) => {
      console.error("Notification listener error:", error);
    },
  );
}

export async function markNotificationAsRead(userId, notificationId) {
  if (!userId || !notificationId) {
    return;
  }

  await updateDoc(doc(db, "users", userId, "notifications", notificationId), {
    read: true,
  });
}

export async function markAllNotificationsAsRead(userId, notifications) {
  if (!userId || !notifications?.length) {
    return;
  }

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read,
  );

  for (const notification of unreadNotifications) {
    await markNotificationAsRead(userId, notification.id);
  }
}

export async function deleteNotification(userId, notificationId) {
  if (!userId || !notificationId) {
    return;
  }

  await deleteDoc(doc(db, "users", userId, "notifications", notificationId));
}

export async function deleteNotificationsByExpense(userId, expenseId) {
  if (!userId || !expenseId) {
    return;
  }

  const notificationRef = doc(
    db,
    "users",
    userId,
    "notifications",
    `expense_${expenseId}`,
  );

  try {
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error("Unable to delete expense notification:", error);
  }
}

export async function deleteNotificationsByBudget(userId, budgetId) {
  if (!userId || !budgetId) {
    return;
  }

  const notificationsRef = collection(db, "users", userId, "notifications");

  const snapshot = await getDocs(notificationsRef);

  const relatedNotifications = snapshot.docs.filter((notificationDoc) => {
    const notification = notificationDoc.data();

    return notification.budgetId === budgetId;
  });

  for (const notificationDoc of relatedNotifications) {
    await deleteDoc(
      doc(db, "users", userId, "notifications", notificationDoc.id),
    );
  }
}
