/**
 * NotificationBell Component
 * Displays notification indicator in dashboard header
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { HeroIcon } from '../ui/HeroIcon';

interface NotificationBellProps {
  unreadCount: number;
  onPress: () => void;
  animateOnNewNotification?: boolean;
}

export default function NotificationBell({
  unreadCount,
  onPress,
  animateOnNewNotification = false,
}: NotificationBellProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (animateOnNewNotification && unreadCount > 0) {
      // Pulse animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [unreadCount, scaleAnim, animateOnNewNotification]);

  return (
    <TouchableOpacity
      style={styles.bellContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.bellIconContainer,
          animateOnNewNotification && { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <HeroIcon name="bell" size="md" color="#0b7fab" />
      </Animated.View>

      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bellIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0b7fab',
  },

  bellIcon: {
    fontSize: 20,
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
