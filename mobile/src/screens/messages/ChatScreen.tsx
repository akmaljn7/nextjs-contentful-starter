import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

export const ChatScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Chat</Text>
    <Text style={styles.subtitle}>Coming soon...</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  title: { fontSize: Fonts.size['2xl'], fontWeight: Fonts.weight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: Fonts.size.md, color: Colors.textSecondary, marginTop: 8 },
});
