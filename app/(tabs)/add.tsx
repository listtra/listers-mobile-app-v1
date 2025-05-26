import React from 'react';
import { StyleSheet, View } from 'react-native';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

export default function AddListingScreen() {
  const { isInitializing } = useAuth();
  
  // Wait for auth initialization before loading WebView
  if (isInitializing) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <WebViewScreen 
        uri="https://listtra.com/listings/create" 
        showLoader={true} 
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