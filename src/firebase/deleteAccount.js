import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import { deleteUser } from "firebase/auth";

import { auth, db } from "./config";

const BATCH_SIZE = 450;

async function deleteDocumentReferences(documentRefs) {
  for (let index = 0; index < documentRefs.length; index += BATCH_SIZE) {
    const batch = writeBatch(db);

    const currentRefs = documentRefs.slice(index, index + BATCH_SIZE);

    currentRefs.forEach((documentRef) => {
      batch.delete(documentRef);
    });

    await batch.commit();
  }
}

export async function deleteAccountCompletely() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("USER_NOT_SIGNED_IN");
  }

  const userId = user.uid;

  const budgetsRef = collection(db, "users", userId, "budgets");
  const expensesRef = collection(db, "users", userId, "expenses");
  const notificationsRef = collection(db, "users", userId, "notifications");
  const budgetControlRef = collection(db, "users", userId, "budgetControl");

  const [
    budgetsSnapshot,
    expensesSnapshot,
    notificationsSnapshot,
    budgetControlSnapshot,
  ] = await Promise.all([
    getDocs(budgetsRef),
    getDocs(expensesRef),
    getDocs(notificationsRef),
    getDocs(budgetControlRef),
  ]);

  const budgetRefs = budgetsSnapshot.docs.map((budgetDoc) =>
    doc(db, "users", userId, "budgets", budgetDoc.id),
  );

  const expenseRefs = expensesSnapshot.docs.map((expenseDoc) =>
    doc(db, "users", userId, "expenses", expenseDoc.id),
  );

  const notificationRefs = notificationsSnapshot.docs.map((notificationDoc) =>
    doc(db, "users", userId, "notifications", notificationDoc.id),
  );

  const budgetControlRefs = budgetControlSnapshot.docs.map((controlDoc) =>
    doc(db, "users", userId, "budgetControl", controlDoc.id),
  );

  await deleteDocumentReferences(notificationRefs);
  await deleteDocumentReferences(expenseRefs);
  await deleteDocumentReferences(budgetRefs);
  await deleteDocumentReferences(budgetControlRefs);

  await deleteDoc(doc(db, "users", userId));

  localStorage.removeItem(`better-wallet-home-${userId}`);

  await deleteUser(user);
}
