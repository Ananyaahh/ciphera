// app/api/otp/verify/route.ts
import { checkOtp, isValidPhone } from "@/lib/otpServer";
import { corsJson, corsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request) {
  let phone = "";
  let code = "";
  try {
    const body = await req.json();
    phone = String(body?.phone ?? "").trim();
    code = String(body?.code ?? "").trim();
  } catch {
    return corsJson({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isValidPhone(phone) || !/^\d{4,8}$/.test(code)) {
    return corsJson({ error: "Missing phone or code." }, { status: 400 });
  }

  try {
    const ok = await checkOtp(phone, code);
    return corsJson({ ok });
  } catch (err: any) {
    return corsJson({ error: err?.message ?? "Could not verify the code." }, { status: 502 });
  }
}
