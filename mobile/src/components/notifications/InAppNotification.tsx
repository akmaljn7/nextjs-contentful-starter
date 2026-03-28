import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface InAppNotificationProps {
  visible: boolean;
  title: string;
  body: string;
  type?: 'order_update' | 'consultation_update' | 'consultation_scheduled' | 'message' | 'default';
  onPress?: () => void;
  onDismiss: () => void;
  duration?: number;
}

export const InAppNotification: React.FC<InAppNotificationProps> = ({
  visible,
  title,
  body,
  type = 'default',
  onPress,
  onDismiss,
  duration = 4000,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const getIconName = () => {
    switch (type) {
      case 'order_update':
        return 'receipt-outline';
      case 'consultation_update':
      case 'consultation_scheduled':
        return 'calendar-outline';
      case 'message':
        return 'chatbubble-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'order_update':
        return Colors.accent;
      case 'consultation_update':
      case 'consultation_scheduled':
        return Colors.success;
      case 'message':
        return Colors.info;
      default:
        return Colors.primary;
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={() => {
          onPress?.();
          handleDismiss();
        }}
        activeOpacity={0.9}
      >
        <View style={[styles.iconContainer, { backgroundColor: getIconColor() + '20' }]}>
          <Ionicons name={getIconName()} size={24} color={getIconColor()} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {body}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontWeight: Fonts.weight.semibold,
    fontSize: Fonts.size.base,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  body: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
});
