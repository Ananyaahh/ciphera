"use client";

import React from "react";

// Catches render crashes in its children (e.g. the heavy 3D archive in the
// WebView) so one component failing doesn't take down the whole route and
// bounce the user back to the landing page.
export default class SafeBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error("Gallery component crashed:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="glass rounded-xl p-6 text-sm text-muted font-mono">
            Couldn&apos;t render the gallery view here. Your captures are safe —
            try reopening.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
