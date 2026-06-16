import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  const clearOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };
  res.cookies.set("harshwal_token", "", clearOpts);
  res.cookies.set("user_role", "", clearOpts);
  return res;
}
