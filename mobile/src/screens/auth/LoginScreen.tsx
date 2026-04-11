import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Button, Input } from '../../components/common';
import { useAuthStore } from '../../store';
import { validateLoginForm } from '../../utils/validators';
import { AuthStackParamList } from '../../types/navigation';
import { useSettings } from '../../contexts/SettingsContext';

// Dynamically import Google Sign-In to prevent crashes in Expo Go
let GoogleSignin: any = null;
let statusCodes: any = {};
try {
  const googleSignIn = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSignIn.GoogleSignin;
  statusCodes = googleSignIn.statusCodes;
} catch (e) {
  // Google Sign-In not available (running in Expo Go)
  console.log('Google Sign-In not available - requires development/production build');
}

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login, appleLogin, googleLogin, isLoading, error, clearError } = useAuthStore();
  const { getLogoUrl, isLoading: settingsLoading } = useSettings();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [logoError, setLogoError] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [googleAuthAvailable, setGoogleAuthAvailable] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const logoUrl = getLogoUrl('login');

  useEffect(() => {
    // Check if Apple Authentication is available (iOS 13+)
    const checkAppleAuth = async () => {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      setAppleAuthAvailable(isAvailable);
    };
    checkAppleAuth();

    // Configure Google Sign-In (only if available - not in Expo Go)
    if (GoogleSignin) {
      try {
        GoogleSignin.configure({
          webClientId: '79558932759-8hn7kfbob9bgv8glpuvieod6sibp3i7b.apps.googleusercontent.com',
          iosClientId: '79558932759-025f0627p5qvq5oh6s5r9l29dgtavehm.apps.googleusercontent.com',
          offlineAccess: true,
        });
        setGoogleAuthAvailable(true);
      } catch (e) {
        console.log('Failed to configure Google Sign-In:', e);
        setGoogleAuthAvailable(false);
      }
    }
  }, []);

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      clearError();
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Extract user info from credential
      const { identityToken, email: appleEmail, fullName, user } = credential;
      
      if (identityToken) {
        // Build name from Apple's fullName object
        const name = fullName?.givenName && fullName?.familyName 
          ? `${fullName.givenName} ${fullName.familyName}`
          : fullName?.givenName || 'Apple User';
        
        await appleLogin({
          identityToken,
          email: appleEmail || undefined,
          name,
          appleUserId: user,
        });
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in flow
        console.log('Apple sign-in canceled');
      } else {
        Alert.alert('Sign in Failed', 'Unable to sign in with Apple. Please try again.');
        console.error('Apple sign-in error:', error);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GoogleSignin) {
      Alert.alert(
        'Not Available',
        'Google Sign-In is only available in production builds. Please use email/password to sign in while testing in Expo Go.'
      );
      return;
    }

    try {
      setGoogleLoading(true);
      clearError();
      
      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Sign in
      const response = await GoogleSignin.signIn();
      console.log('Google Sign-In Response:', JSON.stringify(response, null, 2));
      
      // Handle both response structures (v16+ uses response.data, older uses response directly)
      const userData = response.data?.user || response.user || response.data;
      const idToken = response.data?.idToken || response.idToken;
      
      if (userData && userData.email) {
        await googleLogin({
          idToken: idToken || 'no-token',
          email: userData.email,
          name: userData.name || userData.givenName || 'Google User',
          googleUserId: userData.id,
          photo: userData.photo || undefined,
        });
      } else {
        Alert.alert('Sign in Failed', 'Could not retrieve user information from Google.');
        console.error('Google Sign-In: No user data in response', response);
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User canceled the sign-in flow
        console.log('Google sign-in canceled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Sign-in already in progress
        console.log('Google sign-in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available. Please update or enable it.');
      } else {
        Alert.alert('Sign in Failed', 'Unable to sign in with Google. Please try again.');
        console.error('Google sign-in error:', error);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    clearError();
    
    // Validate form
    const errors = validateLoginForm(email, password);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});
    await login({ email, password });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            {settingsLoading ? (
              <View style={styles.logoPlaceholder}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
            ) : !logoError ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.logoImage}
                resizeMode="contain"
                onError={() => setLogoError(true)}
              />
            ) : null}
            <Text style={styles.tagline}>Book trusted ads across Northern Nigeria</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={formErrors.email}
              leftIcon={<Ionicons name="mail-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              error={formErrors.password}
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />}
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.loginButton}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign in with Apple - iOS only */}
            {Platform.OS === 'ios' && appleAuthAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}

            {/* Loading indicator for Apple Sign-in */}
            {appleLoading && (
              <View style={styles.socialLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.socialLoadingText}>Signing in with Apple...</Text>
              </View>
            )}

            {/* Sign in with Google - Both platforms */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              <Image
                source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                style={styles.googleIcon}
              />
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </TouchableOpacity>

            {/* Loading indicator for Google Sign-in */}
            {googleLoading && (
              <View style={styles.socialLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.socialLoadingText}>Signing in with Google...</Text>
              </View>
            )}

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 40,  // 👈 ADJUST THIS: Controls how far down the logo starts
  },
  logoPlaceholder: {
    width: 180,
    height: 80,
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 180,
    height: 80,
    marginBottom: 4,
  },
  tagline: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  title: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    color: Colors.error,
    fontSize: Fonts.size.sm,
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: Colors.accent,
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
  },
  loginButton: {
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: Colors.textMuted,
    fontSize: Fonts.size.sm,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: Colors.textSecondary,
    fontSize: Fonts.size.md,
  },
  registerLink: {
    color: Colors.accent,
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: 16,
  },
  googleButton: {
    width: '100%',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.medium,
  },
  socialLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  socialLoadingText: {
    marginLeft: 8,
    color: Colors.textSecondary,
    fontSize: Fonts.size.sm,
  },
});
