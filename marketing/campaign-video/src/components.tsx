import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BEAT, C, fontFamily } from "./theme";

export const useIsVertical = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

export const usePop = (delay = 0, damping = 12, stiffness = 170) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness } });
};

/** Animated mint background with floating blobs and a beat pulse. */
export const Background: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.03 * Math.exp(-(frame % BEAT) / 4);
  const blob = (x: number, y: number, size: number, color: string, speed: number) => (
    <div
      style={{
        position: "absolute",
        left: `${x + Math.sin(frame / speed) * 6}%`,
        top: `${y + Math.cos(frame / (speed * 1.3)) * 6}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        filter: "blur(90px)",
        opacity: dark ? 0.45 : 0.55,
        transform: `translate(-50%, -50%) scale(${pulse})`,
      }}
    />
  );
  return (
    <AbsoluteFill
      style={{
        background: dark
          ? `linear-gradient(135deg, ${C.mintDeep} 0%, #022C22 100%)`
          : `linear-gradient(135deg, ${C.mintLight} 0%, ${C.screen} 55%, #E0F2FE 100%)`,
        overflow: "hidden",
      }}
    >
      {blob(15, 20, 700, dark ? C.mint : "#A7F3D0", 40)}
      {blob(85, 75, 800, dark ? C.cyan : "#99F6E4", 55)}
      {blob(70, 10, 500, dark ? "#34D399" : "#BAE6FD", 33)}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${dark ? "rgba(255,255,255,0.08)" : "rgba(4,120,87,0.10)"} 2px, transparent 2px)`,
          backgroundSize: "44px 44px",
          transform: `translateY(${-(frame % 44)}px)`,
          height: "120%",
        }}
      />
    </AbsoluteFill>
  );
};

/** Words spring up one at a time. */
export const WordsIn: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  size: number;
  color?: string;
  weight?: number;
  highlight?: string[];
  align?: "left" | "center";
}> = ({ text, delay = 0, stagger = 3, size, color = C.text, weight = 900, highlight = [], align = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        fontFamily,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.05,
        letterSpacing: -size * 0.03,
        color,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: `0 ${size * 0.25}px`,
      }}
    >
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 13, stiffness: 200 } });
        const isHi = highlight.includes(w.replace(/[.,!?]/g, ""));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `translateY(${(1 - s) * size * 0.8}px) scale(${0.6 + 0.4 * s})`,
              opacity: s,
              color: isHi ? C.mint : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number; dark?: boolean }> = ({ children, delay = 0, dark }) => {
  const s = usePop(delay);
  return (
    <div
      style={{
        fontFamily,
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 22px",
        borderRadius: 999,
        background: dark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.14)",
        border: `2px solid ${C.mint}`,
        color: dark ? "#6EE7B7" : C.mintDark,
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: 2,
        textTransform: "uppercase",
        transform: `scale(${s})`,
        transformOrigin: "left center",
        opacity: s,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 6, background: C.mint }} />
      {children}
    </div>
  );
};

/** Two-column (landscape) or stacked (vertical) feature layout. */
export const FeatureLayout: React.FC<{
  eyebrow: string;
  headline: string;
  highlight?: string[];
  sub: string;
  visual: React.ReactNode;
  dark?: boolean;
}> = ({ eyebrow, headline, highlight, sub, visual, dark }) => {
  const v = useIsVertical();
  const subS = usePop(14);
  return (
    <AbsoluteFill
      style={{
        flexDirection: v ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        padding: v ? "140px 70px" : "0 110px",
        gap: v ? 70 : 90,
      }}
    >
      <div style={{ flex: v ? "0 0 auto" : "0 0 720px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div>
          <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        </div>
        <WordsIn text={headline} size={v ? 96 : 92} delay={3} highlight={highlight} color={dark ? "#fff" : C.text} />
        <div
          style={{
            fontFamily,
            fontSize: v ? 40 : 36,
            fontWeight: 500,
            lineHeight: 1.35,
            color: dark ? "#A7F3D0" : C.textSub,
            opacity: subS,
            transform: `translateY(${(1 - subS) * 30}px)`,
            maxWidth: 680,
          }}
        >
          {sub}
        </div>
      </div>
      <div style={{ flex: v ? "1 1 auto" : "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", width: v ? "100%" : undefined }}>
        {visual}
      </div>
    </AbsoluteFill>
  );
};

/** Browser chrome mockup. */
export const BrowserFrame: React.FC<{ children: React.ReactNode; width: number; height: number; url?: string; delay?: number }> = ({
  children,
  width,
  height,
  url = "smileguard.vercel.app",
  delay = 4,
}) => {
  const s = usePop(delay, 14, 120);
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 24,
        overflow: "hidden",
        background: C.surface,
        border: `2px solid ${C.border}`,
        boxShadow: "0 40px 80px rgba(4,120,87,0.25), 0 10px 20px rgba(0,0,0,0.08)",
        transform: `perspective(1600px) rotateY(${(1 - s) * -25 + Math.sin(frame / 30) * 2}deg) translateY(${(1 - s) * 200}px) scale(${0.8 + 0.2 * s})`,
        opacity: s,
        display: "flex",
        flexDirection: "column",
        fontFamily,
      }}
    >
      <div style={{ height: 56, background: "#F1F5F9", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 10 }}>
        {["#F87171", "#FBBF24", "#34D399"].map((c) => (
          <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
        ))}
        <div style={{ marginLeft: 20, flex: 1, height: 34, borderRadius: 17, background: "#fff", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 18px", fontSize: 18, color: C.textSub, gap: 8 }}>
          <span style={{ color: C.mint }}>🔒</span> {url}
        </div>
      </div>
      <div style={{ flex: 1, position: "relative", background: C.screen }}>{children}</div>
    </div>
  );
};

/** Phone mockup. */
export const PhoneFrame: React.FC<{ children: React.ReactNode; scale?: number; delay?: number }> = ({ children, scale = 1, delay = 4 }) => {
  const s = usePop(delay, 13, 130);
  const frame = useCurrentFrame();
  const W = 480 * scale;
  const H = 880 * scale;
  return (
    <div
      style={{
        width: W,
        height: H,
        borderRadius: 64 * scale,
        padding: 16 * scale,
        background: "linear-gradient(145deg, #1E293B, #0F172A)",
        boxShadow: "0 50px 100px rgba(2,44,34,0.45), inset 0 2px 0 rgba(255,255,255,0.15)",
        transform: `translateY(${(1 - s) * 400 + Math.sin(frame / 25) * 8}px) rotate(${(1 - s) * 12}deg)`,
        opacity: s,
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: 50 * scale, overflow: "hidden", background: C.screen, position: "relative", fontFamily }}>
        <div style={{ position: "absolute", top: 14 * scale, left: "50%", transform: "translateX(-50%)", width: 120 * scale, height: 32 * scale, borderRadius: 16 * scale, background: "#0F172A", zIndex: 10 }} />
        {children}
      </div>
    </div>
  );
};

export const Logo: React.FC<{ size: number }> = ({ size }) => (
  <Img src={staticFile("logo.svg")} style={{ width: size, height: size, filter: "drop-shadow(0 20px 40px rgba(4,120,87,0.4))" }} />
);

/** Fake cursor that travels between points and "clicks". */
export const Cursor: React.FC<{ path: { f: number; x: number; y: number; click?: boolean }[]; hideAfter?: number }> = ({ path, hideAfter = Infinity }) => {
  const frame = useCurrentFrame();
  const fs = path.map((p) => p.f);
  const x = interpolate(frame, fs, path.map((p) => p.x), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, fs, path.map((p) => p.y), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clickAt = path.filter((p) => p.click).map((p) => p.f);
  const press = clickAt.reduce((acc, f) => Math.max(acc, frame >= f && frame < f + 8 ? 1 - (frame - f) / 8 : 0), 0);
  const appear =
    interpolate(frame, [fs[0] - 6, fs[0]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    (frame >= hideAfter ? 0 : 1);
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 50, opacity: appear, pointerEvents: "none" }}>
      {press > 0 && (
        <div style={{ position: "absolute", left: -30, top: -30, width: 60, height: 60, borderRadius: 30, border: `4px solid ${C.mint}`, opacity: press, transform: `scale(${2 - press})` }} />
      )}
      <svg width="40" height="40" viewBox="0 0 24 24" style={{ transform: `scale(${1 - press * 0.15})`, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" }}>
        <path d="M4 2 L4 20 L9 15 L12 22 L15 21 L12 14 L19 14 Z" fill="#0F172A" stroke="#fff" strokeWidth="1.5" />
      </svg>
    </div>
  );
};

export const Check: React.FC<{ size: number; color?: string; progress?: number }> = ({ size, color = "#fff", progress = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="22" strokeDashoffset={22 * (1 - progress)} />
  </svg>
);
