import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

export interface PasswordStrengthMeterProps {
  strengthPercent: number;
}

const getStrengthColor = (percent: number) =>
  percent <= 40 ? "#ef4444" : percent <= 70 ? "#f59e0b" : "#22c55e";

const getStrengthLabel = (percent: number) => {
  if (percent <= 40) return "Weak";
  if (percent <= 70) return "Fair";
  if (percent < 100) return "Good";
  return "Strong ✓";
};

export default function PasswordStrengthMeter({
  strengthPercent,
}: PasswordStrengthMeterProps) {
  const strengthColor = getStrengthColor(strengthPercent);
  const strengthLabel = getStrengthLabel(strengthPercent);

  return (
    <React.Fragment>
      <View style={styles.strengthBarBg}>
        <View
          style={[
            styles.strengthBarFill,
            { width: `${strengthPercent}%`, backgroundColor: strengthColor },
          ]}
        />
      </View>
      <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
    </React.Fragment>
  );
}

const styles = StyleSheet.create({
  strengthBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e5e7eb",
    marginBottom: 6,
  },
  strengthBarFill: {
    height: 6,
    borderRadius: 3,
  },
  strengthLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
});
