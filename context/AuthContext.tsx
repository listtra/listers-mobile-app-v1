import axios from 'axios';
import { makeRedirectUri } from 'expo-auth-session';
import { Prompt } from 'expo-auth-session/build/AuthRequest.types';
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Configure Google WebBrowser auth
WebBrowser.maybeCompleteAuthSession();

// API endpoint configuration
const API_URL = 'https://backend.listtra.com'; // Replace with your actual API URL

// Define types for our context
type User = {
  id: string;
  email: string;
  nickname: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  };
  setTokensDirectly: (accessToken: string, refreshToken: string, userData?: any) => Promise<void>;
};

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isInitializing: true,
  isAuthenticated: false,
  error: null,
  login: async () => {},
  loginWithGoogle: async () => {},
  register: async () => {},
  logout: async () => {},
  clearError: () => {},
  tokens: {
    accessToken: null,
    refreshToken: null
  },
  setTokensDirectly: async () => {},
});

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState({
    accessToken: null as string | null,
    refreshToken: null as string | null,
  });

  // Configure Google OAuth - use the same web client ID as your NextAuth configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    // Your actual Google client IDs
    clientId: '317016913725-gglj4281l88npol4vbg1gcvdmb2nrs3m.apps.googleusercontent.com',
    iosClientId: '317016913725-8epml8s6q7skce4t5ufk1vtev6rfn32t.apps.googleusercontent.com',
    androidClientId: '317016913725-e958fch905dkuikib7j0532klv3k7loo.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    redirectUri: makeRedirectUri({
      scheme: 'listtra'
    }),
    responseType: 'id_token',
    usePKCE: true,
    prompt: Prompt.Consent,
  });

  // Function to store tokens securely
  const storeTokens = async (accessToken: string, refreshToken: string) => {
    try {
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      setTokens({ accessToken, refreshToken });
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  };

  // Function to load tokens from secure storage
  const loadTokens = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      
      if (accessToken && refreshToken) {
        setTokens({ accessToken, refreshToken });
        return { accessToken, refreshToken };
      }
      return null;
    } catch (error) {
      console.error('Error loading tokens:', error);
      return null;
    }
  };

  // Function to clear tokens from secure storage
  const clearTokens = async () => {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      setTokens({ accessToken: null, refreshToken: null });
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  };

  // Initialize auth state on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedTokens = await loadTokens();
        
        if (storedTokens?.accessToken) {
          // Validate token and get user profile
          try {
            const response = await axios.get(`${API_URL}/api/profile/`, {
              headers: {
                Authorization: `Bearer ${storedTokens.accessToken}`
              }
            });
            
            setUser(response.data);
          } catch (error) {
            // If token is invalid or expired, try refresh
            await refreshAccessToken(storedTokens.refreshToken);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle Google auth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleAuth(authentication);
    } else if (response?.type === 'error') {
      setError('Google sign in failed. Please try again.');
    }
  }, [response]);

  // Set up token refresh mechanism
  useEffect(() => {
    const checkTokenExpiration = async () => {
      const storedTokens = await loadTokens();
      if (!storedTokens?.accessToken) return;

      try {
        // Decode JWT to check expiration
        const base64Url = storedTokens.accessToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join('')
        );
        
        const { exp } = JSON.parse(jsonPayload);
        const expiresIn = exp * 1000 - Date.now();
        
        // If token expires in less than 5 minutes, refresh it
        if (expiresIn < 5 * 60 * 1000) {
          console.log('Token expiring soon, refreshing...');
          await refreshAccessToken(storedTokens.refreshToken);
        }
      } catch (error) {
        console.error('Error checking token expiration:', error);
      }
    };

    // Check token expiration every minute
    const interval = setInterval(checkTokenExpiration, 60000);
    
    // Check immediately on mount
    checkTokenExpiration();
    
    return () => clearInterval(interval);
  }, []);

  // Function to handle refresh token
  const refreshAccessToken = async (refreshToken: string | null) => {
    if (!refreshToken) {
      await clearTokens();
      setUser(null);
      return false;
    }

    try {
      const response = await axios.post(`${API_URL}/api/token/refresh/`, {
        refresh: refreshToken
      });

      if (response.data.access) {
        await storeTokens(response.data.access, refreshToken);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await clearTokens();
      setUser(null);
      return false;
    }
  };

  // Process Google authentication
  const handleGoogleAuth = async (authentication: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${authentication.accessToken}` },
      });
      
      const userInfo = await userInfoResponse.json();
      
      // Call your backend endpoint with the same data format as the web
      const apiResponse = await axios.post(`${API_URL}/api/auth/google/`, {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        id_token: authentication.idToken, // This matches what your web app is sending
      });
      
      if (apiResponse.data.access && apiResponse.data.refresh) {
        // Store tokens
        await storeTokens(apiResponse.data.access, apiResponse.data.refresh);
        
        // Set user data
        setUser({
          id: apiResponse.data.user_id,
          email: apiResponse.data.email,
          nickname: apiResponse.data.nickname,
        });
        
        // Navigate to home screen
        router.replace('/(tabs)');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Google auth error:', error);
      
      // Check if it's an account not found error - need to handle this the same way as web
      if (error.response?.status === 400) {
        // Store pending email for signup if needed
        if (error.response?.data?.email) {
          await SecureStore.setItemAsync('pendingEmail', error.response.data.email);
        }
        setError('No account found with this email. Please sign up first.');
      } else {
        setError('Sign in with Google failed. Please try again.');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Regular email/password login
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/token/`, {
        email,
        password
      });

      if (response.data.access && response.data.refresh) {
        // Store tokens
        await storeTokens(response.data.access, response.data.refresh);
        
        // Get user profile
        const profileResponse = await axios.get(`${API_URL}/api/profile/`, {
          headers: {
            Authorization: `Bearer ${response.data.access}`
          }
        });
        
        setUser(profileResponse.data);
        
        // Navigate to home screen
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Register new user
  const register = async (userData: any) => {
    setIsLoading(true);
    setError(null);

    try {
      // Register user
      await axios.post(`${API_URL}/api/register/`, userData);
      
      // After registration, log the user in
      await login(userData.email, userData.password);
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Logout user
  const logout = async () => {
    setUser(null);
    await clearTokens();
    router.replace('/auth/signin');
  };

  // Clear error messages
  const clearError = () => {
    setError(null);
  };

  // Trigger Google login flow
  const loginWithGoogle = async () => {
    setError(null);
    await promptAsync();
  };

  // Function to directly set tokens (useful for WebView integration)
  const setTokensDirectly = async (accessToken: string, refreshToken: string, userData?: any) => {
    setIsLoading(true);
    setError(null);

    try {
      // Store tokens
      await storeTokens(accessToken, refreshToken);
      
      if (userData) {
        // Set user data if provided
        setUser(userData);
      } else {
        // Otherwise get user profile from API
        try {
          const profileResponse = await axios.get(`${API_URL}/api/profile/`, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          
          setUser(profileResponse.data);
        } catch (profileError) {
          console.error('Error fetching profile:', profileError);
        }
      }
    } catch (error: any) {
      console.error('Set tokens error:', error);
      setError('Failed to set authentication tokens.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitializing,
        isAuthenticated: !!user && !!tokens.accessToken,
        error,
        login,
        loginWithGoogle,
        register,
        logout,
        clearError,
        tokens,
        setTokensDirectly
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 