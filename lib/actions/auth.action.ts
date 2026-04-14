/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";
import { cache } from "react";

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

interface SignInParams {
  email: string;
  idToken: string;
}

interface SignUpParams {
  uid: string;
  name: string;
  email: string;
  password: string;
}

interface AuthActionResult {
  success: boolean;
  message: string;
}

const getSessionClaims = cache(async () => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    return await auth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
});

const getUserRecordById = cache(async (uid: string) => {
  const userRecord = await db.collection("users").doc(uid).get();
  if (!userRecord.exists) {
    return null;
  }

  return {
    ...userRecord.data(),
    id: userRecord.id,
  } as User;
});

export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();

  // Create session cookie
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION * 1000,
  });

  // Set cookie in the browser
  cookieStore.set("session", sessionCookie, {
    maxAge: SESSION_DURATION,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    // check if user exists in db
    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists)
      return {
        success: false,
        message: "User already exists. Please sign in.",
      };

    // save user to db
    await db.collection("users").doc(uid).set({
      name,
      email,
      // profileURL,
      // resumeURL,
    });

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error: any) {
    console.error("Error creating user:", error);

    // Handle Firebase specific errors
    if (error.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: "Failed to create account. Please try again.",
    };
  }
}

export async function signIn(params: SignInParams): Promise<AuthActionResult> {
  const { email, idToken } = params;

  try {
    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord)
      return {
        success: false,
        message: "User does not exist. Create an account.",
      };

    await setSessionCookie(idToken);

    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch (error: any) {
    console.error("Error signing in:", error);

    return {
      success: false,
      message: "Failed to log into account. Please try again.",
    };
  }
}

export async function signOut() {
  const cookieStore = await cookies();

  cookieStore.delete("session");
}

export async function getCurrentUser(): Promise<User | null> {
  const claims = await getSessionClaims();
  if (!claims?.uid) {
    return null;
  }

  return getUserRecordById(claims.uid);
}

export async function getCurrentUserId(): Promise<string | null> {
  const claims = await getSessionClaims();
  return claims?.uid ?? null;
}

export async function isAuthenticated() {
  const uid = await getCurrentUserId();
  return !!uid;
}