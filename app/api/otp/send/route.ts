// app/api/otp/send/route.ts
import { NextResponse } from "next/server";
import { sendOtp, isValidPhone, isLiveOtp } from "@/lib/otpServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let phone = "";
  try {
    const body = await req.json();
    phone = String(body?.phone ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error: "Enter a phone number in international format, e.g. +14155552671." },
      { status: 400 }
    );
  }

  try {
    const demoCode = await sendOtp(phone);
    // In LIVE mode demoCode is null and nothing sensitive is returned.
    return NextResponse.json({ ok: true, live: isLiveOtp(), demoCode });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Could not send the code." },
      { status: 502 }
    );
  }
}
