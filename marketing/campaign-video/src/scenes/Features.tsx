import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Background, BrowserFrame, Check, Cursor, FeatureLayout, useIsVertical, usePop } from "../components";
import { BEAT, C, fontFamily } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ───────────────────────── AI SCAN ───────────────────────── */

const TX0 = 0.17;
const TSPAN = 0.66;

const Mouth: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const teeth = 8;
  const tw = (w * TSPAN) / teeth;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <radialGradient id="m" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#4C0519" />
          <stop offset="100%" stopColor="#1F0209" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="#FBCFE8" />
      <ellipse cx={w / 2} cy={h / 2} rx={w * 0.47} ry={h * 0.44} fill="#BE185D" opacity={0.55} />
      <ellipse cx={w / 2} cy={h / 2} rx={w * 0.44} ry={h * 0.37} fill="url(#m)" />
      {/* gums */}
      <rect x={w * (TX0 - 0.01)} y={h * 0.2} width={w * (TSPAN + 0.02)} height={h * 0.1} rx={20} fill="#F472B6" />
      <rect x={w * (TX0 - 0.01)} y={h * 0.7} width={w * (TSPAN + 0.02)} height={h * 0.1} rx={20} fill="#F472B6" />
      {Array.from({ length: teeth }).map((_, i) => {
        const x = w * TX0 + i * tw;
        const stained = i === 5;
        return (
          <g key={i}>
            <rect x={x + 3} y={h * 0.26} width={tw - 6} height={h * 0.2} rx={12} fill={stained ? "#FDE68A" : "#FFFBF5"} />
            <rect x={x + 3} y={h * 0.54} width={tw - 6} height={h * 0.18} rx={12} fill="#FFFBF5" />
          </g>
        );
      })}
      {/* lesions */}
      <circle cx={w * TX0 + tw * 2.5} cy={h * 0.36} r={9} fill="#57534E" />
      <rect x={w * TX0 + tw * 6 + 6} y={h * 0.66} width={tw - 12} height={8} rx={4} fill="#A8A29E" />
    </svg>
  );
};

const DetectBox: React.FC<{ x: number; y: number; w: number; h: number; label: string; color: string; delay: number }> = ({ x, y, w, h, label, color, delay }) => {
  const s = usePop(delay, 10, 220);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, border: `4px solid ${color}`, borderRadius: 8, transform: `scale(${0.4 + 0.6 * s})`, opacity: s, boxShadow: `0 0 20px ${color}` }}>
      <div style={{ position: "absolute", bottom: "100%", left: -4, marginBottom: 6, background: color, color: "#fff", fontFamily, fontWeight: 800, fontSize: 20, padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap" }}>
        {label}
      </div>
    </div>
  );
};

export const AIScan: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useIsVertical();
  const W = v ? 900 : 940;
  const H = v ? 760 : 660;
  const imgW = W - 80;
  const imgH = H - 56 - 190;
  const scanY = interpolate(frame, [18, 60], [0, imgH], clamp);
  const scanning = frame >= 18 && frame < 64;
  const pct = Math.round(interpolate(frame, [18, 60], [0, 100], clamp));
  const tw = (imgW * TSPAN) / 8;
  const result = usePop(110, 12, 160);
  return (
    <AbsoluteFill>
      <Background />
      <FeatureLayout
        eyebrow="AI Oral Screening"
        headline="Snap a photo. Get answers in seconds."
        highlight={["seconds."]}
        sub="Our YOLOv8 vision model checks for 5 oral conditions: caries, cavities, tartar, gingivitis & discoloration."
        visual={
          <BrowserFrame width={W} height={H} url="smileguard.vercel.app/analysis">
            <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ position: "relative", width: imgW, height: imgH, borderRadius: 16, overflow: "hidden" }}>
                <Mouth w={imgW} h={imgH} />
                {scanning && (
                  <div style={{ position: "absolute", left: 0, top: scanY - 60, width: "100%", height: 60, background: `linear-gradient(180deg, transparent, rgba(16,185,129,0.55))`, borderBottom: `4px solid ${C.mint}`, boxShadow: `0 0 30px ${C.mint}` }} />
                )}
                <DetectBox x={imgW * TX0 + tw * 2} y={imgH * 0.27} w={tw} h={imgH * 0.2} label="Caries · 91%" color={C.danger} delay={66} />
                <DetectBox x={imgW * TX0 + tw * 5} y={imgH * 0.27} w={tw} h={imgH * 0.2} label="Discoloration · 84%" color={C.amber} delay={66 + BEAT / 2} />
                <DetectBox x={imgW * TX0 + tw * 6} y={imgH * 0.6} w={tw} h={imgH * 0.15} label="Calculus · 78%" color="#8B5CF6" delay={66 + BEAT} />
                <DetectBox x={imgW * (TX0 + 0.01)} y={imgH * 0.68} w={imgW * 0.22} h={imgH * 0.12} label="Gingivitis · 72%" color="#EC4899" delay={66 + BEAT * 1.5} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily }}>
                {frame < 64 ? (
                  <>
                    <div style={{ flex: 1, height: 18, borderRadius: 9, background: "#E2E8F0", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${C.mint}, ${C.cyan})` }} />
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.mintDark, width: 220 }}>Scanning {pct}%</div>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: result, transform: `translateY(${(1 - result) * 20}px)` }}>
                    <div style={{ width: 56, height: 56, borderRadius: 28, background: C.mint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={36} progress={result} />
                    </div>
                    <div>
                      <div style={{ fontSize: 30, fontWeight: 900, color: C.text }}>4 findings detected</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: C.textSub }}>Explainable AI highlights · Book a checkup</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </BrowserFrame>
        }
      />
    </AbsoluteFill>
  );
};

/* ───────────────────────── BOOKING ───────────────────────── */

export const Booking: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useIsVertical();
  const W = v ? 900 : 920;
  const H = v ? 760 : 660;
  const picked = frame >= 30;
  const slotPicked = frame >= 62;
  const confirmed = frame >= 88;
  const slots = usePop(32);
  const done = usePop(88, 10, 200);
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const offset = 0; // Nov 1 2026 is a Sunday
  const cell = 70;
  const gridX = 40;
  const gridY = 56 + 40 + 70;
  const dayPos = (d: number) => {
    const idx = d - 1 + offset;
    return { x: gridX + (idx % 7) * (cell + 8), y: gridY + Math.floor(idx / 7) * (cell + 8) };
  };
  const p14 = dayPos(14);
  const slotsX = gridX + 7 * (cell + 8) + 30;
  return (
    <AbsoluteFill>
      <Background />
      <FeatureLayout
        eyebrow="Smart Booking"
        headline="Book your visit in three taps."
        highlight={["three", "taps."]}
        sub="Live slot availability with conflict detection, so no double-bookings and no phone tag."
        visual={
          <div style={{ position: "relative" }}>
            <BrowserFrame width={W} height={H} url="smileguard.vercel.app/appointments">
              <div style={{ padding: 40, fontFamily, display: "flex", gap: 30 }}>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: C.text, marginBottom: 20 }}>November 2026</div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${cell}px)`, gap: 8 }}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <div key={i} style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: C.textSub }}>{d}</div>
                    ))}
                    {days.map((d) => {
                      const sel = picked && d === 14;
                      const off = d % 7 === 1; // Sundays closed
                      const pop = sel ? 1 + 0.15 * Math.exp(-(frame - 30) / 5) : 1;
                      return (
                        <div
                          key={d}
                          style={{
                            height: cell,
                            borderRadius: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                            fontWeight: 800,
                            background: sel ? C.mint : off ? "#F1F5F9" : "#fff",
                            color: sel ? "#fff" : off ? "#CBD5E1" : C.text,
                            border: `2px solid ${sel ? C.mintDark : C.border}`,
                            transform: `scale(${pop})`,
                            textDecoration: off ? "line-through" : undefined,
                          }}
                        >
                          {d}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {(
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, opacity: slots, transform: `translateX(${(1 - slots) * 40}px)`, marginTop: 70 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.textSub }}>Sat, Nov 14</div>
                    {["9:00 AM", "10:30 AM", "1:00 PM", "3:30 PM"].map((t) => {
                      const sel = slotPicked && t === "10:30 AM";
                      return (
                        <div key={t} style={{ padding: "16px 0", textAlign: "center", borderRadius: 12, fontSize: 24, fontWeight: 800, background: sel ? C.mint : "#fff", color: sel ? "#fff" : C.mintDark, border: `2px solid ${sel ? C.mintDark : C.mint}` }}>
                          {t}
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 10, padding: "18px 0", textAlign: "center", borderRadius: 12, fontSize: 24, fontWeight: 900, color: "#fff", background: confirmed ? C.mintDark : `linear-gradient(180deg, ${C.mint}, ${C.mintDark})`, boxShadow: "0 3px 0 #065F46" }}>
                      Confirm
                    </div>
                  </div>
                )}
              </div>
              {confirmed && (
                <AbsoluteFill style={{ background: `rgba(244,247,246,${0.96 * done})`, alignItems: "center", justifyContent: "center" }}>
                  <div style={{ transform: `scale(${done})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, fontFamily }}>
                    <div style={{ width: 140, height: 140, borderRadius: 70, background: C.mint, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px ${C.mint}` }}>
                      <Check size={90} progress={done} />
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: C.text }}>Appointment requested!</div>
                    <div style={{ fontSize: 26, fontWeight: 600, color: C.textSub }}>Sat, Nov 14 · 10:30 AM · Cleaning</div>
                  </div>
                </AbsoluteFill>
              )}
            </BrowserFrame>
            <Cursor
              path={[
                { f: 12, x: W * 0.9, y: H * 0.9 },
                { f: 28, x: p14.x + cell / 2, y: p14.y + cell / 2 + 56, click: true },
                { f: 46, x: p14.x + cell / 2, y: p14.y + cell / 2 + 56 },
                { f: 60, x: slotsX + 90, y: 56 + 40 + 70 + 36 + 14 + 62 + 30, click: true },
                { f: 72, x: slotsX + 90, y: 56 + 40 + 70 + 36 + 14 + 62 + 30 },
                { f: 86, x: slotsX + 90, y: 56 + 40 + 70 + 36 + 14 + 4 * 76 + 40, click: true },
              ]}
              hideAfter={92}
            />
          </div>
        }
      />
    </AbsoluteFill>
  );
};

/* ───────────────────────── BILLING ───────────────────────── */

export const Billing: React.FC = () => {
  const frame = useCurrentFrame();
  const v = useIsVertical();
  const W = v ? 860 : 820;
  const H = v ? 800 : 700;
  const disc = usePop(30, 12, 180);
  const total = interpolate(frame, [36, 60], [5000, 4000], clamp);
  const methods = ["Card", "GCash", "Maya", "GrabPay"];
  const paid = frame >= 120;
  const paidS = usePop(120, 10, 200);
  const row = (label: string, val: string, color = C.text, bold = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, fontWeight: bold ? 900 : 700, color }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{val}</span>
    </div>
  );
  const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <AbsoluteFill>
      <Background />
      <FeatureLayout
        eyebrow="Seamless Payments"
        headline="Pay online. Discounts applied automatically."
        highlight={["automatically."]}
        sub="Secure PayMongo checkout with the 20% Senior Citizen & PWD discount applied for you."
        visual={
          <div style={{ position: "relative" }}>
            <BrowserFrame width={W} height={H} url="smileguard.vercel.app/billing">
              <div style={{ padding: 44, fontFamily, display: "flex", flexDirection: "column", gap: 22 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.textSub, letterSpacing: 2 }}>INVOICE · TREATMENT</div>
                {row("Teeth Whitening", peso(5000))}
                <div style={{ opacity: disc, transform: `translateX(${(1 - disc) * 60}px)`, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ background: C.mintLight, border: `2px solid ${C.mint}`, borderRadius: 999, padding: "6px 16px", fontSize: 20, fontWeight: 900, color: C.mintDark }}>✓ Senior / PWD verified</div>
                  <div style={{ flex: 1 }}>{row("−20%", `−${peso(1000 * disc)}`, C.mintDark)}</div>
                </div>
                <div style={{ height: 2, background: C.border }} />
                {row("Total due", peso(total), C.text, true)}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 6 }}>
                  {methods.map((m, i) => (
                    <MethodChip key={m} label={m} delay={64 + i * 5} selected={frame >= 98 && m === "GCash"} />
                  ))}
                </div>
                <div style={{ marginTop: 8, padding: "22px 0", textAlign: "center", borderRadius: 14, fontSize: 30, fontWeight: 900, color: "#fff", background: paid ? C.mintDark : `linear-gradient(180deg, ${C.mint}, ${C.mintDark})`, boxShadow: "0 3px 0 #065F46" }}>
                  Pay {peso(total)} via PayMongo
                </div>
              </div>
              {paid && (
                <AbsoluteFill style={{ background: `rgba(244,247,246,${0.96 * paidS})`, alignItems: "center", justifyContent: "center" }}>
                  <div style={{ transform: `scale(${paidS}) rotate(${(1 - paidS) * -10}deg)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, fontFamily }}>
                    <div style={{ width: 140, height: 140, borderRadius: 70, background: C.mint, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px ${C.mint}` }}>
                      <Check size={90} progress={paidS} />
                    </div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: C.text }}>Paid & settled!</div>
                    <div style={{ fontSize: 26, fontWeight: 600, color: C.textSub }}>You saved ₱1,000.00</div>
                  </div>
                </AbsoluteFill>
              )}
            </BrowserFrame>
            <Cursor
              path={[
                { f: 76, x: W * 0.9, y: H * 0.95 },
                { f: 96, x: 44 + ((W - 88 - 36) / 4) * 1.5 + 12, y: 56 + 44 + 330 + 30, click: true },
                { f: 106, x: 44 + ((W - 88 - 36) / 4) * 1.5 + 12, y: 56 + 44 + 330 + 30 },
                { f: 118, x: W / 2, y: 56 + 44 + 330 + 130, click: true },
              ]}
              hideAfter={124}
            />
          </div>
        }
      />
    </AbsoluteFill>
  );
};

const MethodChip: React.FC<{ label: string; delay: number; selected: boolean }> = ({ label, delay, selected }) => {
  const s = usePop(delay, 10, 220);
  return (
    <div style={{ padding: "16px 0", textAlign: "center", borderRadius: 12, fontSize: 22, fontWeight: 900, background: selected ? C.mintLight : "#fff", border: `3px solid ${selected ? C.mint : C.border}`, color: C.text, transform: `scale(${s})`, opacity: s }}>
      {label}
    </div>
  );
};
