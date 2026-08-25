// app/api/otp/send/route.ts
import { sendOtp, isValidPhone, isLiveOtp } from "@/lib/otpServer";
import { corsJson, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request) {
  let phone = "";
  try {
    const body = await req.json();
    phone = String(body?.phone ?? "").trim();
  } catch {
    return corsJson({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isValidPhone(phone)) {
    return corsJson(
      { error: "Enter a phone number in international format, e.g. +14155552671." },
      { status: 400 }
    );
  }

  try {
    const demoCode = await sendOtp(phone);
    return corsJson({ ok: true, live: isLiveOtp(), demoCode });
  } catch (err: any) {
    return corsJson({ error: err?.message ?? "Could not send the code." }, { status: 502 });
  }
}
