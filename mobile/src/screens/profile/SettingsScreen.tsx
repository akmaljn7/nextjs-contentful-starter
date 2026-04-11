import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card } from '../../components/common';
import { useSettingsStore } from '../../store';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n';

// Website URLs for legal pages
const PRIVACY_POLICY_URL = 'https://www.adlinka.com/privacy';
const TERMS_OF_SERVICE_URL = 'https://www.adlinka.com/terms';

export const SettingsScreen: React.FC = () => {
  const { theme, language, notificationsEnabled, setTheme, setLanguage, toggleNotifications } = useSettingsStore();
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();

  const handleDarkModeToggle = async (value: boolean) => {
    await setTheme(value ? 'dark' : 'light');
    Alert.alert(
      t.settings.themeChanged,
      value ? t.settings.darkModeEnabled : t.settings.lightModeEnabled,
      [{ text: t.common.ok }]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Appearance */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settings.appearance}</Text>
        <Card variant="default" padding="none" style={{ backgroundColor: colors.surface }}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: isDark ? colors.accent : colors.gray[200] }]}>
                <Ionicons name={isDark ? "moon" : "moon-outline"} size={20} color={isDark ? Colors.white : colors.textPrimary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.settings.darkMode}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  {isDark ? t.settings.darkModeEnabled : t.settings.lightModeEnabled}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={handleDarkModeToggle}
              trackColor={{ false: colors.gray[300], true: colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </Card>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settings.language}</Text>
        <Card variant="default" padding="none" style={{ backgroundColor: colors.surface }}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: language === 'en' ? colors.accent : colors.gray[200] }]}>
                <Text style={[styles.langIcon, { color: language === 'en' ? Colors.white : colors.textPrimary }]}>EN</Text>
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.settings.english}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>English language</Text>
              </View>
            </View>
            <Switch
              value={language === 'en'}
              onValueChange={(value) => { if (value) setLanguage('en'); }}
              trackColor={{ false: colors.gray[300], true: colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={[styles.settingItem, styles.borderTop, { borderTopColor: colors.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: language === 'ha' ? colors.accent : colors.gray[200] }]}>
                <Text style={[styles.langIcon, { color: language === 'ha' ? Colors.white : colors.textPrimary }]}>HA</Text>
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.settings.hausa}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Yaren Hausa</Text>
              </View>
            </View>
            <Switch
              value={language === 'ha'}
              onValueChange={(value) => { if (value) setLanguage('ha'); }}
              trackColor={{ false: colors.gray[300], true: colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </Card>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settings.notifications}</Text>
        <Card variant="default" padding="none" style={{ backgroundColor: colors.surface }}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: notificationsEnabled ? colors.accent : colors.gray[200] }]}>
                <Ionicons 
                  name={notificationsEnabled ? "notifications" : "notifications-outline"} 
                  size={20} 
                  color={notificationsEnabled ? Colors.white : colors.textPrimary} 
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.settings.pushNotifications}</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  {notificationsEnabled ? t.settings.notificationsEnabled : t.settings.notificationsDisabled}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.gray[300], true: colors.accent }}
              thumbColor={Colors.white}
            />
          </View>
        </Card>
      </View>

      {/* Legal */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Legal</Text>
        <Card variant="default" padding="none" style={{ backgroundColor: colors.surface }}>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: colors.gray[200] }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Privacy Policy</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  How we handle your data
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.settingItem, styles.borderTop, { borderTopColor: colors.border }]}
            onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: colors.gray[200] }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Terms of Service</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Terms and conditions
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
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
