import {
  EmailAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";

import { auth } from "./config";

function getCurrentUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("USER_NOT_SIGNED_IN");
  }

  return user;
}

export async function reauthenticatePasswordUser(password) {
  const user = getCurrentUser();

  const credential = EmailAuthProvider.credential(user.email, password);

  return reauthenticateWithCredential(user, credential);
}

export async function reauthenticateGoogleUser() {
  const user = getCurrentUser();
  const provider = new GoogleAuthProvider();

  return reauthenticateWithPopup(user, provider);
}

export async function reauthenticateGithubUser() {
  const user = getCurrentUser();
  const provider = new GithubAuthProvider();

  return reauthenticateWithPopup(user, provider);
}
