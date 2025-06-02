import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function SignUpScreen() {
  const { register, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const router = useRouter();

  // Check for pending email from failed Google sign-in
  useEffect(() => {
    const checkPendingEmail = async () => {
      const pendingEmail = await SecureStore.getItemAsync('pendingEmail');
      if (pendingEmail) {
        setEmail(pendingEmail);
        // Clear the pendingEmail once used
        await SecureStore.deleteItemAsync('pendingEmail');
      }
    };

    checkPendingEmail();
  }, []);

  // Clear validation error when inputs change
  useEffect(() => {
    if (validationError) {
      setValidationError('');
    }
  }, [email, password, confirmPassword, nickname]);

  // Validate form before submission
  const validateForm = () => {
    // Clear previous errors
    setValidationError('');
    clearError();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }

    // Validate nickname
    if (!nickname || nickname.length < 3) {
      setValidationError('Nickname should be at least 3 characters long');
      return false;
    }

    // Validate password
    if (password.length < 8) {
      setValidationError('Password should be at least 8 characters long');
      return false;
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }

    // Validate terms acceptance
    if (!termsAccepted) {
      setValidationError('You must accept the Terms of Service and Privacy Policy');
      return false;
    }

    return true;
  };

  // Handle sign-up
  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    const userData = {
      email,
      nickname,
      username: nickname,
      password,
      password_confirm: confirmPassword,
    };

    await register(userData);
  };

  // Navigate to terms page
  const handleTermsNavigation = () => {
    router.push('/auth/terms');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Sign up to get started!</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Error Message */}
          {(error || validationError) && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{validationError || error}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#A0A0A0"
            />
            <View style={styles.inputIcon}>
              <FontAwesome name="envelope-o" size={20} color="#A0A0A0" />
            </View>
          </View>

          {/* Nickname Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Nickname"
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="none"
              placeholderTextColor="#A0A0A0"
            />
            <View style={styles.inputIcon}>
              <FontAwesome name="user" size={20} color="#A0A0A0" />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#A0A0A0"
            />
            <Pressable 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.inputIcon}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#A0A0A0" 
              />
            </Pressable>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#A0A0A0"
            />
            <View style={styles.inputIcon}>
              <FontAwesome name="lock" size={20} color="#A0A0A0" />
            </View>
          </View>

          {/* Terms and Conditions Checkbox */}
          <View style={styles.termsContainer}>
            <TouchableOpacity 
              style={styles.checkbox} 
              onPress={() => setTermsAccepted(!termsAccepted)}
            >
              {termsAccepted ? (
                <Ionicons name="checkbox" size={20} color="#2528be" />
              ) : (
                <Ionicons name="square-outline" size={20} color="#A0A0A0" />
              )}
            </TouchableOpacity>
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={handleTermsNavigation}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={styles.termsLink} onPress={handleTermsNavigation}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleSignUp}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.signinContainer}>
            <Text style={styles.signinText}>Already have an account? </Text>
            <Link href="/auth/signin" asChild>
              <TouchableOpacity>
                <Text style={styles.signinLink}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    backgroundColor: '#2528be',
    paddingTop: Platform.OS === 'ios' ? 100 : 90,
    paddingBottom: 40,
    position: 'relative',
    zIndex: 1,
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 18,
    color: 'white',
    opacity: 0.9,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    marginTop: -25,
  },
  formCard: {
    marginTop: 30,
    backgroundColor: 'white',
    borderRadius: 24,
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingVertical: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    paddingRight: 50,
    backgroundColor: 'white',
  },
  inputIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 5,
  },
  checkbox: {
    marginRight: 10,
    paddingTop: 1,
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
  },
  termsLink: {
    color: '#2528be',
    fontWeight: '600',
  },
  signUpButton: {
    backgroundColor: '#2528be',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2528be',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signinText: {
    color: '#757575',
    fontSize: 14,
  },
  signinLink: {
    color: '#2528be',
    fontSize: 14,
    fontWeight: '700',
  },
}); 