import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { otpCodes } from "@/lib/server/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();
    if (!phone || !code) return NextResponse.json({ error: "Missing phone or code." }, { status: 400 });

    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_VERIFY_SID) {
      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/VerificationCheck`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phone, Code: code }),
        }
      );
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data?.message ?? "Verification failed." }, { status: 500 });
      return NextResponse.json({ ok: data.status === "approved" });
    }

    const [record] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
    if (!record || record.code !== code || record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Verification failed." }, { status: 500 });
  }
}
