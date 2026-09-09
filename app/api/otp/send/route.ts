import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { otpCodes } from "@/lib/server/schema";

export const runtime = "nodejs";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "Missing phone." }, { status: 400 });

    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_VERIFY_SID) {
      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/Verifications`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phone, Channel: "sms" }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: `Twilio send failed (${res.status}): ${JSON.stringify(data)}` },
          { status: 500 }
        );
      }
      return NextResponse.json({ demoCode: null });
    }

    const code = randomCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db
      .insert(otpCodes)
      .values({ phone, code, expiresAt })
      .onConflictDoUpdate({ target: otpCodes.phone, set: { code, expiresAt } });

    return NextResponse.json({ demoCode: code });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Could not send code." }, { status: 500 });
  }
}