import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

export default function ListingsScreen() {
  const { isInitializing, isAuthenticated, tokens } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [listingsUrl, setListingsUrl] = useState("https://listtra.com/listings");
  
  // Wait for auth to initialize
  useEffect(() => {
    if (!isInitializing) {
      setIsReady(true);
      
      // If we have tokens, append them to the URL to force auth
      if (isAuthenticated && tokens.accessToken) {
        // Create a URL with tokens as parameters to force auth
        setListingsUrl(`https://listtra.com/listings?isNativeAuth=true&token=${encodeURIComponent(tokens.accessToken)}`);
      }
    }
  }, [isInitializing, isAuthenticated, tokens]);
  
  // Show loading spinner while initializing
  if (isInitializing || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EA" />
      </View>
    );
  }
  
  // Simple approach: require authentication for listings
  // This will properly set up the user session in the WebView
  return (
    <WebViewScreen 
      uri={listingsUrl} 
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
