// app/api/otp/verify/route.ts
import { NextResponse } from "next/server";
import { checkOtp, isValidPhone } from "@/lib/otpServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let phone = "";
  let code = "";
  try {
    const body = await req.json();
    phone = String(body?.phone ?? "").trim();
    code = String(body?.code ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isValidPhone(phone) || !/^\d{4,8}$/.test(code)) {
    return NextResponse.json({ error: "Missing phone or code." }, { status: 400 });
  }

  try {
    const ok = await checkOtp(phone, code);
    return NextResponse.json({ ok });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Could not verify the code." },
      { status: 502 }
    );
  }
}
