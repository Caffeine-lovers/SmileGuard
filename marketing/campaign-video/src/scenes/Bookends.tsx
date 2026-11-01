import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Background, Logo, WordsIn, useIsVertical, usePop } from "../components";
import { BAR, BEAT, C, SITE_URL, fontFamily } from "../theme";

/** 0–4s: rapid-fire pain points, then the promise. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useIsVertical();
  const pains = ["Long clinic queues?", "Guessing what hurts?", "Messy payments?"];
  const idx = Math.floor(frame / BEAT);
  const showPains = frame < BEAT * 3 + 6;
  return (
    <AbsoluteFill>
      <Background dark />
      {showPains ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
          {pains.map((p, i) =>
            i === Math.min(idx, 2) ? (
              <div key={i} style={{ transform: `rotate(${(i - 1) * 3}deg)` }}>
                <WordsIn text={p} delay={i * BEAT} stagger={2} size={v ? 120 : 140} color="#fff" align="center" />
              </div>
            ) : null,
          )}
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
          <WordsIn
            text="There's a smarter way to care for your smile."
            delay={BEAT * 3 + 6}
            stagger={3}
            size={v ? 110 : 120}
            color="#fff"
            align="center"
            highlight={["smarter", "smile"]}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** 4–8s: the drop. Logo burst + tagline. */
export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useIsVertical();
  const s = usePop(0, 9, 160);
  const name = usePop(8, 14, 160);
  const ring = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        {[0, 1, 2].map((i) => {
          const p = interpolate(frame, [i * 6, i * 6 + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 300,
                height: 300,
                borderRadius: "50%",
                border: `6px solid ${C.mint}`,
                opacity: (1 - p) * 0.6,
                transform: `scale(${1 + p * 4})`,
              }}
            />
          );
        })}
        <div style={{ display: "flex", flexDirection: v ? "column" : "row", alignItems: "center", gap: v ? 30 : 50 }}>
          <div style={{ transform: `scale(${s}) rotate(${(1 - s) * -180}deg)` }}>
            <Logo size={v ? 260 : 220} />
          </div>
          <div style={{ fontFamily, fontSize: v ? 150 : 170, fontWeight: 900, letterSpacing: -6, color: C.text, opacity: name, transform: `translateX(${v ? 0 : (1 - name) * -60}px) translateY(${v ? (1 - name) * 40 : 0}px)` }}>
            Smile<span style={{ color: C.mint }}>Guard</span>
          </div>
        </div>
        <div style={{ marginTop: v ? 380 : 340, position: "absolute", top: "50%", padding: "0 60px" }}>
          <WordsIn text="AI-powered dental care, right from your browser." delay={22} size={v ? 54 : 52} weight={700} color={C.mintDark} align="center" />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: 1 - ring, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/** 32–36s: call to action. */
export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useIsVertical();
  const btn = usePop(BAR - 2, 8, 200); // lands on the final hit
  const url = usePop(16);
  const logo = usePop(0, 10);
  const glow = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <AbsoluteFill>
      <Background dark />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 50, padding: 80 }}>
        <div style={{ transform: `scale(${logo})` }}>
          <Logo size={v ? 200 : 160} />
        </div>
        <WordsIn text="Your healthiest smile starts today." size={v ? 110 : 110} color="#fff" align="center" highlight={["smile"]} />
        <div
          style={{
            fontFamily,
            fontSize: v ? 52 : 48,
            fontWeight: 800,
            color: "#6EE7B7",
            opacity: url,
            transform: `translateY(${(1 - url) * 30}px)`,
            letterSpacing: 1,
          }}
        >
          {SITE_URL}
        </div>
        <div
          style={{
            fontFamily,
            fontSize: v ? 50 : 44,
            fontWeight: 900,
            color: "#fff",
            background: `linear-gradient(180deg, ${C.mint}, ${C.mintDark})`,
            padding: "28px 64px",
            borderRadius: 999,
            transform: `scale(${btn})`,
            boxShadow: `0 0 ${40 + glow * 40}px rgba(16,185,129,${0.5 + glow * 0.3}), inset 0 2px 0 rgba(255,255,255,0.4)`,
          }}
        >
          Get started today →
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
