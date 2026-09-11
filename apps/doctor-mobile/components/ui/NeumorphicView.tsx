import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { AppColors } from '../../constants/theme';

interface NeumorphicViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'extruded' | 'inset' | 'flat' | 'mint';
  active?: boolean;
}

/**
 * Neumorphic container component for SmileGuard Android Doctor Portal.
 * Creates an extruded or inset physical surface with crisp, defined boundaries.
 */
export function NeumorphicView({
  children,
  style,
  variant = 'extruded',
  active = false,
}: NeumorphicViewProps) {
  const getVariantStyle = () => {
    if (active || variant === 'mint') {
      return styles.mintPlate;
    }
    if (variant === 'inset') {
      return styles.insetPlate;
    }
    if (variant === 'flat') {
      return styles.flatPlate;
    }
    return styles.extrudedPlate;
  };

  return (
    <View style={[styles.base, getVariantStyle(), style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: AppColors.neuBase,
    borderRadius: 4, // Sharp, defined micro-radius (avoiding soft/pill bordering)
  },
  extrudedPlate: {
    backgroundColor: '#E6ECEF',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderBottomColor: '#B0BAC5',
    borderRightColor: '#B0BAC5',
    elevation: 3,
    shadowColor: '#9AA7B5',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  insetPlate: {
    backgroundColor: '#DDE4E8',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopColor: '#B0BAC5',
    borderLeftColor: '#B0BAC5',
    borderBottomColor: '#FFFFFF',
    borderRightColor: '#FFFFFF',
  },
  flatPlate: {
    backgroundColor: '#E6ECEF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  mintPlate: {
    backgroundColor: '#E6ECEF',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopColor: '#34D399',
    borderLeftColor: '#34D399',
    borderBottomColor: '#047857',
    borderRightColor: '#047857',
    elevation: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
});
