import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { doc, setDoc } from "firebase/firestore";

import { auth, db } from "./config";

export async function registerUser(email, password, name) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  const user = userCredential.user;

  await updateProfile(user, {
    displayName: name,
  });

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name,
    email: user.email,
    photoURL: user.photoURL || "",
  });

  return user;
}

export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password,
  );

  return userCredential.user;
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();

  const userCredential = await signInWithPopup(auth, provider);

  await saveSocialUser(userCredential.user);

  return userCredential.user;
}

export async function loginWithGithub() {
  const provider = new GithubAuthProvider();

  const userCredential = await signInWithPopup(auth, provider);

  await saveSocialUser(userCredential.user);

  return userCredential.user;
}

async function saveSocialUser(user) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
    },
    { merge: true },
  );
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logoutUser() {
  await signOut(auth);
}

export function listenToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}
