import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { getStatusColor, getStatusLabel } from '../../utils/formatters';

interface BadgeProps {
  text: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'status';
  size?: 'sm' | 'md';
  status?: string; // For status variant
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  variant = 'default',
  size = 'md',
  status,
  style,
}) => {
  const getColors = () => {
    if (variant === 'status' && status) {
      return getStatusColor(status);
    }

    const colors: Record<string, { bg: string; text: string }> = {
      default: { bg: Colors.gray[200], text: Colors.gray[700] },
      success: { bg: Colors.successLight, text: '#047857' },
      warning: { bg: Colors.warningLight, text: '#b45309' },
      error: { bg: Colors.errorLight, text: '#b91c1c' },
      info: { bg: Colors.infoLight, text: '#1d4ed8' },
    };

    return colors[variant];
  };

  const { bg, text: textColor } = getColors();
  const displayText = variant === 'status' && status ? getStatusLabel(status) : text;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        size === 'sm' && styles.badgeSm,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor },
          size === 'sm' && styles.textSm,
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
  },
  textSm: {
    fontSize: Fonts.size.xs,
  },
});
