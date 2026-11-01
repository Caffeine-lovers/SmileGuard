import React from "react";
import { Composition } from "remotion";
import { Campaign } from "./Campaign";
import { FPS, TOTAL } from "./theme";

export const Root: React.FC = () => (
  <>
    <Composition id="SmileGuardCampaign" component={Campaign} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="SmileGuardCampaignVertical" component={Campaign} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
  </>
);
