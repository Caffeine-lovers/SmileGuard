import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import {
  Check,
  X,
  Trash2,
  Bell,
  User,
  Settings,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Search,
  ArrowLeft,
  ArrowRight,
  Info,
  Building2,
  RefreshCw,
  CalendarCheck,
  LayoutDashboard,
  FileText,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Archive,
  Circle,
  Clock,
  LogOut,
  Camera,
  LucideIcon,
} from "lucide-react-native";

export type HeroIconName =
  | "check"
  | "xmark"
  | "trash"
  | "bell"
  | "user"
  | "cog"
  | "calendar"
  | "envelope"
  | "phone"
  | "map-pin"
  | "pencil"
  | "eye"
  | "eye-slash"
  | "plus"
  | "minus"
  | "search"
  | "arrow-left"
  | "arrow-right"
  | "information"
  | "clinic"
  | "refresh"
  | "appointment"
  | "dashboard"
  | "records"
  | "settings"
  | "profile"
  | "back"
  | "view"
  | "open"
  | "archive-box"
  | "circle"
  | "clock"
  | "logout"
  | "camera";

export type HeroIconSize = "xs" | "sm" | "md" | "lg" | "xl";

interface HeroIconProps {
  name: HeroIconName;
  size?: HeroIconSize | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ICON_SIZES: Record<HeroIconSize, number> = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
};

const ICON_COMPONENTS: Record<HeroIconName, LucideIcon> = {
  check: Check,
  xmark: X,
  trash: Trash2,
  bell: Bell,
  user: User,
  cog: Settings,
  calendar: Calendar,
  envelope: Mail,
  phone: Phone,
  "map-pin": MapPin,
  pencil: Pencil,
  eye: Eye,
  "eye-slash": EyeOff,
  plus: Plus,
  minus: Minus,
  search: Search,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  information: Info,
  clinic: Building2,
  refresh: RefreshCw,
  appointment: CalendarCheck,
  dashboard: LayoutDashboard,
  records: FileText,
  settings: Settings,
  profile: UserCheck,
  back: ChevronLeft,
  view: Eye,
  open: ChevronRight,
  "archive-box": Archive,
  circle: Circle,
  clock: Clock,
  logout: LogOut,
  camera: Camera,
};

export const HeroIcon: React.FC<HeroIconProps> = ({
  name,
  size = "md",
  color = "#10B981",
  style,
  testID,
}) => {
  const numericSize = typeof size === "number" ? size : ICON_SIZES[size] || 22;
  const Component = ICON_COMPONENTS[name] || Info;

  return (
    <View style={style} testID={testID}>
      <Component size={numericSize} color={color} strokeWidth={2} />
    </View>
  );
};
