import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

export type HeroIconName =
  | "check" | "xmark" | "trash" | "bell" | "user" | "cog"
  | "calendar" | "envelope" | "phone" | "map-pin" | "pencil"
  | "eye" | "eye-slash" | "plus" | "minus" | "search"
  | "arrow-left" | "arrow-right" | "information" | "clinic" | "refresh"
  | "appointment" | "dashboard" | "records" | "settings" | "profile"
  | "back" | "view" | "open" | "archive-box" | "circle";

export type HeroIconSize = "xs" | "sm" | "md" | "lg" | "xl";

interface HeroIconProps {
  name: HeroIconName;
  size?: HeroIconSize;
  color?: string;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}

const ICON_SIZES: Record<HeroIconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

const ICON_PATHS: Record<HeroIconName, any> = {
  check: require("../../assets/images/icon/check.png"),
  xmark: require("../../assets/images/icon/close.png"),
  trash: require("../../assets/images/icon/trash.png"),
  bell: require("../../assets/images/icon/bell.png"),
  user: require("../../assets/images/icon/profile.png"),
  cog: require("../../assets/images/icon/settings.png"),
  calendar: require("../../assets/images/icon/appointment.png"),
  envelope: require("../../assets/images/icon/bell.png"),
  phone: require("../../assets/images/icon/close.png"),
  "map-pin": require("../../assets/images/icon/clinic.png"),
  pencil: require("../../assets/images/icon/settings.png"),
  eye: require("../../assets/images/icon/view.png"),
  "eye-slash": require("../../assets/images/icon/view.png"),
  plus: require("../../assets/images/icon/check.png"),
  minus: require("../../assets/images/icon/trash.png"),
  search: require("../../assets/images/icon/close.png"),
  "arrow-left": require("../../assets/images/icon/back.png"),
  "arrow-right": require("../../assets/images/icon/close.png"),
  information: require("../../assets/images/icon/bell.png"),
  clinic: require("../../assets/images/icon/clinic.png"),
  refresh: require("../../assets/images/icon/refresh.png"),
  appointment: require("../../assets/images/icon/appointment.png"),
  dashboard: require("../../assets/images/icon/dashboard.png"),
  records: require("../../assets/images/icon/records.png"),
  settings: require("../../assets/images/icon/settings.png"),
  profile: require("../../assets/images/icon/profile.png"),
  back: require("../../assets/images/icon/back.png"),
  view: require("../../assets/images/icon/view.png"),
  open: require("../../assets/images/icon/open.png"),
  "archive-box": require("../../assets/images/icon/close.png"),
  circle: require("../../assets/images/icon/check.png"),
};

export const HeroIcon: React.FC<HeroIconProps> = ({
  name,
  size = "md",
  color = "#0b7fab",
  style,
  testID,
}) => {
  const iconSize = ICON_SIZES[size];
  const source = ICON_PATHS[name];

  return (
    <Image
      source={source}
      style={[
        {
          width: iconSize,
          height: iconSize,
          resizeMode: "contain",
          tintColor: color,
        },
        style,
      ]}
      testID={testID}
    />
  );
};
