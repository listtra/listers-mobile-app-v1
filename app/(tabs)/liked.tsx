import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

export default function LikedScreen() {
  const { isInitializing, isAuthenticated, tokens } = useAuth();
  const [isReady, setIsReady] = useState(false);
  
  // Wait for auth to initialize before rendering
  useEffect(() => {
    if (!isInitializing) {
      setIsReady(true);
    }
  }, [isInitializing]);
  
  // Show loading spinner while initializing
  if (isInitializing || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EA" />
      </View>
    );
  }
  
  // Render WebView with auth state - let the WebView component handle auth
  return (
    <WebViewScreen 
      uri="https://listtra.com/liked" 
      showLoader={true}
      requiresAuth={true}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
}); 