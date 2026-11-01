import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CTA, Hook, LogoReveal } from "./scenes/Bookends";
import { AIScan, Billing, Booking } from "./scenes/Features";
import { Doctor, Security } from "./scenes/Clinic";
import { SCENES, TOTAL } from "./theme";

/** Quick zoom-punch in, slide/blur out so cuts feel energetic and on-beat. */
const Punch: React.FC<{ dur: number; children: React.ReactNode; last?: boolean }> = ({ dur, children, last }) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [0, 7], [0, 1], { extrapolateRight: "clamp" });
  const outP = last ? 0 : interpolate(frame, [dur - 6, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = 1.08 - 0.08 * inP + outP * 0.12;
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale}) translateX(${outP * -80}px)`,
        filter: `blur(${(1 - inP) * 10 + outP * 14}px)`,
        opacity: 1 - outP * 0.6,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const ORDER: [keyof typeof SCENES, React.FC][] = [
  ["hook", Hook],
  ["logo", LogoReveal],
  ["scan", AIScan],
  ["booking", Booking],
  ["billing", Billing],
  ["doctor", Doctor],
  ["security", Security],
  ["cta", CTA],
];

export const Campaign: React.FC = () => (
  <AbsoluteFill style={{ background: "#022C22" }}>
    {ORDER.map(([key, Scene], i) => {
      const { from, dur } = SCENES[key];
      return (
        <Sequence key={key} from={from} durationInFrames={dur} premountFor={30} name={key}>
          <Punch dur={dur} last={i === ORDER.length - 1}>
            <Scene />
          </Punch>
        </Sequence>
      );
    })}
    <Audio
      src={staticFile("music.wav")}
      volume={(f) => interpolate(f, [TOTAL - 20, TOTAL], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  </AbsoluteFill>
);
