# SmileGuard Campaign Video

36s upbeat promo (120 BPM, scene cuts on the beat), built with [Remotion](https://remotion.dev).

```bash
npm install
npm run studio           # live preview / tweak in browser
npm run render           # out/smileguard-campaign.mp4          (1920x1080)
npm run render:vertical  # out/smileguard-campaign-vertical.mp4 (1080x1920, Reels/TikTok/Shorts)
npm run music            # (runs automatically before studio/render) original synth track -> public/music.wav
```

- Scene timing lives in `src/theme.ts` (`SCENES`), copy lives in each `src/scenes/*.tsx`.
- To use a different song, drop it in `public/` and change the `staticFile("music.wav")` in `src/Campaign.tsx`.
  Keep it ~120 BPM so cuts stay on-beat (or change `BEAT` in `theme.ts`).
