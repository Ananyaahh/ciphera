"use client";

import type { VerificationResult } from "@/lib/types";

export default function VerificationCard({ result }: { result: VerificationResult }) {
  const colors: Record<string, string> = {
    verified: "border-signal-verified/30 bg-signal-verified/10 text-signal-verified",
    tampered: "border-signal-tamper/30 bg-signal-tamper/10 text-signal-tamper",
    unverifiable: "border-signal-warn/30 bg-signal-warn/10 text-signal-warn",
  };
  const labels: Record<string, string> = {
    verified: "Verified — untampered",
    tampered: "Tampered since capture",
    unverifiable: "Could not verify",
  };
  return (
    <div className={`flex-1 rounded-xl border px-4 py-4 text-sm ${colors[result.status]}`}>
      <p className="font-display text-lg mb-2">{labels[result.status]}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs text-paper/90">
        {result.username && (
          <>
            <dt className="text-muted">who</dt>
            <dd>{result.username}</dd>
          </>
        )}
        {result.identityToken && (
          <>
            <dt className="text-muted">token</dt>
            <dd>{result.identityToken}</dd>
          </>
        )}
        {result.capturedAt && (
          <>
            <dt className="text-muted">when</dt>
            <dd>{new Date(result.capturedAt).toLocaleString()}</dd>
          </>
        )}
        {result.geo && (
          <>
            <dt className="text-muted">where</dt>
            <dd>
              {result.geo.lat.toFixed(5)}, {result.geo.lng.toFixed(5)}
              {result.geo.accuracy ? ` (±${Math.round(result.geo.accuracy)}m)` : ""}
            </dd>
          </>
        )}
        {result.epochNumber !== null && (
          <>
            <dt className="text-muted">epoch</dt>
            <dd>
              {result.epochNumber}{" "}
              {result.epochStatus === "revoked" && (
                <span className="text-signal-warn">(revoked, still valid)</span>
              )}
            </dd>
          </>
        )}
      </dl>
      <p className="mt-3 text-paper/80 leading-relaxed">{result.details}</p>
    </div>
  );
}