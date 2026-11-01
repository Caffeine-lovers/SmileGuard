import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Background, Check, FeatureLayout, PhoneFrame, WordsIn, useIsVertical, usePop } from "../components";
import { BEAT, C, fontFamily } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const ApptCard: React.FC<{ name: string; time: string; service: string; status: "pending" | "approved" | "done"; delay: number; highlight?: boolean }> = ({
  name,
  time,
  service,
  status,
  delay,
  highlight,
}) => {
  const s = usePop(delay, 13, 180);
  const colors = { pending: [C.amber, "Pending"], approved: [C.mint, "Approved"], done: ["#64748B", "Completed"] } as const;
  const [col, label] = colors[status];
  return (
    <div
      style={{
        background: "linear-gradient(180deg,#fff,#F8FAF9)",
        borderRadius: 20,
        padding: "16px 16px",
        border: `2px solid ${highlight ? C.mint : C.border}`,
        boxShadow: highlight ? `0 0 24px rgba(16,185,129,0.4)` : "0 2px 6px rgba(0,0,0,0.06)",
        transform: `translateX(${(1 - s) * 300}px)`,
        opacity: s,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 24, flexShrink: 0, background: C.mintDark, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 19 }}>
        {name.split(" ").map((n) => n[0]).join("")}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: C.text, whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textSub, whiteSpace: "nowrap" }}>
          {time} · {service}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", background: col, padding: "6px 10px", flexShrink: 0, borderRadius: 999 }}>{label}</div>
    </div>
  );
};

export const Doctor: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useIsVertical();
  const notif = usePop(16, 11, 200);
  const notifOut = interpolate(frame, [52, 60], [0, 1], clamp);
  const approved = frame >= 66;
  const extra = usePop(24, 14, 160);
  const press = frame >= 60 && frame < 68 ? 0.92 : 1;
  return (
    <AbsoluteFill>
      <Background dark />
      <FeatureLayout
        dark
        eyebrow="Doctor Mobile App"
        headline="Your dentist approves it, chairside."
        highlight={["chairside."]}
        sub="Real-time requests, a schedule and patient records in the clinic's pocket."
        visual={
          <PhoneFrame scale={v ? 0.95 : 0.92}>
            <div style={{ padding: "70px 22px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.mintDark, letterSpacing: 1.5 }}>SMILEGUARD DOCTOR</div>
              <div style={{ fontSize: 34, fontWeight: 900, color: C.text, marginBottom: 6 }}>Today’s Schedule</div>
              <ApptCard name="Ana Reyes" time="9:00 AM" service="Checkup" status="done" delay={6} />
              <ApptCard name="Juan Dela Cruz" time="10:30 AM" service="Cleaning" status={approved ? "approved" : "pending"} delay={10} highlight />
              <ApptCard name="Maria Santos" time="1:00 PM" service="Whitening" status="approved" delay={14} />
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                <div style={{ flex: 1, padding: "18px 0", textAlign: "center", borderRadius: 16, fontSize: 22, fontWeight: 900, color: "#fff", background: approved ? C.mintDark : C.mint, boxShadow: "0 3px 0 #065F46", transform: `scale(${press})` }}>
                  {approved ? "✓ Approved" : "Approve"}
                </div>
                <div style={{ flex: 1, padding: "18px 0", textAlign: "center", borderRadius: 16, fontSize: 22, fontWeight: 900, color: C.danger, background: "#fff", border: `2px solid ${C.danger}` }}>Decline</div>
              </div>
              <div style={{ marginTop: 14, fontSize: 16, fontWeight: 800, color: C.textSub, letterSpacing: 1.5, opacity: extra }}>UPCOMING</div>
              <div style={{ display: "flex", gap: 12, opacity: extra, transform: `translateY(${(1 - extra) * 30}px)` }}>
                {[
                  ["📅", "Dec 24–26", "Clinic blockout"],
                  ["📋", "128", "Patient records"],
                ].map(([icon, big, small]) => (
                  <div key={small} style={{ flex: 1, background: C.mintLight, border: `2px dashed ${C.mint}`, borderRadius: 16, padding: "14px 14px" }}>
                    <div style={{ fontSize: 24 }}>{icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: C.text }}>{big}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.mintDark }}>{small}</div>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                top: 56,
                left: 14,
                right: 14,
                background: "rgba(15,23,42,0.92)",
                color: "#fff",
                borderRadius: 22,
                padding: "16px 18px",
                display: "flex",
                gap: 14,
                alignItems: "center",
                transform: `translateY(${(1 - notif) * -160 - notifOut * 180}px)`,
                opacity: notif,
                zIndex: 20,
              }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 12, background: C.mint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🦷</div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 900 }}>New appointment request</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#A7F3D0" }}>Juan D. · Sat, Nov 14 · 10:30 AM</div>
              </div>
            </div>
          </PhoneFrame>
        }
      />
    </AbsoluteFill>
  );
};

export const Security: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useIsVertical();
  const shield = usePop(0, 9, 160);
  const badges = ["Data Privacy Act (RA 10173)", "Row-Level Security", "PCI-DSS checkout", "Encrypted logins"];
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 46, padding: 80 }}>
        <div style={{ transform: `scale(${shield})`, position: "relative" }}>
          <svg width={v ? 240 : 200} height={v ? 270 : 225} viewBox="0 0 24 27">
            <defs>
              <linearGradient id="sh" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={C.mint} />
                <stop offset="100%" stopColor={C.mintDark} />
              </linearGradient>
            </defs>
            <path d="M12 1 L22 5 V12 C22 19 17.5 24 12 26 C6.5 24 2 19 2 12 V5 Z" fill="url(#sh)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={v ? 130 : 110} progress={interpolate(frame, [8, 22], [0, 1], clamp)} />
          </div>
        </div>
        <WordsIn text="Your health data stays yours." size={v ? 100 : 100} align="center" highlight={["yours."]} delay={6} />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, maxWidth: v ? 900 : 1500 }}>
          {badges.map((b, i) => (
            <Badge key={b} label={b} delay={20 + i * (BEAT / 2)} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Badge: React.FC<{ label: string; delay: number }> = ({ label, delay }) => {
  const s = usePop(delay, 10, 220);
  return (
    <div style={{ fontFamily, fontSize: 30, fontWeight: 800, color: C.mintDark, background: "#fff", border: `3px solid ${C.mint}`, borderRadius: 999, padding: "14px 28px", transform: `scale(${s})`, opacity: s, boxShadow: "0 8px 20px rgba(4,120,87,0.15)" }}>
      🔒 {label}
    </div>
  );
};
