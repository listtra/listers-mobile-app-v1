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
    return `${baseUrl}${separator}isNativeAuth=true&token=${encodeURIComponent(tokens.accessToken || '')}`;
  };

  // Inject auth tokens to WebView for seamless authentication
  const injectTokensToWebView = () => {
    if (!webViewRef.current || !tokens.accessToken || !tokens.refreshToken) return;
    
    console.log('Injecting tokens to WebView with:', {
      accessToken: tokens.accessToken.substring(0, 10) + '...',
      refreshToken: tokens.refreshToken.substring(0, 10) + '...'
    });
    
    const script = `
      (function() {
        try {
          // STEP 1: Set tokens in localStorage
          console.log('Setting auth tokens in web app localStorage');
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken}');
          
          // STEP 2: Check if the web app's auth API is available
          console.log('Web app API modules available:', {
            authAPI: typeof window.authAPI !== 'undefined',
            api: typeof window.api !== 'undefined'
          });
          
          // STEP 3: Call API directly using fetch first to ensure token is valid
          const API_URL = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL 
                        ? process.env.NEXT_PUBLIC_API_URL 
                        : 'https://backend.listtra.com';
          
          console.log('Fetching profile from API:', API_URL + '/api/profile/');
          
          fetch(API_URL + '/api/profile/', {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ${tokens.accessToken}',
              'Content-Type': 'application/json'
            }
          })
          .then(response => {
            console.log('Profile API response status:', response.status);
            if (!response.ok) {
              throw new Error('Profile fetch failed with status: ' + response.status);
            }
            return response.json();
          })
          .then(userData => {
            console.log('Profile data fetched successfully:', userData);
            
            // STEP 4: Store user data for other scripts to access
            window.userData = userData;
            
            // IMPORTANT: Explicitly set the user data in localStorage to ensure it's available
            // This is crucial for the isOwner check in listing details
            try {
              localStorage.setItem('userData', JSON.stringify(userData));
              console.log('User data stored in localStorage');
            } catch (e) {
              console.error('Failed to store userData in localStorage:', e);
            }
            
            // STEP 5: Try to call the web app's login function directly if available
            if (typeof window.authAPI !== 'undefined') {
              console.log('Calling authAPI methods directly');
              if (typeof window.authAPI.setUser === 'function') {
                window.authAPI.setUser(userData);
              }
              
              // Force user context update if setUser isn't enough
              if (typeof window.authAPI.setUserContext === 'function') {
                window.authAPI.setUserContext({
                  user: userData,
                  isLoading: false,
                  error: null
                });
              }
            }
            
            // STEP 6: Create and dispatch auth event for web app to handle
            const authEvent = new CustomEvent('auth-user-loaded', { detail: userData });
            document.dispatchEvent(authEvent);
            
            // STEP 7: Check if we're on a listing details page and manually fix the isOwner check
            setTimeout(() => {
              const path = window.location.pathname;
              if (path.includes('/listings/') && path.includes('product_id') || 
                  /\\/listings\\/[\\w-]+\\/[\\w-]+/.test(path)) {
                console.log('On listing details page, ensuring isOwner is checked correctly');
                
                // Fix for ListItem component
                try {
                  // Find the ListItem component and inject the user data
                  // Look for elements that indicate this is a listing detail page
                  const listItemComponent = document.querySelector('[data-listing-item="true"]') || 
                                          document.querySelector('.min-h-screen.mt-28');
                                          
                  if (listItemComponent) {
                    console.log('Found listing item component, checking seller ID');
                    
                    // Try to find seller ID in the page
                    const sellerNameElement = document.querySelector('a[href^="/profiles/"]');
                    if (sellerNameElement) {
                      const sellerName = sellerNameElement.textContent.trim();
                      console.log('Found seller name:', sellerName);
                      
                      // Check if there's any data attribute with seller ID
                      const sellerIdElement = document.querySelector('[data-seller-id]');
                      const sellerId = sellerIdElement ? sellerIdElement.getAttribute('data-seller-id') : null;
                      
                      console.log('Comparing seller ID with user ID:', {
                        sellerId: sellerId,
                        userId: userData.id
                      });
                      
                      // Force update React component to recognize user as owner if IDs match
                      if (sellerId && String(userData.id) === String(sellerId)) {
                        console.log('User is owner, updating UI');
                        
                        // Show owner-only UI elements
                        const ownerElements = document.querySelectorAll('[data-owner-only="true"]');
                        ownerElements.forEach(el => {
                          el.style.display = 'flex';
                        });
                        
                        // Hide non-owner UI elements
                        const nonOwnerElements = document.querySelectorAll('[data-non-owner-only="true"]');
                        nonOwnerElements.forEach(el => {
                          el.style.display = 'none';
                        });
                      }
                    }
                  }
                } catch (e) {
                  console.error('Error fixing isOwner check:', e);
                }
              }
            }, 1000);
            
            // STEP 8: Now modify the UI directly - focus on navbar
            setTimeout(() => {
              console.log('Updating navbar UI elements');
              
              // Find and update navbar elements
              const navbarContainer = document.querySelector('.md\\\\:flex.items-center.gap-1.sm\\\\:gap-4.ml-auto');
              if (navbarContainer) {
                console.log('Found navbar container, updating visibility');
                
                // Make all links visible
                const links = navbarContainer.querySelectorAll('a, button');
                links.forEach(link => {
                  if (!link.classList.contains('md:hidden')) {
                    console.log('Making visible:', link.href || link.textContent);
                    link.style.display = 'flex';
                  }
                });
                
                // Set profile initial if we have a profile link
                const profileLink = navbarContainer.querySelector('a[href="/profile"]');
                if (profileLink) {
                  const initial = profileLink.querySelector('span, div');
                  if (initial && userData.nickname) {
                    initial.textContent = userData.nickname.charAt(0).toUpperCase();
                  }
                }
              } else {
                console.log('Navbar container not found, will retry');
                // If navbar not found, try again later (page might be still loading)
                setTimeout(() => {
                  const navbarContainer = document.querySelector('.md\\\\:flex.items-center.gap-1.sm\\\\:gap-4.ml-auto');
                  if (navbarContainer) {
                    console.log('Found navbar container on second try');
                    const links = navbarContainer.querySelectorAll('a, button');
                    links.forEach(link => {
                      if (!link.classList.contains('md:hidden')) {
                        link.style.display = 'flex';
                      }
                    });
                  } else {
                    console.log('Navbar container not found even on retry');
                  }
                }, 1000);
              }
            }, 500);
          })
          .catch(error => {
            console.error('Error in auth flow:', error);
          });
          
        } catch(e) {
          console.error('Error injecting tokens:', e);
        }
        
        return true;
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
        
        // Check if we're navigating to a listing detail page
        const url = new URL(navState.url);
        const path = url.pathname;
        const isListingDetail = path.includes('/listings/') && 
                               (/\/[^\/]+\/[^\/]+\/?$/.test(path) || // Pattern: /listings/slug/id
                                path.includes('product_id'));

        if (isListingDetail) {
          console.log('Navigated to a listing detail page, applying isOwner fix');
          
          // Apply a specific script for listing details pages
          if (webViewRef.current) {
            const listingDetailScript = `
              (function() {
                try {
                  console.log('Applying isOwner fix for listing detail page');
                  
                  // Wait for the page to fully load
                  setTimeout(() => {
                    // Try to get user data
                    let userData = null;
                    try {
                      // First try window.userData
                      if (window.userData) {
                        userData = window.userData;
                      } else {
                        // Then try localStorage
                        const userDataStr = localStorage.getItem('userData');
                        if (userDataStr) {
                          userData = JSON.parse(userDataStr);
                        }
                      }
                      
                      if (!userData || !userData.id) {
                        console.error('No user data available for isOwner check');
                        return;
                      }
                      
                      console.log('User data for isOwner check:', userData);
                      
                      // Force the isOwner check by injecting userData into the AuthContext
                      if (typeof window.authAPI !== 'undefined') {
                        console.log('Using authAPI to update user context');
                        if (typeof window.authAPI.setUser === 'function') {
                          window.authAPI.setUser(userData);
                        }
                      }
                      
                      // Give time for React to update
                      setTimeout(() => {
                        // Direct DOM manipulation for owner-specific UI elements
                        const listItemComponent = document.querySelector('.min-h-screen.mt-28');
                        if (listItemComponent) {
                          console.log('Found listing component, checking seller details');
                          
                          // Try to find seller info
                          const sellerElem = document.querySelector('a[href^="/profiles/"]');
                          if (sellerElem) {
                            const sellerName = sellerElem.textContent.trim();
                            console.log('Found seller:', sellerName);
                            
                            // Try to find any data attributes with seller ID
                            document.querySelectorAll('[data-seller-id], [data-listing-seller]').forEach(elem => {
                              const sellerId = elem.getAttribute('data-seller-id') || elem.getAttribute('data-listing-seller');
                              if (sellerId) {
                                console.log('Found seller ID:', sellerId, 'User ID:', userData.id);
                                
                                // Compare IDs (as strings to be safe)
                                if (String(sellerId) === String(userData.id)) {
                                  console.log('Current user is the owner, updating UI');
                                  
                                  // Show Edit button if it exists but is hidden
                                  const editButton = document.querySelector('button[data-owner="edit"], .flex.items-center.gap-2 button');
                                  if (editButton && window.getComputedStyle(editButton).display === 'none') {
                                    editButton.style.display = 'flex';
                                    
                                    // Also ensure parent containers are visible
                                    let parent = editButton.parentElement;
                                    while (parent) {
                                      if (window.getComputedStyle(parent).display === 'none') {
                                        parent.style.display = 'flex';
                                      }
                                      parent = parent.parentElement;
                                    }
                                  }
                                  
                                  // Show other owner-only elements
                                  const ownerElements = document.querySelectorAll('[data-owner="true"], .flex.justify-between button');
                                  ownerElements.forEach(el => {
                                    el.style.display = 'flex';
                                  });
                                  
                                  // Hide non-owner elements
                                  const nonOwnerElements = document.querySelectorAll('[data-owner="false"]');
                                  nonOwnerElements.forEach(el => {
                                    el.style.display = 'none';
                                  });
                                }
                              }
                            });
                            
                            // If no data attributes found, try more aggressive approach
                            if (sellerName) {
                              // If we have seller name from profile page, try fetching their ID
                              fetch(\`\${API_URL}/api/users/by-name/\${encodeURIComponent(sellerName)}\`, {
                                headers: {
                                  'Authorization': 'Bearer ' + localStorage.getItem('token')
                                }
                              })
                              .then(response => response.json())
                              .then(sellerData => {
                                if (sellerData && sellerData.id) {
                                  console.log('Fetched seller ID:', sellerData.id, 'User ID:', userData.id);
                                  
                                  // Compare IDs
                                  if (String(sellerData.id) === String(userData.id)) {
                                    console.log('Current user is the owner via seller name lookup');
                                    
                                    // Update UI to show owner controls
                                    document.querySelectorAll('button:contains("Edit"), button:contains("Delete")').forEach(btn => {
                                      btn.style.display = 'flex';
                                    });
                                  }
                                }
                              })
                              .catch(error => {
                                console.error('Error fetching seller data:', error);
                              });
                            }
                          }
                        }
                      }, 500);
                    }, 300);
                  
                } catch(e) {
                  console.error('Error in listing detail script:', e);
                }
                
                return true;
              })();
            `;
            
            webViewRef.current.injectJavaScript(listingDetailScript);
          }
        }
        
        // Add a script to force auth UI elements to be visible
        if (webViewRef.current) {
          const forceAuthScript = `
            (function() {
              try {
                console.log('Force auth UI visibility after navigation');
                
                // Give the page time to fully render
                setTimeout(() => {
                  // Find and update navbar elements
                  const navbarContainer = document.querySelector('.md\\:flex.items-center.gap-1.sm\\:gap-4.ml-auto');
                  if (navbarContainer) {
                    console.log('Found navbar container, ensuring visibility');
                    const links = navbarContainer.querySelectorAll('a, button');
                    links.forEach(link => {
                      if (!link.classList.contains('md:hidden')) {
                        link.style.display = 'flex';
                      }
                    });
                  }
                  
                  // Add force-visible class to body to ensure auth elements stay visible
                  document.body.classList.add('force-auth-visible');
                  
                  // Add CSS to ensure auth elements stay visible
                  const style = document.createElement('style');
                  style.textContent = \`
                    .force-auth-visible .md\\:flex.items-center.gap-1.sm\\:gap-4.ml-auto a,
                    .force-auth-visible .md\\:flex.items-center.gap-1.sm\\:gap-4.ml-auto button:not(.md\\:hidden) {
                      display: flex !important;
                    }
                  \`;
                  document.head.appendChild(style);
                }, 500);
              } catch(e) {
                console.error('Error in force auth script:', e);
              }
              return true;
            })();
          `;
          
          webViewRef.current.injectJavaScript(forceAuthScript);
        }
      }, 500);
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
          
          // Special handling for listing details pages
          if (data.action === 'check_owner' || data.page === 'listing_details') {
            console.log('Handling ownership check for listing details');
            
            if (webViewRef.current) {
              // Inject a script to force isOwner check
              const ownerCheckScript = `
                (function() {
                  try {
                    console.log('Forcing isOwner check for listing details');
                    
                    // Get user data
                    let userData = null;
                    if (window.userData) {
                      userData = window.userData;
                    } else {
                      const userDataStr = localStorage.getItem('userData');
                      if (userDataStr) {
                        userData = JSON.parse(userDataStr);
                      }
                    }
                    
                    if (!userData || !userData.id) {
                      console.error('No user data available for isOwner check');
                      return;
                    }
                    
                    // Get the listing ID from URL or data
                    const path = window.location.pathname;
                    const matches = path.match(/\\/listings\\/[^\\/]+\\/([^\\/]+)/);
                    const listingId = ${data.id ? `'${data.id}'` : 'matches ? matches[1] : null'};
                    
                    if (!listingId) {
                      console.error('Could not determine listing ID');
                      return;
                    }
                    
                    console.log('Checking ownership for listing:', listingId);
                    
                    // Make API call to get listing details including seller_id
                    const API_URL = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL 
                                  ? process.env.NEXT_PUBLIC_API_URL 
                                  : 'https://backend.listtra.com';
                    
                    fetch(\`\${API_URL}/api/listings/\${listingId}/\`, {
                      headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                      }
                    })
                    .then(response => response.json())
                    .then(listingData => {
                      if (listingData && (listingData.seller_id || listingData.user_id)) {
                        const sellerId = listingData.seller_id || listingData.user_id;
                        console.log('Listing seller ID:', sellerId, 'User ID:', userData.id);
                        
                        // Compare IDs
                        if (String(sellerId) === String(userData.id)) {
                          console.log('MATCH: User is the owner of this listing');
                          
                          // Force UI update
                          setTimeout(() => {
                            // Find and show owner controls
                            const ownerControls = document.querySelectorAll('.flex.items-center.gap-2 button, .flex.justify-between button');
                            ownerControls.forEach(btn => {
                              btn.style.display = 'flex';
                              
                              // Make parent containers visible
                              let parent = btn.parentElement;
                              for (let i = 0; i < 3 && parent; i++) {
                                if (window.getComputedStyle(parent).display === 'none') {
                                  parent.style.display = 'flex';
                                }
                                parent = parent.parentElement;
                              }
                            });
                            
                            // Hide buyer controls
                            const makeOfferBtn = document.querySelector('button:contains("Make Offer")');
                            if (makeOfferBtn) {
                              makeOfferBtn.style.display = 'none';
                            }
                            
                            // Fix UI layout if needed
                            document.querySelectorAll('.flex.flex-col.gap-4.mt-4').forEach(el => {
                              el.style.display = 'flex';
                            });
                          }, 200);
                        } else {
                          console.log('NOT MATCH: User is not the owner');
                        }
                      }
                    })
                    .catch(error => {
                      console.error('Error fetching listing details:', error);
                    });
                    
                  } catch(e) {
                    console.error('Error in owner check script:', e);
                  }
                  return true;
                })();
              `;
              
              webViewRef.current.injectJavaScript(ownerCheckScript);
            }
          }
          
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
      } else if (data.type === 'CHECK_OWNER') {
        // WebView is requesting an ownership check for a listing
        console.log('Received CHECK_OWNER request for listing:', data.listingId);
        
        if (isAuthenticated && tokens.accessToken && webViewRef.current) {
          // First ensure tokens are injected
          injectTokensToWebView();
          
          // Then inject a script to specifically check ownership for this listing
          setTimeout(() => {
            if (webViewRef.current) {
              const checkOwnerScript = `
                (function() {
                  try {
                    console.log('Checking ownership for listing ID: ${data.listingId}');
                    
                    // Get user data
                    let userData = null;
                    if (window.userData) {
                      userData = window.userData;
                    } else {
                      const userDataStr = localStorage.getItem('userData');
                      if (userDataStr) {
                        userData = JSON.parse(userDataStr);
                      }
                    }
                    
                    if (!userData || !userData.id) {
                      console.error('No user data available for ownership check');
                      
                      // Notify web app that user is not the owner (missing data)
                      window.dispatchEvent(new CustomEvent('ownership-result', { 
                        detail: { 
                          isOwner: false,
                          listingId: '${data.listingId}',
                          error: 'No user data'
                        } 
                      }));
                      return;
                    }
                    
                    // Make API call to get listing details
                    const API_URL = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL 
                                  ? process.env.NEXT_PUBLIC_API_URL 
                                  : 'https://backend.listtra.com';
                    
                    fetch(\`\${API_URL}/api/listings/${data.listingId}/\`, {
                      headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                      }
                    })
                    .then(response => {
                      if (!response.ok) {
                        throw new Error('Failed to fetch listing: ' + response.status);
                      }
                      return response.json();
                    })
                    .then(listingData => {
                      if (listingData) {
                        const sellerId = listingData.seller_id || listingData.user_id;
                        console.log('Comparing seller ID:', sellerId, 'with user ID:', userData.id);
                        
                        // Compare IDs as strings
                        const isOwner = String(sellerId) === String(userData.id);
                        console.log('Ownership check result:', isOwner);
                        
                        // Store result for future checks
                        window.isListingOwner = isOwner;
                        localStorage.setItem('isListingOwner_' + '${data.listingId}', isOwner);
                        
                        // Notify web app of the result
                        window.dispatchEvent(new CustomEvent('ownership-result', { 
                          detail: { 
                            isOwner: isOwner,
                            listingId: '${data.listingId}',
                            sellerId: sellerId,
                            userId: userData.id
                          } 
                        }));
                        
                        // If owner, update UI
                        if (isOwner) {
                          // Give time for React to update
                          setTimeout(() => {
                            // Force visible owner-only UI elements
                            const ownerElements = document.querySelectorAll(
                              '[data-owner="true"], ' +
                              'button[title="Edit"], ' +
                              '.flex.items-center.gap-2 button, ' +
                              '.flex.justify-between button'
                            );
                            
                            ownerElements.forEach(el => {
                              el.style.display = 'flex';
                              
                              // Make parent containers visible
                              let parent = el.parentElement;
                              for (let i = 0; i < 3 && parent; i++) {
                                if (window.getComputedStyle(parent).display === 'none') {
                                  parent.style.display = 'flex';
                                }
                                parent = parent.parentElement;
                              }
                            });
                            
                            // Hide non-owner elements
                            const nonOwnerElements = document.querySelectorAll(
                              '[data-owner="false"], ' +
                              'button:contains("Make Offer")'
                            );
                            nonOwnerElements.forEach(el => {
                              el.style.display = 'none';
                            });
                          }, 200);
                        }
                      } else {
                        console.error('Listing data is empty');
                        
                        // Notify web app that user is not the owner (empty data)
                        window.dispatchEvent(new CustomEvent('ownership-result', { 
                          detail: { 
                            isOwner: false,
                            listingId: '${data.listingId}',
                            error: 'Empty listing data'
                          } 
                        }));
                      }
                    })
                    .catch(error => {
                      console.error('Error checking listing ownership:', error);
                      
                      // Notify web app that user is not the owner (error)
                      window.dispatchEvent(new CustomEvent('ownership-result', { 
                        detail: { 
                          isOwner: false,
                          listingId: '${data.listingId}',
                          error: error.message
                        } 
                      }));
                    });
                    
                  } catch(e) {
                    console.error('Error in ownership check script:', e);
                    
                    // Notify web app that user is not the owner (exception)
                    window.dispatchEvent(new CustomEvent('ownership-result', { 
                      detail: { 
                        isOwner: false,
                        listingId: '${data.listingId}',
                        error: e.message
                      } 
                    }));
                  }
                  
                  return true;
                })();
              `;
              
              webViewRef.current.injectJavaScript(checkOwnerScript);
            }
          }, 300);
        } else {
          console.log('User not authenticated, cannot check ownership');
          
          // If webview reference exists, let the web app know the user is not authenticated
          if (webViewRef.current) {
            const notAuthScript = `
              window.dispatchEvent(new CustomEvent('ownership-result', { 
                detail: { 
                  isOwner: false,
                  listingId: '${data.listingId}',
                  error: 'User not authenticated'
                } 
              }));
              true;
            `;
            webViewRef.current.injectJavaScript(notAuthScript);
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
        
        // Initialize auth state
        const hasToken = localStorage.getItem('token') && localStorage.getItem('refreshToken');
        window.isNativeAuthenticated = hasToken;
        
        // Simple storage event listener to handle auth changes
        window.addEventListener('storage', function(e) {
          // If token is set or removed, notify the app
          if (e.key === 'token') {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: e.newValue ? 'TOKEN_CHANGED' : 'TOKEN_REMOVED',
                key: 'token',
                value: e.newValue
              }));
            }
          }
        });
        
        // Add helper method for listing details page to check ownership
        window.checkListingOwnership = function(listingId) {
          console.log('Web requesting ownership check for listing:', listingId);
          
          // Return a promise that resolves with the ownership result
          return new Promise((resolve, reject) => {
            // Set up event listener for the result
            const handleOwnershipResult = (event) => {
              if (event.detail && event.detail.listingId === listingId) {
                // Clean up event listener
                window.removeEventListener('ownership-result', handleOwnershipResult);
                
                if (event.detail.error) {
                  reject(new Error(event.detail.error));
                } else {
                  resolve(event.detail.isOwner);
                }
              }
            };
            
            // Listen for the ownership result
            window.addEventListener('ownership-result', handleOwnershipResult);
            
            // Request the ownership check
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'CHECK_OWNER',
                listingId: listingId
              }));
            } else {
              // Reject if we can't communicate with the native app
              reject(new Error('ReactNativeWebView not available'));
            }
            
            // Set a timeout to prevent hanging
            setTimeout(() => {
              window.removeEventListener('ownership-result', handleOwnershipResult);
              reject(new Error('Ownership check timed out'));
            }, 5000);
          });
        };
        
        // Add a function to auto-check ownership on listing detail pages
        window.autoCheckListingOwnership = function() {
          const path = window.location.pathname;
          // Check if we're on a listing detail page
          if (path.includes('/listings/')) {
            // Extract listing ID from URL
            const matches = path.match(/\\/listings\\/[^\\/]+\\/([^\\/]+)/);
            if (matches && matches[1]) {
              const listingId = matches[1];
              console.log('Auto-checking ownership for listing:', listingId);
              
              // Request ownership check
              window.checkListingOwnership(listingId)
                .then(isOwner => {
                  console.log('Auto ownership check result:', isOwner);
                  
                  // If owner, update UI immediately
                  if (isOwner) {
                    // Force visible owner-only UI elements
                    setTimeout(() => {
                      document.querySelectorAll('[data-owner="true"], button[title="Edit"], .flex.items-center.gap-2 button, .flex.justify-between button').forEach(el => {
                        el.style.display = 'flex';
                        
                        // Make parent containers visible
                        let parent = el.parentElement;
                        for (let i = 0; i < 3 && parent; i++) {
                          if (window.getComputedStyle(parent).display === 'none') {
                            parent.style.display = 'flex';
                          }
                          parent = parent.parentElement;
                        }
                      });
                      
                      // Hide non-owner elements
                      document.querySelectorAll('[data-owner="false"], button:contains("Make Offer")').forEach(el => {
                        el.style.display = 'none';
                      });
                    }, 500);
                  }
                })
                .catch(error => {
                  console.error('Auto ownership check failed:', error);
                });
            }
          }
        };
        
        // Basic helper function to make authenticated requests
        window.makeAuthenticatedRequest = function(url, options = {}) {
          const token = localStorage.getItem('token');
          if (token) {
            options = options || {};
            options.headers = options.headers || {};
            options.headers.Authorization = 'Bearer ' + token;
          }
          return fetch(url, options);
        };
        
        // Request auth state from native after a delay
        setTimeout(function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'GET_AUTH_STATE'
            }));
          }
          
          // Auto-check ownership if on listing detail page
          setTimeout(window.autoCheckListingOwnership, 1000);
        }, 500);
        
      } catch (error) {
        console.error('Error in WebView initialization:', error);
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
                
                // When page loads, inject tokens if authenticated
                if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
                  // Give time for page to fully initialize
                  setTimeout(() => {
                    injectTokensToWebView();
                    
                    // Add a debug script to inspect the web app's auth state
                    if (webViewRef.current) {
                      const debugScript = `
                        (function() {
                          try {
                            console.log('DEBUG: Inspecting web app auth state');
                            
                            // Check tokens in localStorage
                            const token = localStorage.getItem('token');
                            const refreshToken = localStorage.getItem('refreshToken');
                            console.log('Tokens present:', {
                              hasToken: !!token,
                              hasRefreshToken: !!refreshToken
                            });
                            
                            // Check for auth-related globals
                            console.log('Auth globals:', {
                              hasAuthAPI: typeof window.authAPI !== 'undefined',
                              hasAuthContext: typeof window.AuthContext !== 'undefined',
                              isNativeAuthenticated: !!window.isNativeAuthenticated
                            });
                            
                            // Add a more aggressive approach to find and update React's AuthContext
                            document.addEventListener('DOMContentLoaded', function() {
                              // Try to find React's __REACT_DEVTOOLS_GLOBAL_HOOK__
                              if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                                console.log('React DevTools hook found, might be able to access contexts');
                              }
                              
                              // Check for React root directly in DOM
                              const reactRoots = document.querySelectorAll('[data-reactroot]');
                              console.log('React roots found:', reactRoots.length);
                              
                              // Setup a MutationObserver to catch auth UI elements
                              const observer = new MutationObserver(function(mutations) {
                                for (let mutation of mutations) {
                                  if (mutation.type === 'childList') {
                                    // Look for navbar elements that indicate auth state
                                    const navbarContainer = document.querySelector('.md\\\\:flex.items-center.gap-1.sm\\\\:gap-4.ml-auto');
                                    if (navbarContainer) {
                                      const profileLink = navbarContainer.querySelector('a[href="/profile"]');
                                      if (profileLink) {
                                        console.log('Profile link found in navbar:', {
                                          isVisible: window.getComputedStyle(profileLink).display !== 'none',
                                          classList: profileLink.className
                                        });
                                        
                                        // Force visibility
                                        profileLink.style.display = 'flex';
                                        
                                        // Also force visibility for other auth elements
                                        const authLinks = navbarContainer.querySelectorAll('a[href="/liked"], a[href="/chats"], button[title="Logout"]');
                                        authLinks.forEach(link => {
                                          link.style.display = 'flex';
                                        });
                                      }
                                    }
                                  }
                                }
                              });
                              
                              // Start observing
                              observer.observe(document.body, {
                                childList: true,
                                subtree: true
                              });
                            });
                            
                            // Try the direct auth API approach again
                            setTimeout(() => {
                              fetch('https://backend.listtra.com/api/profile/', {
                                method: 'GET',
                                headers: {
                                  'Authorization': 'Bearer ' + token,
                                  'Content-Type': 'application/json'
                                }
                              })
                              .then(response => response.json())
                              .then(userData => {
                                console.log('User profile:', userData);
                                
                                // Now force all auth UI elements to show
                                const navbarContainer = document.querySelector('.md\\\\:flex.items-center.gap-1.sm\\\\:gap-4.ml-auto');
                                if (navbarContainer) {
                                  const links = navbarContainer.querySelectorAll('a, button');
                                  links.forEach(link => {
                                    if (!link.classList.contains('md:hidden')) {
                                      link.style.display = 'flex';
                                    }
                                  });
                                }
                              })
                              .catch(error => {
                                console.error('Error fetching profile in debug script:', error);
                              });
                            }, 2000);
                          } catch(e) {
                            console.error('Error in debug script:', e);
                          }
                          
                          return true;
                        })();
                      `;
                      
                      webViewRef.current.injectJavaScript(debugScript);
                    }
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