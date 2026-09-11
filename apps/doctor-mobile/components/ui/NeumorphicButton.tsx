import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
  View,
} from 'react-native';
import { AppColors } from '../../constants/theme';

export interface NeumorphicButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Tactile Neumorphic Button for SmileGuard Doctor Android Portal.
 * Crisp, defined borders, tactile press responses, and clinical Mint Green accents.
 */
export function NeumorphicButton({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: NeumorphicButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        pressed && !disabled && styles[`${variant}Pressed`],
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : AppColors.primary}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              styles[`${variant}Text`],
              styles[`${size}Text`],
              disabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 4, // Sharp, defined micro-radius (avoiding soft/pill bordering)
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Sizes
  sm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  md: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  lg: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  smText: {
    fontSize: 12,
  },
  mdText: {
    fontSize: 14,
  },
  lgText: {
    fontSize: 16,
  },

  // Primary (Mint Green)
  primary: {
    backgroundColor: AppColors.primary,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopColor: '#34D399',
    borderLeftColor: '#34D399',
    borderBottomColor: '#047857',
    borderRightColor: '#047857',
    elevation: 3,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  primaryPressed: {
    backgroundColor: AppColors.primaryDark,
    borderTopColor: '#047857',
    borderLeftColor: '#047857',
    borderBottomColor: '#34D399',
    borderRightColor: '#34D399',
    elevation: 1,
  },
  primaryText: {
    color: '#FFFFFF',
  },

  // Secondary (Neutral Neumorphic Surface)
  secondary: {
    backgroundColor: '#E6ECEF',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderBottomColor: '#B0BAC5',
    borderRightColor: '#B0BAC5',
    elevation: 2,
    shadowColor: '#9AA7B5',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  secondaryPressed: {
    backgroundColor: '#DDE4E8',
    borderTopColor: '#B0BAC5',
    borderLeftColor: '#B0BAC5',
    borderBottomColor: '#FFFFFF',
    borderRightColor: '#FFFFFF',
    elevation: 0,
  },
  secondaryText: {
    color: AppColors.textPrimary,
  },

  // Danger
  danger: {
    backgroundColor: AppColors.danger,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopColor: '#F87171',
    borderLeftColor: '#F87171',
    borderBottomColor: '#B91C1C',
    borderRightColor: '#B91C1C',
    elevation: 2,
  },
  dangerPressed: {
    backgroundColor: '#B91C1C',
    borderTopColor: '#B91C1C',
    borderLeftColor: '#B91C1C',
    borderBottomColor: '#F87171',
    borderRightColor: '#F87171',
  },
  dangerText: {
    color: '#FFFFFF',
  },

  // Outline
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  outlinePressed: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  outlineText: {
    color: AppColors.primaryDark,
  },

  // Disabled
  disabled: {
    backgroundColor: '#CBD5E1',
    borderTopColor: '#CBD5E1',
    borderLeftColor: '#CBD5E1',
    borderBottomColor: '#94A3B8',
    borderRightColor: '#94A3B8',
    elevation: 0,
    opacity: 0.6,
  },
  disabledText: {
    color: '#64748B',
  },
});
