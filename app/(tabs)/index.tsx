import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

export default function ListingsScreen() {
  const { isInitializing, isAuthenticated, tokens } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [listingsUrl, setListingsUrl] = useState("https://listtra.com/listings");
  const webViewRef = useRef<WebView>(null);
  const router = useRouter();
  
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

  // Handle messages from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle listing click in WebView
      if (data.type === 'LISTING_CLICKED') {
        console.log('Listing clicked:', data);
        
        if (data.slug && data.product_id) {
          // Navigate to native listing detail page using segment configuration
          router.push({
            pathname: "/listings/[slug]/[product_id]/page",
            params: { slug: data.slug, product_id: data.product_id }
          });
        }
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };
  
  // Inject JS to intercept listing card clicks
  const listingClickInterceptor = `
    (function() {
      // Function to intercept listing card clicks
      function setupListingCardClickInterceptors() {
        console.log('Setting up listing card click interceptors');
        
        // Get all listing card links
        const listingCards = document.querySelectorAll('a[href^="/listings/"]');
        
        listingCards.forEach(card => {
          if (!card.dataset.intercepted) {
            card.dataset.intercepted = 'true';
            
            card.addEventListener('click', (e) => {
              e.preventDefault();
              
              // Extract slug and product_id from href
              const href = card.getAttribute('href');
              const match = href.match(/\\/listings\\/([^\\/]+)\\/([^\\/]+)/);
              
              if (match && match.length >= 3) {
                const slug = match[1];
                const product_id = match[2];
                
                console.log('Intercepted listing click:', { slug, product_id });
                
                // Send message to native code
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LISTING_CLICKED',
                  slug,
                  product_id
                }));
              } else {
                console.log('Could not parse listing URL:', href);
                window.location.href = href; // Fall back to normal navigation
              }
            });
          }
        });
      }
      
      // Run immediately and then with delays to catch dynamically loaded cards
      setupListingCardClickInterceptors();
      setTimeout(setupListingCardClickInterceptors, 1000);
      setTimeout(setupListingCardClickInterceptors, 2000);
      
      // Also set up a MutationObserver to watch for new cards
      const observer = new MutationObserver(mutations => {
        let shouldSetup = false;
        
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length) {
            shouldSetup = true;
          }
        });
        
        if (shouldSetup) {
          setupListingCardClickInterceptors();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      return true;
    })();
  `;
  
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
      injectedJavaScript={listingClickInterceptor}
      onMessage={handleMessage}
      ref={webViewRef}
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
