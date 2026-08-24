export type Theme = "light" | "dark";
export type Accent = "blue" | "green" | "orange" | "pink" | "violet" | "neutral";

export interface BlockProps {
  theme?: Theme;
  accent?: Accent;
  embedded?: boolean;
}

export const DEFAULT_THEME: Theme = "dark";
export const DEFAULT_ACCENT: Accent = "green";

export interface SurfaceTokens {
  bg: string;
  surface: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
}

/** CIPHERA's ink/paper palette, expressed as plain hex so it can be used
 *  inside inline styles and canvas/SVG contexts that can't read CSS
 *  variables directly. Kept in sync by eye with app/globals.css. */
export function surfaceTokens(theme: Theme): SurfaceTokens {
  if (theme === "light") {
    return {
      bg: "#FAF9F6",
      surface: "#FFFFFF",
      text: "#171719",
      textSecondary: "#43454A",
      textMuted: "#606066",
      border: "#E2DFD8",
    };
  }
  return {
    bg: "#0A0B0D",
    surface: "#181B21",
    text: "#EDE9E2",
    textSecondary: "#B8B4AC",
    textMuted: "#8B8F98",
    border: "#22262E",
  };
}

const ACCENT_HEX: Record<Accent, string> = {
  green: "#5EEAD4", // thread-teal
  blue: "#818CF8", // thread-indigo
  violet: "#C084FC", // thread-violet
  pink: "#C084FC",
  orange: "#F2A93B", // signal-warn
  neutral: "#EDE9E2",
};

export function resolvedAccentHex(accent: Accent, _theme: Theme): string {
  return ACCENT_HEX[accent] ?? ACCENT_HEX.green;
}
