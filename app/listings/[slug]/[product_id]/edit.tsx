import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import WebViewScreen from '../../../../components/WebViewScreen';
import { useAuth } from '../../../../context/AuthContext';

// Primary color constant
const PRIMARY_COLOR = '#2528be';

export default function ListingEditScreen() {
  const { slug, product_id } = useLocalSearchParams();
  const { isInitializing, isAuthenticated, tokens } = useAuth();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  
  // Wait for auth to initialize
  useEffect(() => {
    if (!isInitializing) {
      setIsReady(true);
      
      // Redirect to login if not authenticated
      if (!isAuthenticated) {
        router.replace('/auth/signin');
      }
    }
  }, [isInitializing, isAuthenticated]);
  
  // Show loading spinner while initializing
  if (isInitializing || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }
  
  // Construct the edit URL with the auth token
  const editUrl = `https://listtra.com/listings/${slug}/${product_id}/edit`;
  
  return (
    <WebViewScreen 
      uri={editUrl} 
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