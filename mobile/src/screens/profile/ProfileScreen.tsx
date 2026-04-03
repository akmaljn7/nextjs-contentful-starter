import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, Avatar, Button } from '../../components/common';
import { useAuthStore } from '../../store';
import { useTheme } from '../../contexts/ThemeContext';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, logout, deleteAccount } = useAuthStore();
  const { isDark, colors } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Calculate top padding for status bar (especially important for Android)
  const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 24) : insets.top;

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => confirmDeleteAccount()
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'This is your last chance. Type DELETE in the next prompt to confirm account deletion.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Delete My Account', 
          style: 'destructive', 
          onPress: async () => {
            setIsDeleting(true);
            const success = await deleteAccount();
            setIsDeleting(false);
            if (success) {
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
            } else {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        },
      ]
    );
  };

  const menuItems = [
    {
      id: 'messages',
      icon: 'chatbubbles-outline',
      label: 'Messages',
      onPress: () => navigation.navigate('OrdersTab', { screen: 'Messages' }),
    },
    {
      id: 'settings',
      icon: 'settings-outline',
      label: 'Settings',
      onPress: () => navigation.navigate('Settings'),
    },
    ...(user?.role === 'admin' ? [{
      id: 'admin',
      icon: 'shield-outline',
      label: 'Admin Panel',
      onPress: () => navigation.navigate('AdminPanel'),
    }] : []),
    {
      id: 'help',
      icon: 'help-circle-outline',
      label: 'Help & Support',
      onPress: () => navigation.navigate('HelpSupport'),
    },
    {
      id: 'about',
      icon: 'information-circle-outline',
      label: 'About',
      onPress: () => navigation.navigate('About'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: isDark ? colors.surface : Colors.primary }]}>
          <Avatar source={user?.avatar_url} name={user?.name} size="xl" />
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.role !== 'user' && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role}</Text>
            </View>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, { backgroundColor: colors.surface }]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: colors.gray[100] }]}>
                  <Ionicons name={item.icon as any} size={22} color={colors.textPrimary} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <Button
            title="Logout"
            variant="outline"
            onPress={handleLogout}
            fullWidth
            icon={<Ionicons name="log-out-outline" size={20} color={Colors.error} />}
            textStyle={{ color: Colors.error }}
            style={styles.logoutButton}
          />
        </View>

        {/* Delete Account */}
        <View style={styles.deleteSection}>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                <Text style={styles.deleteText}>Delete Account</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[styles.deleteWarning, { color: colors.textMuted }]}>
            This will permanently delete your account and all associated data.
          </Text>
        </View>

        {/* App Version */}
        <Text style={[styles.version, { color: colors.textMuted }]}>Adlinka v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
  },
  name: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
    marginTop: 16,
  },
  email: {
    fontSize: Fonts.size.md,
    color: Colors.white + 'aa',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  roleText: {
    color: Colors.white,
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    textTransform: 'capitalize',
  },
  menuSection: {
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.medium,
  },
  logoutSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  logoutButton: {
    borderColor: Colors.error,
  },
  deleteSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteText: {
    color: Colors.error,
    fontSize: Fonts.size.sm,
    marginLeft: 8,
    fontWeight: Fonts.weight.medium,
  },
  deleteWarning: {
    fontSize: Fonts.size.xs,
    textAlign: 'center',
    marginTop: 4,
  },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
    marginTop: 24,
    marginBottom: 32,
  },
});
