import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import WebViewScreen from '../components/WebViewScreen';
import { useAuth } from '../context/AuthContext';

export default function WebScreen() {
  const { isInitializing } = useAuth();
  const params = useLocalSearchParams();
  const uri = params.uri as string;
  
  // Wait for auth initialization before loading WebView
  if (isInitializing) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <WebViewScreen 
        uri={uri} 
        showLoader={true} 
        requiresAuth={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
}); 