import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Defs, Mask, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react-native";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourStep {
  id: string;
  title: string;
  description: string;
  /** Key of a registered element to spotlight. Omit for a non-anchored card. */
  target?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  /** Prepares the UI for this step (open sidebar, switch tab, scroll...). Must be idempotent. */
  onEnter?: () => void;
  /** Milliseconds to wait after onEnter before measuring the target (lets animations settle). */
  delay?: number;
  /** 'center' = centered card, 'bottom' = pinned near bottom, 'auto' = smart auto-detect. */
  placement?: "auto" | "center" | "bottom";
  padding?: number;
  radius?: number;
}

interface AppTourProps {
  visible: boolean;
  steps: TourStep[];
  index: number;
  onIndexChange: (index: number) => void;
  measureTarget: (key: string) => Promise<TourRect | null>;
  onFinish: () => void;
  onSkip: () => void;
}

// ─────────────────────────────────────────
// TARGET REGISTRY HOOK
// ─────────────────────────────────────────

/**
 * Lets a screen register elements and the parent container that the tour can spotlight.
 * Usage:
 *   <View ref={tour.setContainer} collapsable={false} style={styles.mainContainer}>
 *     <View ref={tour.register("stats")} collapsable={false} />
 *   </View>
 */
export function useTourTargets() {
  const nodes = useRef<Record<string, any>>({});
  const callbacks = useRef<Record<string, (node: any) => void>>({});
  const containerRef = useRef<any>(null);

  const register = useCallback((key: string) => {
    if (!callbacks.current[key]) {
      callbacks.current[key] = (node: any) => {
        nodes.current[key] = node;
      };
    }
    return callbacks.current[key];
  }, []);

  const setContainer = useCallback((node: any) => {
    containerRef.current = node;
  }, []);

  const measure = useCallback(
    (key: string) =>
      new Promise<TourRect | null>((resolve) => {
        const node = nodes.current[key];
        const container = containerRef.current;

        if (!node || typeof node.measureInWindow !== "function") {
          resolve(null);
          return;
        }

        if (container && typeof container.measureInWindow === "function") {
          container.measureInWindow((cx: number, cy: number, cw: number, ch: number) => {
            node.measureInWindow((tx: number, ty: number, tw: number, th: number) => {
              if (!tw || !th) {
                resolve(null);
                return;
              }
              resolve({
                x: tx - cx,
                y: ty - cy,
                width: tw,
                height: th,
              });
            });
          });
        } else {
          node.measureInWindow((x: number, y: number, width: number, height: number) => {
            if (!width || !height) {
              resolve(null);
              return;
            }
            resolve({ x, y, width, height });
          });
        }
      }),
    []
  );

  return { register, setContainer, measure };
}

// ─────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────

const OVERLAY_COLOR = "rgba(2, 30, 24, 0.82)";
const LIGHT_OVERLAY_COLOR = "rgba(2, 30, 24, 0.45)";
const CARD_GAP = 12;

export default function AppTour({
  visible,
  steps,
  index,
  onIndexChange,
  measureTarget,
  onFinish,
  onSkip,
}: AppTourProps) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [containerSize, setContainerSize] = useState({ width: W, height: H });
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [displayRect, setDisplayRect] = useState<TourRect | null>(null);
  const [ready, setReady] = useState(false);

  const cardAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const holeAnim = useRef(new Animated.Value(1)).current;
  const displayRectRef = useRef<TourRect | null>(null);

  // Keep latest steps without re-triggering the step effect on every parent render
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  // Listen for hardware back button on Android to close tour cleanly
  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      onSkip();
      return true;
    });
    return () => backSub.remove();
  }, [visible, onSkip]);

  // Pulsing ring around the spotlight
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulseAnim]);

  // Smoothly glide the spotlight hole from the previous rect to the next one
  const animateHoleTo = useCallback(
    (next: TourRect | null) => {
      const from = displayRectRef.current;
      holeAnim.stopAnimation();
      holeAnim.removeAllListeners();

      if (!next || !from) {
        displayRectRef.current = next;
        setDisplayRect(next);
        return;
      }

      holeAnim.setValue(0);
      holeAnim.addListener(({ value }) => {
        const r = {
          x: from.x + (next.x - from.x) * value,
          y: from.y + (next.y - from.y) * value,
          width: from.width + (next.width - from.width) * value,
          height: from.height + (next.height - from.height) * value,
        };
        displayRectRef.current = r;
        setDisplayRect(r);
      });
      Animated.timing(holeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => holeAnim.removeAllListeners());
    },
    [holeAnim]
  );

  // Run each step: prepare UI → wait → measure → reveal card
  useEffect(() => {
    if (!visible) return;
    const current = stepsRef.current[index];
    if (!current) return;

    let cancelled = false;
    setReady(false);
    cardAnim.setValue(0);
    current.onEnter?.();

    // Default delay: 400ms if onEnter exists (drawer transitions), else 120ms
    const waitMs = current.delay ?? (current.onEnter ? 400 : 120);

    const timer = setTimeout(async () => {
      let rect: TourRect | null = null;
      if (current.target) {
        rect = await measureTarget(current.target);
        // Retry once in case layout was still settling
        if (!rect) {
          await new Promise((r) => setTimeout(r, 200));
          rect = await measureTarget(current.target);
        }
      }
      if (cancelled) return;

      const pad = current.padding ?? 6;
      const padded = rect
        ? {
            x: Math.max(0, rect.x - pad),
            y: Math.max(0, rect.y - pad),
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }
        : null;

      setTargetRect(padded);
      animateHoleTo(padded);
      setReady(true);
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 70 }).start();
    }, waitMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, index, measureTarget, animateHoleTo, cardAnim]);

  // Reset visuals when the tour closes
  useEffect(() => {
    if (!visible) {
      displayRectRef.current = null;
      setDisplayRect(null);
      setTargetRect(null);
      setReady(false);
    }
  }, [visible]);

  const goNext = () => {
    if (isLast) onFinish();
    else onIndexChange(index + 1);
  };
  const goBack = () => {
    if (index > 0) onIndexChange(index - 1);
  };

  if (!visible || !step) return null;

  const StepIcon = step.icon || Sparkles;
  const radius = step.radius ?? 12;
  const progress = (index + 1) / steps.length;
  const currentW = containerSize.width || W;
  const currentH = containerSize.height || H;

  // ─────────────────────────────────────────
  // SMART CARD POSITIONING
  // ─────────────────────────────────────────
  let cardPositionStyle: any = {};
  let arrowStyle: any = null;

  const placement = step.placement || "auto";

  if (targetRect && placement === "auto") {
    const spaceAbove = targetRect.y - insets.top;
    const spaceBelow = currentH - insets.bottom - (targetRect.y + targetRect.height);
    const estimatedCardHeight = 210;
    const arrowLeft = Math.max(28, Math.min(currentW - 56, targetRect.x + targetRect.width / 2 - 8)) - 16;

    if (spaceBelow >= estimatedCardHeight + CARD_GAP) {
      // Room below target
      cardPositionStyle = { top: targetRect.y + targetRect.height + CARD_GAP };
      arrowStyle = { top: -7, left: arrowLeft };
    } else if (spaceAbove >= estimatedCardHeight + CARD_GAP) {
      // Room above target
      cardPositionStyle = { bottom: currentH - targetRect.y + CARD_GAP };
      arrowStyle = { bottom: -7, left: arrowLeft };
    } else {
      // Target is tall (e.g. sidebar drawer or long column):
      // Safely pin card near bottom with safe area padding so nothing is cut off
      cardPositionStyle = { bottom: Math.max(insets.bottom, 16) + 10 };
      arrowStyle = null;
    }
  } else if (placement === "bottom") {
    cardPositionStyle = { bottom: Math.max(insets.bottom, 16) + 10 };
  } else {
    // Center placement
    cardPositionStyle = { top: Math.max(insets.top + 40, (currentH - 240) / 2) };
  }

  const cardTranslate = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.10] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.overlayWrapper]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }}
    >
      {/* Dimmed SVG backdrop with cutout hole */}
      <Svg width={currentW} height={currentH} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="tour-spotlight-mask" x="0" y="0" width={currentW} height={currentH}>
            <Rect x="0" y="0" width={currentW} height={currentH} fill="white" />
            {displayRect && (
              <Rect
                x={displayRect.x}
                y={displayRect.y}
                width={displayRect.width}
                height={displayRect.height}
                rx={radius}
                ry={radius}
                fill="black"
              />
            )}
          </Mask>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={currentW}
          height={currentH}
          fill={placement === "bottom" ? LIGHT_OVERLAY_COLOR : OVERLAY_COLOR}
          mask="url(#tour-spotlight-mask)"
        />
      </Svg>

      {/* Block touches underneath the tour overlay */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

      {/* Spotlight border ring and tap-to-continue hitbox */}
      {displayRect && (
        <>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: displayRect.x,
              top: displayRect.y,
              width: displayRect.width,
              height: displayRect.height,
              borderRadius: radius,
              borderWidth: 2,
              borderColor: "#34D399",
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: displayRect.x,
              top: displayRect.y,
              width: displayRect.width,
              height: displayRect.height,
              borderRadius: radius,
              borderWidth: 3,
              borderColor: "#6EE7B7",
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            }}
          />
          <Pressable
            accessibilityLabel="Continue tour"
            onPress={goNext}
            style={{
              position: "absolute",
              left: displayRect.x,
              top: displayRect.y,
              width: displayRect.width,
              height: displayRect.height,
              borderRadius: radius,
            }}
          />
        </>
      )}

      {/* Tooltip Card */}
      {ready && (
        <Animated.View
          style={[
            styles.card,
            cardPositionStyle,
            { opacity: cardAnim, transform: [{ translateY: cardTranslate }] },
          ]}
        >
          {arrowStyle && <View style={[styles.arrow, arrowStyle]} />}

          <View style={styles.cardHeader}>
            <View style={styles.iconBadge}>
              <StepIcon size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>
                Step {index + 1} of {steps.length}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {step.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onSkip}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close tour"
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.description} numberOfLines={3}>
            {step.description}
          </Text>

          {step.target && targetRect && (
            <Text style={styles.hint}>Tip: tap the highlighted area or Next to continue</Text>
          )}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>{isLast ? "" : "Skip"}</Text>
            </TouchableOpacity>

            <View style={styles.footerButtons}>
              {index > 0 && (
                <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
                  <ChevronLeft size={16} color="#047857" />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={goNext} style={styles.nextBtn} activeOpacity={0.85}>
                <Text style={styles.nextText}>
                  {isLast ? "Get started" : index === 0 ? "Start Walkthrough" : "Next"}
                </Text>
                {!isLast && <ChevronRight size={16} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    zIndex: 99999,
    elevation: 99999,
  },
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#022C22",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 1,
    borderColor: "#D1FAE5",
    zIndex: 100000,
  },
  arrow: {
    position: "absolute",
    width: 14,
    height: 14,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
    borderColor: "#D1FAE5",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10B981",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  hint: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
    marginTop: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  footerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: "#047857",
  },
  nextText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
