import { loadFont } from "@remotion/google-fonts/Inter";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// Mirrors apps/patient-web/tailwind.config.js brand tokens
export const C = {
  mint: "#10B981",
  mintDark: "#047857",
  mintDeep: "#064E3B",
  mintLight: "#ECFDF5",
  cyan: "#0D9488",
  danger: "#EF4444",
  amber: "#F59E0B",
  screen: "#F4F7F6",
  surface: "#FFFFFF",
  text: "#0F172A",
  textSub: "#475569",
  border: "#CBD5E1",
};

// 120 BPM @ 30fps
export const FPS = 30;
export const BEAT = 15;
export const BAR = BEAT * 4;

export const SCENES = {
  hook: { from: 0, dur: BAR * 2 },
  logo: { from: BAR * 2, dur: BAR * 2 },
  scan: { from: BAR * 4, dur: BAR * 3 },
  booking: { from: BAR * 7, dur: BAR * 2 },
  billing: { from: BAR * 9, dur: BAR * 3 },
  doctor: { from: BAR * 12, dur: BAR * 2 },
  security: { from: BAR * 14, dur: BAR * 2 },
  cta: { from: BAR * 16, dur: BAR * 2 },
} as const;

export const TOTAL = BAR * 18;
export const SITE_URL = "smileguard.vercel.app";
