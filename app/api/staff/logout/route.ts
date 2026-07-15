// app/api/staff/logout/route.ts
import { NextResponse } from "next/server";
import { clearStaffSession } from "@/lib/auth/staffAuth";

export async function POST() {
  await clearStaffSession();
  return NextResponse.json({ message: "Logged out." });
}