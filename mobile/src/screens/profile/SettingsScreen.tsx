import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card } from '../../components/common';
import { useSettingsStore } from '../../store';

export const SettingsScreen: React.FC = () => {
  const { theme, language, notificationsEnabled, setTheme, setLanguage, toggleNotifications } = useSettingsStore();

  const isDarkMode = theme === 'dark';

  const handleDarkModeToggle = async (value: boolean) => {
    await setTheme(value ? 'dark' : 'light');
    Alert.alert(
      'Theme Changed',
      `${value ? 'Dark' : 'Light'} mode has been enabled.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Card variant="default" padding="none">
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? Colors.accent : Colors.gray[200] }]}>
                <Ionicons name={isDarkMode ? "moon" : "moon-outline"} size={20} color={isDarkMode ? Colors.white : Colors.textPrimary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingDescription}>
                  {isDarkMode ? 'Dark theme enabled' : 'Light theme enabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={handleDarkModeToggle}
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
              <View style={[styles.iconContainer, { backgroundColor: language === 'en' ? Colors.accent : Colors.gray[200] }]}>
                <Text style={[styles.langIcon, { color: language === 'en' ? Colors.white : Colors.textPrimary }]}>EN</Text>
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>English</Text>
                <Text style={styles.settingDescription}>English language</Text>
              </View>
            </View>
            <Switch
              value={language === 'en'}
              onValueChange={(value) => { if (value) setLanguage('en'); }}
              trackColor={{ false: Colors.gray[300], true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={[styles.settingItem, styles.borderTop]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: language === 'ha' ? Colors.accent : Colors.gray[200] }]}>
                <Text style={[styles.langIcon, { color: language === 'ha' ? Colors.white : Colors.textPrimary }]}>HA</Text>
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Hausa</Text>
                <Text style={styles.settingDescription}>Yaren Hausa</Text>
              </View>
            </View>
            <Switch
              value={language === 'ha'}
              onValueChange={(value) => { if (value) setLanguage('ha'); }}
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
              <View style={[styles.iconContainer, { backgroundColor: notificationsEnabled ? Colors.accent : Colors.gray[200] }]}>
                <Ionicons 
                  name={notificationsEnabled ? "notifications" : "notifications-outline"} 
                  size={20} 
                  color={notificationsEnabled ? Colors.white : Colors.textPrimary} 
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  {notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled'}
                </Text>
              </View>
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
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  langIcon: {
    fontSize: 14,
    fontWeight: Fonts.weight.bold,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
  },
  settingDescription: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bottomSpacing: {
    height: 32,
  },
});
