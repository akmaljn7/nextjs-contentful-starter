import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Platform,
  StyleProp,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useTheme } from '../../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padding = 'md',
}) => {
  const { colors } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surface,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
            },
            android: {
              elevation: 4,
            },
          }),
        };
      case 'outlined':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        };
      default:
        return {
          backgroundColor: colors.surface,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
            },
            android: {
              elevation: 2,
            },
          }),
        };
    }
  };

  const getPaddingStyle = (): ViewStyle => {
    const paddingValues = {
      none: 0,
      sm: 12,
      md: 16,
      lg: 24,
    };
    return { padding: paddingValues[padding] };
  };

  return (
    <View style={[styles.card, getVariantStyle(), getPaddingStyle(), style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
