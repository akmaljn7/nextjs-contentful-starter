import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card } from '../../components/common';
import { useSettingsStore } from '../../store';

export const SettingsScreen: React.FC = () => {
  const { theme, language, notificationsEnabled, setTheme, setLanguage, toggleNotifications } = useSettingsStore();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Card variant="default" padding="none">
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.settingLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
              trackColor={{ false: Colors.gray[300], true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </Card>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Language</Text>
        <Card variant="default" padding="none">
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="language-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.settingLabel}>English</Text>
            </View>
            <Switch
              value={language === 'en'}
              onValueChange={(value) => setLanguage(value ? 'en' : 'ha')}
              trackColor={{ false: Colors.gray[300], true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={[styles.settingItem, styles.borderTop]}>
            <View style={styles.settingLeft}>
              <Ionicons name="language-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.settingLabel}>Hausa</Text>
            </View>
            <Switch
              value={language === 'ha'}
              onValueChange={(value) => setLanguage(value ? 'ha' : 'en')}
              trackColor={{ false: Colors.gray[300], true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </Card>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Card variant="default" padding="none">
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.settingLabel}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: Colors.gray[300], true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </Card>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Card variant="default" padding="none">
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.settingLabel}>Version</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>
        </Card>
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  settingValue: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
  bottomSpacing: {
    height: 32,
  },
});
