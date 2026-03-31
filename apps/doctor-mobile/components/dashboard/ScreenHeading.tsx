import React from "react";
import {
  Text,
  StyleSheet,
} from "react-native";
import { theme } from "../../constants/theme.ts";

interface ScreenHeadingProps {
  title: string;
}

export default function ScreenHeading({ title }: ScreenHeadingProps) {
  return <Text style={styles.heading}>{title}</Text>;
}

const styles = StyleSheet.create({
  heading: {
    ...theme.typography.screenHeading,
    textAlign: "center",
    marginBottom: 16,
  },
});
