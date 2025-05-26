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

export default function SignInScreen() {
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const router = useRouter();

  // Check for pending email from failed Google sign-in
  useEffect(() => {
    const checkPendingEmail = async () => {
      const pendingEmail = await SecureStore.getItemAsync('pendingEmail');
      if (pendingEmail) {
        setShowSignupPrompt(true);
        setEmail(pendingEmail);
      }
    };

    checkPendingEmail();
  }, []);

  // Check if error contains sign-up prompt
  useEffect(() => {
    if (error && error.includes('Please sign up first')) {
      setShowSignupPrompt(true);
    }
  }, [error]);

  // Handle sign-in with email/password
  const handleSignIn = async () => {
    if (!email || !password) {
      return;
    }
    await login(email, password);
  };

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    clearError();
    setShowSignupPrompt(false);
    await loginWithGoogle();
  };

  // Handle navigation to sign-up
  const handleGoToSignUp = () => {
    router.push('/auth/signup');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      
      {/* Purple Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sign In</Text>
        <Text style={styles.headerSubtitle}>Sign in and start exploring!</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {showSignupPrompt && (
                <TouchableOpacity
                  style={styles.signupPromptButton}
                  onPress={handleGoToSignUp}
                >
                  <Text style={styles.signupPromptButtonText}>Go to Sign Up</Text>
                </TouchableOpacity>
              )}
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

          {/* Sign In Button */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <FontAwesome name="google" size={18} color="#DB4437" style={styles.googleIcon} />
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Link href="/auth/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.signupLink}>Sign Up</Text>
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
  signupPromptButton: {
    backgroundColor: '#6200EA',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  signupPromptButtonText: {
    color: 'white',
    fontWeight: '600',
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
  signInButton: {
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#9E9E9E',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  googleIcon: {
    marginRight: 8,
  },
  googleButtonText: {
    color: '#424242',
    fontSize: 16,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#757575',
    fontSize: 14,
  },
  signupLink: {
    color: '#6200EA',
    fontSize: 14,
    fontWeight: '600',
  },
}); 