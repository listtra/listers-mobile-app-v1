import { FontAwesome } from '@expo/vector-icons';
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
      password,
      password2: confirmPassword,
    };

    await register(userData);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      
      {/* Purple Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSubtitle}>Sign up to get started!</Text>
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
            <FontAwesome name="envelope-o" size={18} color="#A0A0A0" style={styles.inputIcon} />
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
            <FontAwesome name="user" size={18} color="#A0A0A0" style={styles.inputIcon} />
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
              <FontAwesome 
                name={showPassword ? "eye-slash" : "eye"} 
                size={18} 
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
            <FontAwesome name="lock" size={18} color="#A0A0A0" style={styles.inputIcon} />
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleSignUp}
            disabled={isLoading}
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
    backgroundColor: '#6200EA', // Replace with your app's primary color
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    marginTop: -20,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    marginBottom: 16,
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    paddingRight: 40, // Space for the icon
    backgroundColor: '#F9F9F9',
  },
  inputIcon: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  signUpButton: {
    backgroundColor: '#6200EA',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signinText: {
    color: '#757575',
    fontSize: 14,
  },
  signinLink: {
    color: '#6200EA',
    fontSize: 14,
    fontWeight: '600',
  },
}); 