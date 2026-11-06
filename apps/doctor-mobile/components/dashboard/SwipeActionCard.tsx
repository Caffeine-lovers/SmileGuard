/**
 * Wraps a card so it can be swiped: right for the positive action, left for the negative one.
 * The card flies off, the action fires, and the card snaps back showing the updated patient.
 */

import React, { ReactNode, useMemo, useRef } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 90;

interface SwipeActionCardProps {
  children: ReactNode;
  enabled: boolean;
  rightLabel: string;
  leftLabel: string;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
}

export default function SwipeActionCard({
  children,
  enabled,
  rightLabel,
  leftLabel,
  onSwipeRight,
  onSwipeLeft,
}: SwipeActionCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const latest = useRef({ enabled, onSwipeRight, onSwipeLeft });
  latest.current = { enabled, onSwipeRight, onSwipeLeft };

  const panResponder = useMemo(() => {
    const snapBack = () =>
      Animated.spring(translateX, { toValue: 0, useNativeDriver: false, friction: 7 }).start();

    const fling = (direction: 1 | -1) =>
      Animated.timing(translateX, {
        toValue: direction * SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: false,
      }).start(() => {
        if (direction === 1) latest.current.onSwipeRight();
        else latest.current.onSwipeLeft();
        translateX.setValue(0);
      });

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        latest.current.enabled && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => translateX.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) fling(1);
        else if (g.dx < -SWIPE_THRESHOLD) fling(-1);
        else snapBack();
      },
      onPanResponderTerminate: snapBack,
    });
  }, [translateX]);

  const rightOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const leftOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-6deg", "0deg", "6deg"],
  });

  return (
    <View style={styles.wrap}>
      {enabled && (
        <>
          <Animated.View style={[styles.background, styles.backgroundRight, { opacity: rightOpacity }]}>
            <View style={[styles.iconCircle, styles.iconCircleRight]}>
              <Check size={20} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={[styles.label, styles.labelRight]}>{rightLabel}</Text>
          </Animated.View>
          <Animated.View style={[styles.background, styles.backgroundLeft, { opacity: leftOpacity }]}>
            <Text style={[styles.label, styles.labelLeft]}>{leftLabel}</Text>
            <View style={[styles.iconCircle, styles.iconCircleLeft]}>
              <X size={20} color="#FFFFFF" strokeWidth={3} />
            </View>
          </Animated.View>
        </>
      )}
      <Animated.View style={{ transform: [{ translateX }, { rotate }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 10,
  },
  backgroundRight: {
    backgroundColor: "#D1FAE5",
    justifyContent: "flex-start",
  },
  backgroundLeft: {
    backgroundColor: "#FFE4E6",
    justifyContent: "flex-end",
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleRight: {
    backgroundColor: "#059669",
  },
  iconCircleLeft: {
    backgroundColor: "#E11D48",
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
  },
  labelRight: {
    color: "#047857",
  },
  labelLeft: {
    color: "#BE123C",
  },
});
