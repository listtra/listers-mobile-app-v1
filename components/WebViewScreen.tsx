import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';

type WebViewScreenProps = {
  uri: string;
  showLoader?: boolean;
  requiresAuth?: boolean;
};

const WebViewScreen: React.FC<WebViewScreenProps> = ({ 
  uri, 
  showLoader = true,
  requiresAuth = false 
}) => {
  const webViewRef = useRef<WebView>(null);
  const { tokens, logout, isAuthenticated, setTokensDirectly } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(uri);

  // Construct proper URL with auth indicator
  const getAuthenticatedUrl = (baseUrl: string) => {
    // If URL already has isNativeAuth parameter, don't add it again
    if (baseUrl.includes('isNativeAuth=true')) {
      return baseUrl;
    }
    
    // Add a query parameter to indicate authenticated state to the web app
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}isNativeAuth=true`;
  };

  // Inject auth tokens to WebView for seamless authentication
  const injectTokensToWebView = () => {
    if (!webViewRef.current || !tokens.accessToken || !tokens.refreshToken) return;
    
    console.log('Injecting tokens to WebView');
    
    // Determine which page to redirect to based on current context
    const desiredPage = uri.includes('/profile') ? '/profile' : (uri.includes('/liked') ? '/liked' : '/listings');
    
    const script = `
      (function() {
        try {
          // Ensure safeStorage exists
          if (!window.safeStorage) {
            console.log('Creating safeStorage wrapper');
            window.fallbackStorage = window.fallbackStorage || {};
            window.safeStorage = {
              getItem: function(key) {
                try {
                  return window.localStorage.getItem(key);
                } catch (e) {
                  console.log('Using fallback storage for get:', key);
                  return window.fallbackStorage[key] || null;
                }
              },
              setItem: function(key, value) {
                try {
                  window.localStorage.setItem(key, value);
                } catch (e) {
                  console.log('Using fallback storage for set:', key);
                  window.fallbackStorage[key] = value;
                }
              },
              removeItem: function(key) {
                try {
                  window.localStorage.removeItem(key);
                } catch (e) {
                  console.log('Using fallback storage for remove:', key);
                  delete window.fallbackStorage[key];
                }
              }
            };
          }
          
          // Set tokens using safe storage wrapper
          window.safeStorage.setItem('token', '${tokens.accessToken}');
          window.safeStorage.setItem('refreshToken', '${tokens.refreshToken}');
          console.log('Tokens successfully injected');
          
          // Force the web app to recognize auth immediately
          window.isNativeAuthenticated = true;
          document.documentElement.classList.add('native-authenticated');
          
          // Store the intended destination to prevent default redirects
          if (!window.sessionStorage.getItem('intendedDestination')) {
            try {
              window.sessionStorage.setItem('intendedDestination', '${desiredPage}');
            } catch (e) {
              window.fallbackStorage.intendedDestination = '${desiredPage}';
            }
          }
          
          // Specifically for profile page, ensure we stay on profile
          if ('${desiredPage}' === '/profile') {
            // If we're not on the profile page but should be, redirect there
            if (window.location.pathname !== '/profile' && !window.location.pathname.includes('/profile')) {
              console.log('Redirecting back to profile after auth');
              window.location.href = '/profile';
            }
            
            // Add special profile page styles for mobile
            const profileStyle = document.createElement('style');
            profileStyle.textContent = \`
              nav, header, .navbar, .navigation { 
                display: none !important; 
              }
              .footer {
                display: none !important;
              }
              .profile-container {
                padding-top: 20px !important;
                max-width: 100% !important;
              }
              /* Fix for safe area on profile page */
              body {
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left) !important;
              }
            \`;
            document.head.appendChild(profileStyle);
          }
          
          // If we're on a protected page that redirected to login, go back to intended destination
          if (window.location.pathname.includes('/auth/')) {
            window.location.href = '${desiredPage}';
          }
          
        } catch(e) {
          console.error('Error injecting tokens:', e);
          // Notify native app of error
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR', 
              message: e.toString()
            }));
          }
        }
        
        true;
      })();
    `;
    
    webViewRef.current.injectJavaScript(script);
  };

  // Ensure tokens are injected when URL changes or authentication state changes
  useEffect(() => {
    if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      injectTokensToWebView();
    }
  }, [currentUrl, isAuthenticated, tokens.accessToken, tokens.refreshToken]);

  // Handle navigation state changes
  const handleNavigationStateChange = (navState: any) => {
    // Skip if URL hasn't actually changed to prevent loops
    if (navState.url === currentUrl) {
      return;
    }
    
    console.log('Navigation state change:', navState.url);
    setCurrentUrl(navState.url);
    
    // Ensure authentication is maintained across navigation
    if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      // Give page time to load before injecting tokens
      setTimeout(() => {
        injectTokensToWebView();
      }, 500);
    }
    
    // Special handling for profile redirects - if we're on profile page and trying to redirect to signin
    const isProfileRedirect = navState.url.includes('/auth/signin') && 
                           (uri.includes('/profile') || currentUrl.includes('/profile')) && 
                           isAuthenticated;
    
    // Special handling for like actions that might be redirecting to signin
    const isLikeRedirect = navState.url.includes('/auth/signin') && 
                         currentUrl.includes('/listings') && 
                         isAuthenticated;
    
    // Handle redirects to signin page when already authenticated
    if (navState.url.includes('/auth/signin') && isAuthenticated) {
      console.log('Detected signin redirect while authenticated, re-injecting tokens');
      
      if (webViewRef.current) {
        // For profile redirects, we need a special script that also returns to the profile page
        if (isProfileRedirect) {
          const profileRedirectScript = `
            console.log('Re-injecting tokens and returning to profile page');
            
            // Ensure safeStorage exists
            if (!window.safeStorage) {
              console.log('Creating safeStorage wrapper for redirect');
              window.fallbackStorage = window.fallbackStorage || {};
              window.safeStorage = {
                getItem: function(key) {
                  try {
                    return window.localStorage.getItem(key);
                  } catch (e) {
                    console.log('Using fallback storage for get:', key);
                    return window.fallbackStorage[key] || null;
                  }
                },
                setItem: function(key, value) {
                  try {
                    window.localStorage.setItem(key, value);
                  } catch (e) {
                    console.log('Using fallback storage for set:', key);
                    window.fallbackStorage[key] = value;
                  }
                },
                removeItem: function(key) {
                  try {
                    window.localStorage.removeItem(key);
                  } catch (e) {
                    console.log('Using fallback storage for remove:', key);
                    delete window.fallbackStorage[key];
                  }
                }
              };
            }
            
            window.safeStorage.setItem('token', '${tokens.accessToken}');
            window.safeStorage.setItem('refreshToken', '${tokens.refreshToken}');
            
            // Update auth state
            window.isNativeAuthenticated = true;
            document.documentElement.classList.add('native-authenticated');
            
            // Force redirect to profile
            window.location.href = '/profile';
            
            true;
          `;
          webViewRef.current.injectJavaScript(profileRedirectScript);
        } else if (isLikeRedirect) {
          // For like redirects, we need a special script that also performs the like action
          const likeRedirectScript = `
            console.log('Re-injecting tokens and handling like action');
            
            // Ensure safeStorage exists
            if (!window.safeStorage) {
              console.log('Creating safeStorage wrapper for redirect');
              window.fallbackStorage = window.fallbackStorage || {};
              window.safeStorage = {
                getItem: function(key) {
                  try {
                    return window.localStorage.getItem(key);
                  } catch (e) {
                    console.log('Using fallback storage for get:', key);
                    return window.fallbackStorage[key] || null;
                  }
                },
                setItem: function(key, value) {
                  try {
                    window.localStorage.setItem(key, value);
                  } catch (e) {
                    console.log('Using fallback storage for set:', key);
                    window.fallbackStorage[key] = value;
                  }
                },
                removeItem: function(key) {
                  try {
                    window.localStorage.removeItem(key);
                  } catch (e) {
                    console.log('Using fallback storage for remove:', key);
                    delete window.fallbackStorage[key];
                  }
                }
              };
            }
            
            window.safeStorage.setItem('token', '${tokens.accessToken}');
            window.safeStorage.setItem('refreshToken', '${tokens.refreshToken}');
            
            // Update auth state
            window.isNativeAuthenticated = true;
            document.documentElement.classList.add('native-authenticated');
            
            // Go back to the previous page (where the like button was)
            window.location.href = document.referrer || '/listings';
            
            // Store in sessionStorage that we need to re-trigger like
            try {
              sessionStorage.setItem('pendingLikeAction', 'true');
            } catch (e) {
              window.fallbackStorage.pendingLikeAction = 'true';
            }
            
            true;
          `;
          webViewRef.current.injectJavaScript(likeRedirectScript);
        } else {
          // Regular redirect handling
          const redirectScript = `
            console.log('Re-injecting tokens after redirect');
            
            // Ensure safeStorage exists
            if (!window.safeStorage) {
              console.log('Creating safeStorage wrapper for redirect');
              window.fallbackStorage = window.fallbackStorage || {};
              window.safeStorage = {
                getItem: function(key) {
                  try {
                    return window.localStorage.getItem(key);
                  } catch (e) {
                    console.log('Using fallback storage for get:', key);
                    return window.fallbackStorage[key] || null;
                  }
                },
                setItem: function(key, value) {
                  try {
                    window.localStorage.setItem(key, value);
                  } catch (e) {
                    console.log('Using fallback storage for set:', key);
                    window.fallbackStorage[key] = value;
                  }
                },
                removeItem: function(key) {
                  try {
                    window.localStorage.removeItem(key);
                  } catch (e) {
                    console.log('Using fallback storage for remove:', key);
                    delete window.fallbackStorage[key];
                  }
                }
              };
            }
            
            window.safeStorage.setItem('token', '${tokens.accessToken}');
            window.safeStorage.setItem('refreshToken', '${tokens.refreshToken}');
            window.isNativeAuthenticated = true;
            document.documentElement.classList.add('native-authenticated');
            window.location.href = document.referrer || '/listings';
            true;
          `;
          webViewRef.current.injectJavaScript(redirectScript);
        }
      }
    }
    
    // For profile page, ensure we don't get redirected to listings after auth
    if (uri.includes('/profile') && navState.url.includes('/listings') && isAuthenticated) {
      console.log('Preventing redirect from profile to listings');
      if (webViewRef.current) {
        webViewRef.current.stopLoading();
        const redirectToProfileScript = `
          console.log('Redirecting back to profile');
          window.location.href = '/profile';
          true;
        `;
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(redirectToProfileScript);
        }, 100);
      }
    }
    
    // If returning to a listing page from a redirect, check for pending actions
    if ((navState.url.includes('/listings') || navState.url.includes('/liked')) && 
        isAuthenticated) {
      setTimeout(() => {
        if (webViewRef.current) {
          const checkPendingActionsScript = `
            // Ensure fallbackStorage exists
            window.fallbackStorage = window.fallbackStorage || {};
            
            // Check if we have a pending like action to complete
            let hasPendingAction = false;
            try {
              hasPendingAction = sessionStorage.getItem('pendingLikeAction') === 'true';
              if (hasPendingAction) {
                sessionStorage.removeItem('pendingLikeAction');
              }
            } catch (e) {
              hasPendingAction = window.fallbackStorage.pendingLikeAction === 'true';
              if (hasPendingAction) {
                delete window.fallbackStorage.pendingLikeAction;
              }
            }
            
            if (hasPendingAction) {
              console.log('Completing pending like action');
              
              // Find any like button that was previously clicked
              setTimeout(() => {
                const likeButtons = document.querySelectorAll('.like-button:not(.liked)');
                if (likeButtons.length > 0) {
                  // Click the first available like button
                  likeButtons[0].click();
                }
              }, 1000);
            }
            true;
          `;
          webViewRef.current.injectJavaScript(checkPendingActionsScript);
        }
      }, 1500);
    }
  };

  // Handle messages from WebView
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Message from WebView:', data);
      
      if (data.type === 'GET_AUTH_STATE') {
        // Web app is asking for auth state
        console.log('Sending auth state to WebView:', isAuthenticated);
        const authStateScript = `
          try {
            window.isNativeAuthenticated = ${isAuthenticated};
            document.documentElement.classList.toggle('native-authenticated', ${isAuthenticated});
            
            // Also update tokens if authenticated
            if (${isAuthenticated}) {
              // Ensure safeStorage exists
              if (!window.safeStorage) {
                window.fallbackStorage = window.fallbackStorage || {};
                window.safeStorage = {
                  getItem: function(key) {
                    try {
                      return window.localStorage.getItem(key);
                    } catch (e) {
                      return window.fallbackStorage[key] || null;
                    }
                  },
                  setItem: function(key, value) {
                    try {
                      window.localStorage.setItem(key, value);
                    } catch (e) {
                      window.fallbackStorage[key] = value;
                    }
                  },
                  removeItem: function(key) {
                    try {
                      window.localStorage.removeItem(key);
                    } catch (e) {
                      delete window.fallbackStorage[key];
                    }
                  }
                };
              }
              
              // Set the tokens
              window.safeStorage.setItem('token', '${tokens.accessToken || ""}');
              window.safeStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
            }
            
            if (typeof window.receiveNativeMessage === 'function') {
              window.receiveNativeMessage({
                type: 'AUTH_STATE',
                isAuthenticated: ${isAuthenticated}
              });
            } else if (typeof window.onNativeAuthStateReceived === 'function') {
              window.onNativeAuthStateReceived(${isAuthenticated});
            }
          } catch(e) {
            console.error('Error setting auth state:', e);
          }
          true;
        `;
        webViewRef.current?.injectJavaScript(authStateScript);
      } else if (data.type === 'LOGOUT') {
        // Web app wants to logout
        console.log('Logout request from WebView');
        logout();
      } else if (data.type === 'LOGIN_SUCCESS' || data.type === 'TOKEN_CHANGED') {
        // Web app successfully logged in or token changed
        console.log('Login/token update from WebView, updating native tokens');
        const accessToken = data.accessToken || data.value || null;
        const refreshToken = data.refreshToken || null;
        
        if (accessToken && (data.type === 'LOGIN_SUCCESS' ? refreshToken : true)) {
          if (data.type === 'LOGIN_SUCCESS') {
            setTokensDirectly(accessToken, refreshToken, data.userData);
          } else if (data.key === 'token' && tokens.refreshToken) {
            // Only update access token if we have refresh token
            setTokensDirectly(accessToken, tokens.refreshToken, null);
          }
        }
      } else if (data.type === 'TOKEN_REMOVED') {
        // Only trigger logout if both tokens are removed
        console.log('Token removed message:', data.key);
        // Don't directly access localStorage here - it might not be available in this context
      } else if (data.type === 'NAVIGATE') {
        // Web app wants to navigate to a different native screen
        if (data.route) {
          router.push(data.route);
        }
      } else if (data.type === 'AUTH_REQUIRED') {
        // WebView is telling us user tried to do something that needs auth
        console.log('Authentication required for action:', data.action, 'ID:', data.id || 'none');
        
        // Check if user is actually authenticated in native app
        if (isAuthenticated && tokens.accessToken) {
          // We're authenticated but webapp doesn't know - reinject tokens
          console.log('Already authenticated in native app, reinjecting tokens');
          injectTokensToWebView();
          
          // If there was a specific action (like a like button), send message to retry it
          if (data.action && webViewRef.current) {
            setTimeout(() => {
              if (webViewRef.current) {
                const retryScript = `
                  try {
                    console.log('Retrying action after auth: ${data.action}');
                    // For "like" action, find and click the appropriate like button
                    if ('${data.action}' === 'like') {
                      // If we have an ID, try to find that specific like button
                      ${data.id ? `
                        const specificButton = document.querySelector('[data-action-type="like"][data-id="${data.id}"]');
                        if (specificButton) {
                          console.log('Found specific like button, clicking it');
                          specificButton.click();
                        }
                      ` : ''}
                      
                      // If no specific button or it wasn't found, try to find any like button
                      const likeButtons = document.querySelectorAll('.like-button');
                      if (likeButtons.length > 0) {
                        console.log('Found a like button, clicking it');
                        likeButtons[0].click();
                      }
                    }
                  } catch(e) {
                    console.error('Error retrying action:', e);
                  }
                  true;
                `;
                webViewRef.current.injectJavaScript(retryScript);
              }
            }, 1000); // Give time for auth state to propagate
          }
        } else {
          // Not authenticated, redirect to signin
          console.log('Not authenticated, redirecting to signin');
          router.push('/auth/signin');
        }
      } else if (data.type === 'ERROR') {
        console.error('Error from WebView:', data.message);
      } else if (data.type === 'REDIRECT_PREVENTED') {
        // WebView is telling us it prevented a redirect
        console.log('Redirect prevented:', data.from, 'to', data.to);
        
        // If redirect was to auth page, we need to ensure tokens are injected
        if (data.to && data.to.includes('/auth/')) {
          console.log('Prevented redirect to auth page, re-injecting tokens');
          setTimeout(() => {
            injectTokensToWebView();
          }, 200);
        }
        
        // If redirect was from profile to listings, we should force back to profile
        if (data.from === '/profile' && data.to === '/listings') {
          console.log('Prevented unwanted redirect from profile to listings');
          if (webViewRef.current) {
            const forceProfileScript = `
              console.log('Forcing stay on profile page');
              if (window.location.pathname !== '/profile') {
                window.location.href = '/profile';
              }
              true;
            `;
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(forceProfileScript);
            }, 200);
          }
        }
      }
    } catch (error) {
      console.error('Failed to process WebView message', error);
    }
  };

  // Initial setup script to inject into WebView
  const injectedJavaScript = `
    // Basic initialization with error handling
    (function() {
      try {
        // Set marker for native environment
        window.isInNativeApp = true;
        
        // Initialize auth state to false until tokens are injected
        window.isNativeAuthenticated = false;
        
        // Add mobile class for styling
        document.documentElement.classList.add('in-native-app');
        
        // Set viewport to respect safe areas
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
          viewportMeta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
        } else {
          const meta = document.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
          document.head.appendChild(meta);
        }
        
        // Add CSS for safe area
        const safeAreaStyle = document.createElement('style');
        safeAreaStyle.textContent = \`
          body {
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
          }
          
          .navbar, .fixed-top, header {
            padding-top: env(safe-area-inset-top);
          }
          
          .fixed-bottom, footer {
            padding-bottom: env(safe-area-inset-bottom);
          }
        \`;
        document.head.appendChild(safeAreaStyle);
        
        // Create fallback storage if localStorage is not available
        window.fallbackStorage = {};
        
        // Safe localStorage wrapper
        window.safeStorage = {
          getItem: function(key) {
            try {
              return window.localStorage.getItem(key);
            } catch (e) {
              console.log('Using fallback storage for get:', key);
              return window.fallbackStorage[key] || null;
            }
          },
          setItem: function(key, value) {
            try {
              window.localStorage.setItem(key, value);
            } catch (e) {
              console.log('Using fallback storage for set:', key);
              window.fallbackStorage[key] = value;
            }
          },
          removeItem: function(key) {
            try {
              window.localStorage.removeItem(key);
            } catch (e) {
              console.log('Using fallback storage for remove:', key);
              delete window.fallbackStorage[key];
            }
          }
        };
        
        // Detect if we're on the profile page
        const isProfilePage = window.location.pathname === '/profile' || 
                            window.location.href.includes('/profile');
        
        // Track original URL to enforce returns after auth
        const originalPath = window.location.pathname;
        window.originalPath = originalPath;
        
        // If we're on the profile page, override some navigation functions
        if (isProfilePage) {
          // Override history.pushState to prevent unwanted redirects
          const originalPushState = window.history.pushState;
          window.history.pushState = function() {
            // Get the URL argument (usually the 3rd one)
            const urlArg = arguments[2];
            
            // If trying to redirect to listings or auth pages, prevent it
            if (urlArg && (urlArg === '/listings' || urlArg.includes('/auth/'))) {
              console.log('Prevented redirect from profile to:', urlArg);
              
              // Notify the app
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'REDIRECT_PREVENTED',
                  from: '/profile',
                  to: urlArg
                }));
              }
              
              return;
            }
            
            // Otherwise, allow the navigation
            return originalPushState.apply(this, arguments);
          };
          
          // Override location.replace to prevent unwanted redirects
          const originalReplace = window.location.replace;
          window.location.replace = function(url) {
            if (typeof url === 'string' && (url === '/listings' || url.includes('/auth/'))) {
              console.log('Prevented location.replace from profile to:', url);
              
              // Notify the app
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'REDIRECT_PREVENTED',
                  from: '/profile',
                  to: url
                }));
              }
              
              return;
            }
            
            return originalReplace.call(this, url);
          };
        }
        
        // Native bridge functions expected by web components
        
        // Handle protected actions like likes
        window.handleProtectedAction = function(action, id) {
          console.log('Native handleProtectedAction called:', action, id);
          
          // Check if we're authenticated in the native app
          if (window.isNativeAuthenticated) {
            return true; // Allow the action to proceed
          }
          
          // Not authenticated, inform native app
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'AUTH_REQUIRED',
              action: action,
              id: id
            }));
          }
          
          return false; // Don't proceed with the action
        };
        
        // Navigation from web to native screens
        window.navigateInNative = function(route) {
          console.log('Native navigation requested to:', route);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'NAVIGATE',
              route: route
            }));
          }
        };
        
        // Check for existing tokens
        try {
          const hasTokens = !!window.safeStorage.getItem('token') && 
                          !!window.safeStorage.getItem('refreshToken');
          if (hasTokens) {
            window.isNativeAuthenticated = true;
            document.documentElement.classList.add('native-authenticated');
          }
        } catch (storageError) {
          console.error('Error accessing storage:', storageError);
        }
        
        // Listen for logout events from the web app
        window.addEventListener('storage', function(e) {
          if (e.key === 'token' && !e.newValue) {
            // Token was removed, notify native app
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'TOKEN_REMOVED',
                key: 'token'
              }));
            }
          }
        });
        
        // Helper to enhance like buttons with proper data attributes
        function enhanceLikeButtons() {
          try {
            // Find all like buttons that don't have data-id attribute
            const likeButtons = document.querySelectorAll('.like-button:not([data-id])');
            likeButtons.forEach(button => {
              // Make sure action type is set
              if (!button.hasAttribute('data-action-type')) {
                button.setAttribute('data-action-type', 'like');
              }
              
              // Try to find the listing ID from nearby elements or parent card
              let listingId = '';
              
              // Option 1: Check if there's a data-id on the button already
              if (button.hasAttribute('data-id')) {
                listingId = button.getAttribute('data-id');
              } 
              // Option 2: Look for a parent element with listing ID data
              else {
                // Check if we're in a listing card
                const listingCard = button.closest('[data-listing-id]');
                if (listingCard) {
                  listingId = listingCard.getAttribute('data-listing-id');
                }
                
                // Check URL for product ID (common pattern in many web apps)
                if (!listingId) {
                  const urlMatch = window.location.pathname.match(/\\/listings\\/[^\\/]+\\/([^\\/]+)/);
                  if (urlMatch && urlMatch[1]) {
                    listingId = urlMatch[1];
                  }
                }
                
                // If we found an ID, set it on the button
                if (listingId) {
                  button.setAttribute('data-id', listingId);
                }
              }
            });
          } catch (e) {
            console.error('Error enhancing like buttons:', e);
          }
        }
        
        // Run initially
        enhanceLikeButtons();
        
        // And run again after content changes (with mutation observer)
        const observer = new MutationObserver(function(mutations) {
          enhanceLikeButtons();
          
          // If we're on profile page, also enforce we stay on the profile
          if (isProfilePage) {
            // Check if we've been redirected away
            if (window.location.pathname !== '/profile' && !window.location.pathname.includes('/profile')) {
              console.log('Detected navigation away from profile, redirecting back');
              window.location.href = '/profile';
            }
          }
        });
        
        // Start observing the document with the configured parameters
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Simple click handler with error handling
        document.addEventListener('click', function(e) {
          try {
            // Find auth-required elements
            const authElement = e.target.closest('[data-requires-auth], .like-button, .chat-button, .profile-action');
            
            if (authElement && !window.isNativeAuthenticated) {
              e.preventDefault();
              e.stopPropagation();
              
              // Extract action type and ID from data attributes if available
              const actionType = authElement.getAttribute('data-action-type') || 'unknown';
              const actionId = authElement.getAttribute('data-id') || '';
              
              // Inform native app
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'AUTH_REQUIRED',
                action: actionType,
                id: actionId
              }));
            }
          } catch (clickError) {
            console.error('Error in click handler:', clickError);
          }
        }, true);
        
        // Safe API request method
        window.makeAuthenticatedRequest = function(url, options = {}) {
          try {
            const token = window.safeStorage.getItem('token');
            if (token) {
              options = options || {};
              options.headers = options.headers || {};
              options.headers.Authorization = 'Bearer ' + token;
            }
            return fetch(url, options);
          } catch (fetchError) {
            console.error('Error making authenticated request:', fetchError);
            return fetch(url, options);
          }
        };
        
        // Request auth state from native
        setTimeout(function() {
          try {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'GET_AUTH_STATE'
              }));
            }
          } catch (timerError) {
            console.error('Error requesting auth state:', timerError);
          }
        }, 500);
        
      } catch (globalError) {
        console.error('Error in initialization:', globalError);
      }
    })();
    
    true;
  `;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : (
          <>
            <WebView
              ref={webViewRef}
              source={{ uri: getAuthenticatedUrl(currentUrl) }}
              style={styles.webview}
              originWhitelist={['*']}
              domStorageEnabled={true}
              allowUniversalAccessFromFileURLs={true}
              javaScriptCanOpenWindowsAutomatically={true}
              onLoad={() => {
                setIsLoading(false);
                
                // Always inject tokens when authenticated
                if (isAuthenticated) {
                  // Give time for page to fully initialize
                  setTimeout(() => {
                    injectTokensToWebView();
                  }, 300);
                }
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                setError(`WebView error: ${nativeEvent.description}`);
                setIsLoading(false);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                if (nativeEvent.statusCode >= 400) {
                  setError(`Network error: ${nativeEvent.statusCode}`);
                }
                setIsLoading(false);
              }}
              onNavigationStateChange={handleNavigationStateChange}
              onMessage={handleWebViewMessage}
              injectedJavaScript={injectedJavaScript}
              userAgent={`${Platform.OS === 'ios' ? 'iOS' : 'Android'}-ListtraApp`}
              sharedCookiesEnabled={true}
              javaScriptEnabled={true}
              startInLoadingState={true}
              allowsBackForwardNavigationGestures={true}
              pullToRefreshEnabled={true}
              cacheEnabled={true}
              cacheMode="LOAD_CACHE_ELSE_NETWORK"
              thirdPartyCookiesEnabled={true}
            />

            {showLoader && isLoading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#6200EA" />
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  webview: {
    flex: 1,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default WebViewScreen; 