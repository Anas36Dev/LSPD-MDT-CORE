"use server";

import { redirect } from "next/navigation";

import { audit, destroySession, getCurrentUser } from "@/lib/auth";

export async function logout() {
  const user = await getCurrentUser();
  if (user) {
    await audit({ userId: user.id, action: "LOGOUT" });
  }
  await destroySession();
  redirect("/login");
}
