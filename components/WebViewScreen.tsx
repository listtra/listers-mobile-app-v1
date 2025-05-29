import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
  const { tokens, logout, isAuthenticated, setTokensDirectly, user } = useAuth();
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
    if (!webViewRef.current || !tokens.accessToken || !tokens.refreshToken || !user) return;
    
    console.log('Injecting tokens and user data to WebView');
    
    const script = `
      (function() {
        try {
          // STEP 1: Set tokens in localStorage
          console.log('Setting auth tokens in web app localStorage');
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken}');
          
          // STEP 2: Parse and store user data
          const userDataString = '${JSON.stringify(user)}';
          const userData = JSON.parse(userDataString);
          console.log('Setting user data:', userData);
          localStorage.setItem('user', userDataString);
          
          // STEP 3: Add ownership check function
          window.checkIsOwner = function(sellerId) {
            const user = JSON.parse(localStorage.getItem('user') || 'null');
            const isOwner = user && user.id === sellerId;
            console.log('Ownership check:', { userId: user?.id, sellerId, isOwner });
            return isOwner;
          };
                      
          // STEP 4: Dispatch event to notify web app
          window.dispatchEvent(new Event('auth_ready'));
          
          true; // Return success
        } catch (error) {
          console.error('Error in token injection:', error);
          false; // Return failure
        }
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
    
    // Extract listing ID and slug from URL if we're on a listing detail page
    const url = new URL(navState.url);
    const path = url.pathname;
    
    // Handle chat with listing query parameter
    if (path === '/chat' && url.searchParams.has('listing')) {
      const listingId = url.searchParams.get('listing');
      console.log('Chat page with listing detected:', listingId);
      
      if (listingId && webViewRef.current) {
        // First, inject tokens to ensure we're authenticated
        injectTokensToWebView();
        
        // Inject script to properly load all chats for this listing
        setTimeout(() => {
          if (!webViewRef.current) return; // Check if still available after timeout
          
          // First ensure tokens are directly available
          const tokenSetupScript = `
            (function() {
              try {
                console.log('Directly setting tokens for chat page');
                localStorage.setItem('token', '${tokens.accessToken}');
                localStorage.setItem('refreshToken', '${tokens.refreshToken}');
                
                ${user ? `localStorage.setItem('user', '${JSON.stringify(user)}');` : ''}
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LOG',
                  message: 'Direct token setup complete',
                  data: { tokenSet: true }
                }));
                return true;
              } catch (e) {
                console.error('Error setting tokens directly:', e);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LOG',
                  message: 'Error setting tokens directly',
                  error: e.toString()
                }));
                return false;
              }
            })();
          `;
          
          webViewRef.current.injectJavaScript(tokenSetupScript);
          console.log('Token setup script injected');
          
          // Then after a short delay, run the chat fix script
          setTimeout(() => {
            if (!webViewRef.current) return;
            
            const chatFixScript = `
              (function() {
                try {
                  console.log('Processing chat page for listing:', '${listingId}');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOG',
                    message: 'Processing chat page',
                    data: { listingId: '${listingId}' }
                  }));
                  
                  // Check if we're already on the right page
                  if (window.location.pathname === '/chat' && window.location.search.includes('listing=${listingId}')) {
                    // Wait for page to finish initial loading
                    document.body.style.opacity = '0.6';
                    
                    // Add a simple loading indicator that's guaranteed to be visible
                    const loadingDiv = document.createElement('div');
                    loadingDiv.id = 'debug-loading';
                    loadingDiv.style.position = 'fixed';
                    loadingDiv.style.top = '50%';
                    loadingDiv.style.left = '50%';
                    loadingDiv.style.transform = 'translate(-50%, -50%)';
                    loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
                    loadingDiv.style.color = 'white';
                    loadingDiv.style.padding = '20px';
                    loadingDiv.style.borderRadius = '10px';
                    loadingDiv.style.zIndex = '9999';
                    loadingDiv.style.maxWidth = '80%';
                    loadingDiv.style.textAlign = 'center';
                    loadingDiv.innerHTML = 'Loading conversations... Please wait.';
                    document.body.appendChild(loadingDiv);
                  
                    // Helper function to ensure a container exists
                    function ensureContainer() {
                      let container = document.getElementById('chat-container');
                      if (!container) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'LOG',
                          message: 'Container not found, creating a new one'
                        }));
                        
                        // Try to find main element or body as fallback
                        const mainElement = document.querySelector('main') || document.body;
                        
                        // Clear existing content
                        if (mainElement === document.querySelector('main')) {
                          // Keep the header in main element if it exists
                          const header = mainElement.querySelector('h1, .text-xl, .text-2xl');
                          const headerHTML = header ? header.parentElement.outerHTML : '<div class="py-4 px-4 border-b bg-white sticky top-0 z-10 shadow-sm"><h1 class="text-xl font-semibold text-gray-800">Your Chats</h1></div>';
                          mainElement.innerHTML = headerHTML;
                        }
                        
                        // Create new container
                        container = document.createElement('div');
                        container.id = 'chat-container';
                        container.className = 'min-h-screen bg-white';
                        mainElement.appendChild(container);
                      }
                      return container;
                    }
                  
                    // Create our own UI instead of waiting for the page to load
                    const mainElement = document.querySelector('main');
                    if (mainElement) {
                      // Keep the header but clear the content
                      const header = mainElement.querySelector('h1, .text-xl, .text-2xl');
                      const headerContainer = header?.parentElement;
                      
                      // Preserve the header if it exists
                      const headerHTML = headerContainer ? headerContainer.outerHTML : '<div class="py-4 px-4 border-b bg-white sticky top-0 z-10 shadow-sm"><h1 class="text-xl font-semibold text-gray-800">Your Chats</h1></div>';
                      
                      // Replace the entire content
                      mainElement.innerHTML = headerHTML + \`
                        <div id="chat-container" class="min-h-screen bg-white">
                          <div class="max-w-2xl mx-auto">
                            <div id="loading-indicator" class="flex items-center justify-center py-20">
                              <div class="text-center px-4">
                                <div class="animate-spin rounded-full h-8 w-8 border-2 border-gray-100 border-t-gray-600 mx-auto mb-4"></div>
                                <p class="text-gray-800 font-medium">Loading conversations...</p>
                                <p class="text-sm text-gray-500 mt-2">Please wait while we prepare everything</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      \`;
                    }
                    
                    // Function to load conversations
                    const loadConversations = async () => {
                      try {
                        updateDebug('Checking auth token...');
                        
                        // Wait for token to be available - try for up to 5 seconds
                        let token = localStorage.getItem('token');
                        let attempts = 0;
                        const maxAttempts = 10; // 10 attempts with 500ms delay = 5 seconds max
                        
                        while (!token && attempts < maxAttempts) {
                          updateDebug(\`Token not found, waiting... (\${attempts+1}/\${maxAttempts})\`);
                          await new Promise(resolve => setTimeout(resolve, 500));
                          token = localStorage.getItem('token');
                          attempts++;
                        }
                        
                        if (!token) {
                          console.error('No auth token found after multiple attempts');
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'LOG',
                            message: 'Auth token missing after retries',
                            error: true
                          }));
                          document.body.style.opacity = '1';
                          showErrorMessage('Authentication error. Please log in again.');
                          return;
                        }
                        
                        // Confirm token found
                        updateDebug('Auth token found, proceeding with requests...');
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'LOG',
                          message: 'Auth token found',
                          data: { tokenPresent: !!token }
                        }));
                        
                        updateDebug('Starting API requests...');
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'LOG',
                          message: 'Starting API requests',
                          data: { token: token ? 'present' : 'missing' }
                        }));
                        
                        // Fetch listing details and all conversations in parallel
                        const API_URL = 'https://backend.listtra.com';
                        updateDebug('Fetching listing and conversations...');

                        try {
                          // First get the listing details
                          updateDebug('Fetching listing details...');
                          const listingResponse = await fetch(\`\${API_URL}/api/listings/${listingId}/\`, {
                            headers: {
                              'Authorization': 'Bearer ' + token
                            }
                          });
                          
                          if (!listingResponse.ok) {
                            throw new Error(\`Listing fetch failed: \${listingResponse.status}\`);
                          }
                          
                          const listingData = await listingResponse.json();
                          updateDebug('Listing details fetched successfully');
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'LOG',
                            message: 'Listing details retrieved',
                            data: { 
                              title: listingData.title,
                              seller_id: listingData.seller_id
                            }
                          }));
                          
                          // Then get all conversations
                          updateDebug('Fetching conversations...');
                          const conversationsResponse = await fetch(\`\${API_URL}/api/chat/conversations/\`, {
                            headers: {
                              'Authorization': 'Bearer ' + token
                            }
                          });
                          
                          if (!conversationsResponse.ok) {
                            throw new Error(\`Conversations fetch failed: \${conversationsResponse.status}\`);
                          }
                          
                          const allConversations = await conversationsResponse.json();
                          updateDebug(\`Found \${allConversations.length} total conversations\`);
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'LOG',
                            message: 'All conversations retrieved',
                            data: { count: allConversations.length }
                          }));
                          
                          // Filter conversations for this listing
                          updateDebug('Filtering conversations for this listing...');
                          const listingIdStr = '${listingId}';
                          
                          // First check the structure of a conversation to understand what we're filtering
                          if (allConversations.length > 0) {
                            const sampleConv = allConversations[0];
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                              type: 'LOG',
                              message: 'Sample conversation structure',
                              data: { 
                                hasListing: !!sampleConv.listing,
                                listingProps: sampleConv.listing ? Object.keys(sampleConv.listing) : [],
                                sampleProductId: sampleConv.listing?.product_id
                              }
                            }));
                          }
                          
                          // Filter using different approaches to ensure we match correctly
                          const conversations = allConversations.filter(conv => {
                            if (!conv.listing) return false;
                            
                            // Try different comparison approaches
                            const directMatch = conv.listing.product_id === listingIdStr;
                            const looseMatch = String(conv.listing.product_id) === String(listingIdStr);
                            
                            // Log each potential match for debugging
                            if (directMatch || looseMatch) {
                              window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'LOG',
                                message: 'Potential conversation match',
                                data: { 
                                  convId: conv.id,
                                  listingId: conv.listing.product_id, 
                                  targetId: listingIdStr,
                                  directMatch,
                                  looseMatch
                                }
                              }));
                            }
                            
                            return looseMatch; // Use loose comparison to be safe
                          });
                          
                          updateDebug(\`Found \${conversations.length} conversations for this listing\`);
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'LOG',
                            message: 'Filtered conversations',
                            data: { 
                              filtered: conversations.length, 
                              total: allConversations.length,
                              listingId: listingIdStr
                            }
                          }));
                          
                          // Make sure we have a valid container before proceeding
                          const container = ensureContainer();
                          
                          // Remove any existing loading indicator
                          const loadingIndicator = document.getElementById('loading-indicator');
                          if (loadingIndicator) {
                            loadingIndicator.remove();
                          }
                          
                          // Display listing info
                          if (listingData && container) {
                            updateDebug('Rendering listing info...');
                            const listingInfoEl = document.createElement('div');
                            listingInfoEl.className = 'py-4 px-4 border-b bg-white';
                            
                            // Get the first image URL or placeholder
                            const imageUrl = listingData.images && listingData.images.length > 0 
                              ? listingData.images[0].image_url || '/placeholder-image.jpg'
                              : '/placeholder-image.jpg';
                              
                            listingInfoEl.innerHTML = \`
                              <div class="flex items-center gap-4">
                                <div class="w-16 h-16 rounded-md overflow-hidden bg-gray-100">
                                  <img src="\${imageUrl}" alt="\${listingData.title}" class="w-full h-full object-cover" />
                                </div>
                                <div>
                                  <h1 class="text-sm font-medium text-gray-900">\${listingData.title}</h1>
                                  <p class="text-xs text-gray-500">A$\${listingData.price}</p>
                                </div>
                              </div>
                            \`;
                            
                            container.appendChild(listingInfoEl);
                          }
                          
                          // Format timestamp for last message
                          const formatTimestamp = (date) => {
                            const now = new Date();
                            const messageDate = new Date(date);
                            const diffInMinutes = Math.floor((now - messageDate) / (1000 * 60));
                            const diffInHours = Math.floor(diffInMinutes / 60);
                            const diffInDays = Math.floor(diffInHours / 24);

                            if (diffInMinutes < 1) return "Just now";
                            if (diffInMinutes < 60) return \`\${diffInMinutes}m ago\`;
                            if (diffInHours < 24) return \`\${diffInHours}h ago\`;
                            if (diffInDays < 7) return \`\${diffInDays}d ago\`;
                            return messageDate.toLocaleDateString();
                          };

                          // Get last message/offer/review text
                          const getLastActivityText = (conversation) => {
                            if (!conversation.last_message) return "No messages yet";

                            if (conversation.last_message.is_offer) {
                              const offer = conversation.last_message.offer;
                              if (offer.status === "Pending") {
                                return \`Offer: A$\${offer.price}\`;
                              } else if (offer.status === "Accepted") {
                                return \`Offer accepted: A$\${offer.price}\`;
                              } else if (offer.status === "Rejected") {
                                return \`Offer rejected: A$\${offer.price}\`;
                              }
                            } else if (conversation.last_message.review_data) {
                              const review = conversation.last_message.review_data;
                              return \`\${review.reviewer_username} left a \${review.rating}-star review\`;
                            } else {
                              return conversation.last_message.content;
                            }
                          };
                          
                          // Create container for chat list
                          updateDebug('Rendering conversation list...');
                          const chatListContainer = document.createElement('div');
                          chatListContainer.className = 'divide-y';
                          
                          // Display conversations
                          if (conversations.length === 0) {
                            updateDebug('No conversations found');
                            chatListContainer.innerHTML = \`
                              <div class="text-center py-8">
                                <p class="text-gray-500">No conversations found</p>
                              </div>
                            \`;
                          } else {
                            updateDebug(\`Rendering \${conversations.length} conversations...\`);
                            // Sort conversations by most recent first
                            conversations.sort((a, b) => {
                              if (!a.last_message && !b.last_message) return 0;
                              if (!a.last_message) return 1;
                              if (!b.last_message) return -1;
                              return new Date(b.last_message.created_at) - new Date(a.last_message.created_at);
                            });
                            
                            conversations.forEach(conversation => {
                              const chatItem = document.createElement('a');
                              chatItem.href = \`/chat/\${conversation.id}\`;
                              chatItem.className = 'block hover:bg-gray-50 transition-colors';
                              
                              // Determine the other participant
                              const otherParticipant = conversation.other_participant || {};
                              const initialLetter = (otherParticipant.nickname || 'Unknown').charAt(0).toUpperCase();
                              
                              let lastMessageText = getLastActivityText(conversation);
                              if (lastMessageText.length > 40) {
                                lastMessageText = lastMessageText.substring(0, 40) + '...';
                              }
                              
                              chatItem.innerHTML = \`
                                <div class="p-4">
                                  <div class="flex items-center space-x-3">
                                    <div class="flex-shrink-0">
                                      <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                        <span class="text-gray-500">\${initialLetter}</span>
                                      </div>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                      <div class="flex items-center justify-between">
                                        <p class="text-sm font-medium text-gray-900 truncate">
                                          \${otherParticipant.nickname || "Unknown User"}
                                        </p>
                                        \${conversation.last_message ? \`
                                          <span class="text-xs text-gray-500">
                                            \${formatTimestamp(conversation.last_message.created_at)}
                                          </span>
                                        \` : ''}
                                      </div>
                                      <p class="text-sm text-gray-500 truncate">
                                        \${lastMessageText}
                                      </p>
                                    </div>
                                    <div class="flex-shrink-0">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-5 w-5 text-gray-400"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fill-rule="evenodd"
                                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                          clip-rule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              \`;
                              
                              chatListContainer.appendChild(chatItem);
                            });
                          }
                          
                          container.appendChild(chatListContainer);
                          updateDebug('Finished rendering!');
                          document.body.style.opacity = '1';
                          
                          // Clean up debug overlay after everything is done
                          const debugEl = document.getElementById('debug-loading');
                          if (debugEl) {
                            setTimeout(() => {
                              debugEl.remove();
                            }, 1000);
                          }
                          
                        } catch (apiError) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'LOG',
                            message: 'API error',
                            error: apiError.toString()
                          }));
                          updateDebug('Error: ' + apiError.toString());
                          throw apiError;
                        }
                        
                      } catch (error) {
                        console.error('Error loading conversations:', error);
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'LOG',
                          message: 'Error in loadConversations',
                          error: error.toString()
                        }));
                        document.body.style.opacity = '1';
                        updateDebug('Failed: ' + error.toString());
                        showErrorMessage('Failed to load conversations. ' + error.toString());
                      }
                    };
                    
                    // Helper function to update debug overlay
                    function updateDebug(message) {
                      console.log('Debug:', message);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'LOG',
                        message: 'Debug',
                        data: message
                      }));
                      
                      const debugEl = document.getElementById('debug-loading');
                      if (debugEl) {
                        debugEl.innerHTML = message;
                      }
                    }
                    
                    // Helper function to show error message
                    const showErrorMessage = (message) => {
                      // Make sure we have a container
                      const container = ensureContainer();
                      
                      // Remove any existing loading indicator
                      const loadingIndicator = document.getElementById('loading-indicator');
                      if (loadingIndicator) {
                        loadingIndicator.remove();
                      }
                      
                      const errorEl = document.createElement('div');
                      errorEl.className = 'flex flex-col items-center justify-center p-8 text-center';
                      errorEl.innerHTML = \`
                        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-red-500">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        </div>
                        <p class="text-red-600 mb-2">\${message}</p>
                        <button class="mt-4 px-4 py-2 bg-primary text-white rounded-full text-sm" onclick="window.location.reload()">
                          Try Again
                        </button>
                      \`;
                      container.appendChild(errorEl);
                    };
                    
                    // Wait a moment for any ongoing page loads, then run our function
                    updateDebug('Starting conversation load...');
                    setTimeout(loadConversations, 500);
                  }
                } catch (e) {
                  console.error('Error in chat page script:', e);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOG',
                    message: 'Script error',
                    error: e.toString()
                  }));
                  document.body.style.opacity = '1';
                }
                return true;
              })();
            `;
            
            webViewRef.current.injectJavaScript(chatFixScript);
            console.log('Chat fix script injected for listing:', listingId);
          }, 500);
        }, 500);
      }
    }
    
    const isListingDetail = path.includes('/listings/') && 
                           (/\/[^\/]+\/[^\/]+\/?$/.test(path) || // Pattern: /listings/slug/id
                            path.includes('product_id'));
    
    if (isListingDetail) {
      // Extract both slug and UUID from the URL
      const matches = path.match(/\/listings\/([^\/]+)\/([^\/]+)/);
      const slug = matches ? matches[1] : null;
      const listingId = matches ? matches[2] : null;
      
      console.log('Listing detail page detected:', {
        path,
        slug,
        listingId,
        isAuthenticated,
        hasAccessToken: !!tokens.accessToken
      });
      
      // Ensure authentication is maintained across navigation
      if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
        // Give page time to load before injecting tokens
        setTimeout(() => {
          injectTokensToWebView();
          
          // Apply a specific script for listing details pages
          if (webViewRef.current && listingId && slug) {
            console.log('Injecting ownership check script for:', { slug, listingId });
            
            // Create a properly escaped script string
            const scriptContent = `
              (function() {
                try {
                  // Send log message
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LOG',
                    message: 'Starting owner check for listing',
                    data: { slug: '${slug}', listingId: '${listingId}' }
                  }));
                  
                  // Get user data
                  let userData = null;
                  try {
                    userData = JSON.parse(localStorage.getItem('user') || 'null');
                  } catch (e) {
                    console.error('Error parsing user data', e);
                  }
                  
                  if (!userData || !userData.id) {
                    console.log('No user data available');
                    return;
                  }
                  
                  // Make API call to get listing
                  const API_URL = 'https://backend.listtra.com';
                  fetch(\`\${API_URL}/api/listings/${slug}/${listingId}/\`, {
                    headers: {
                      'Authorization': 'Bearer ' + localStorage.getItem('token')
                    }
                  })
                  .then(response => response.json())
                  .then(listingData => {
                    // Check if user is owner
                    const isOwner = String(listingData.seller_id) === String(userData.id);
                    
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'LOG',
                      message: 'Ownership check result',
                      data: { isOwner, sellerId: listingData.seller_id, userId: userData.id }
                    }));
                    
                    if (isOwner) {
                      // Set global flag
                      window.isListingOwner = true;
                      
                      // Force UI update after a delay
                      setTimeout(() => {
                        // Hide buyer elements
                        document.querySelectorAll('button').forEach(btn => {
                          if (btn.innerText && (btn.innerText.includes('Make Offer') || btn.innerText.includes('Buy Now'))) {
                            btn.style.display = 'none';
                            if (btn.parentElement && btn.parentElement.children.length === 1) {
                              btn.parentElement.style.display = 'none';
                            }
                          }
                        });
                        
                        // Show owner elements
                        const ownerTexts = ['Edit', 'View all chats', 'Pending pickup', 'Mark as Sold', 'Cancel'];
                        ownerTexts.forEach(text => {
                          document.querySelectorAll('button').forEach(btn => {
                            if (btn.innerText && btn.innerText.includes(text)) {
                              // Make button visible
                              btn.style.display = 'flex';
                              
                              // Make parents visible
                              let parent = btn.parentElement;
                              while (parent && parent !== document.body) {
                                if (window.getComputedStyle(parent).display === 'none') {
                                  parent.style.display = 'flex';
                                }
                                parent = parent.parentElement;
                              }
                            }
                          });
                        });
                        
                        // Make "View all chats" button work properly
                        document.querySelectorAll('button').forEach(btn => {
                          if (btn.innerText && btn.innerText.includes('View all chats')) {
                            // Add a click event listener to properly handle navigation
                            btn.addEventListener('click', function(e) {
                              console.log('View all chats clicked for listing:', '${listingId}');
                              window.location.href = '/chat?listing=${listingId}';
                            });
                          }
                        });
                        
                        // Create missing owner controls if needed
                        const hasOwnerControls = Array.from(document.querySelectorAll('button')).some(
                          btn => btn.innerText && ownerTexts.some(text => btn.innerText.includes(text))
                        );
                        
                        if (!hasOwnerControls) {
                          // Find container
                          const container = document.querySelector('.flex.flex-col.gap-4.mt-4') || 
                                          document.querySelector('.flex.flex-col.mt-4') ||
                                          document.querySelector('.flex.flex-col.p-4') ||
                                          document.querySelector('.flex.flex-col');
                          
                          if (container) {
                            // Create controls div
                            const controls = document.createElement('div');
                            controls.className = 'flex flex-col gap-4 mt-4';
                            
                            // View all chats button
                            const chatsBtn = document.createElement('button');
                            chatsBtn.className = 'bg-primary text-white py-2 px-4 rounded';
                            chatsBtn.innerText = 'View all chats';
                            chatsBtn.onclick = function() { 
                              console.log('View all chats clicked for listing:', '${listingId}');
                              window.location.href = '/chat?listing=${listingId}';
                            };
                            controls.appendChild(chatsBtn);
                            
                            // Add status buttons
                            const status = listingData.status || 'available';
                            if (status === 'pending' || status === 'available') {
                              const statusBtn = document.createElement('button');
                              statusBtn.className = 'py-2 px-4 bg-white text-primary rounded border border-primary mt-2';
                              statusBtn.innerText = status === 'available' ? 'Mark as Pending' : 'Mark as Available';
                              controls.appendChild(statusBtn);
                            }
                            
                            container.appendChild(controls);
                          }
                        }
                      }, 1000);
                    }
                  })
                  .catch(error => {
                    console.error('Error checking ownership:', error);
                  });
                } catch (e) {
                  console.error('Error in script:', e);
                }
                return true;
              })();
            `;
            
            webViewRef.current.injectJavaScript(scriptContent);
            console.log('Ownership check script injected');
          } else {
            console.log('Skipping ownership check - missing required data:', {
              hasWebViewRef: !!webViewRef.current,
              hasListingId: !!listingId,
              hasSlug: !!slug
            });
          }
        }, 500);
      }
    }
  };

  // Handle messages from WebView
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle log messages from the WebView
      if (data.type === 'LOG') {
        console.log('WebView Log:', data.message, data.data || data.error || '');
        return;
      }
      
      // Handle other message types as before
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
                      const userDataStr = localStorage.getItem('user');
                      if (userDataStr) {
                        try {
                        userData = JSON.parse(userDataStr);
                        } catch (e) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'LOG',
                            message: 'Error parsing user data from localStorage',
                            error: e.message
                          }));
                        }
                      } else {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'LOG',
                          message: 'No user data found in localStorage',
                          availableKeys: Object.keys(localStorage)
                        }));
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
        console.log('CHECK_OWNER request received:', {
          listingId: data.listingId,
          isAuthenticated: isAuthenticated,
          hasAccessToken: !!tokens.accessToken,
          currentUrl: currentUrl
        });
        
        if (isAuthenticated && tokens.accessToken && webViewRef.current) {
          // First ensure tokens are injected
          injectTokensToWebView();
          
          // Then inject a script to specifically check ownership for this listing
          setTimeout(() => {
            if (webViewRef.current) {
              const checkOwnerScript = `
                (function() {
                  try {
                    console.log('Starting ownership check for listing:', '${data.listingId}');
                    
                    // Get user data
                    let userData = null;
                    if (window.userData) {
                      userData = window.userData;
                      console.log('Found userData in window:', userData);
                    } else {
                      const userDataStr = localStorage.getItem('user');
                      if (userDataStr) {
                        try {
                        userData = JSON.parse(userDataStr);
                        console.log('Found userData in localStorage:', userData);
                        } catch (e) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'LOG',
                            message: 'Error parsing user data from localStorage',
                            error: e.message
                          }));
                        }
                      } else {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'LOG',
                          message: 'No user data found in localStorage',
                          availableKeys: Object.keys(localStorage)
                        }));
                      }
                    }
                    
                    if (!userData || !userData.id) {
                      console.error('No user data available for ownership check');
                      return;
                    }
                    
                    console.log('User data for ownership check:', {
                      userId: userData.id,
                      listingId: '${data.listingId}'
                    });
                    
                    // Make API call to get listing details
                    const API_URL = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL 
                                  ? process.env.NEXT_PUBLIC_API_URL 
                                  : 'https://backend.listtra.com';
                    
                    fetch(\`\${API_URL}/api/listings/${data.listingId}/\`, {
                      headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                      }
                    })
                    .then(response => response.json())
                    .then(listingData => {
                      console.log('Listing data received:', {
                        listingId: listingData.product_id,
                        sellerId: listingData.seller_id,
                        userId: userData.id,
                        isMatch: String(listingData.seller_id) === String(userData.id)
                      });
                      
                      const isOwner = String(listingData.seller_id) === String(userData.id);
                      
                      // Dispatch event with the result
                      window.dispatchEvent(new CustomEvent('ownership-result', { 
                        detail: { 
                          isOwner: isOwner,
                          listingId: '${data.listingId}',
                          sellerId: listingData.seller_id,
                          userId: userData.id
                        } 
                      }));
                      
                      console.log('Ownership check complete:', isOwner);
                    })
                    .catch(error => {
                      console.error('Error in ownership check:', error);
                    });
                  } catch(e) {
                    console.error('Error in ownership check script:', e);
                  }
                  return true;
                })();
              `;
              
              webViewRef.current.injectJavaScript(checkOwnerScript);
            }
          }, 300);
        }
      }
    } catch (error) {
      console.error('Failed to process WebView message', error);
    }
  };

  // Add script to fix Cloudinary image URLs
  const injectedJavaScript = `
    (function() {
      // Function to fix Cloudinary image URLs
      function fixCloudinaryImages() {
        const images = document.querySelectorAll('img[src*="res.cloudinary.com"]');
        images.forEach(img => {
          // Ensure HTTPS
          if (img.src.startsWith('http://')) {
            img.src = img.src.replace('http://', 'https://');
          }
          
          // Add loading="lazy" for better performance
          img.loading = 'lazy';
                  
          // Add error handling
          img.onerror = function() {
            console.error('Failed to load image:', img.src);
            // Retry loading with a different protocol
            if (!img.retried) {
              img.retried = true;
              img.src = img.src.replace('https://', 'http://');
                            }
          };
        });
      }

      // Run immediately
      fixCloudinaryImages();
                              
      // Also run when DOM changes
      const observer = new MutationObserver(function(mutations) {
        fixCloudinaryImages();
      });

              observer.observe(document.body, {
                childList: true,
                subtree: true
              });

      // Also run after a short delay to catch dynamically loaded images
      setTimeout(fixCloudinaryImages, 1000);
      setTimeout(fixCloudinaryImages, 3000);
    
    true;
    })();
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
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              startInLoadingState={true}
              cacheEnabled={true}
              cacheMode="LOAD_DEFAULT"
              mixedContentMode="always"
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
              injectedJavaScript={injectedJavaScript}
              sharedCookiesEnabled={true}
              allowsBackForwardNavigationGestures={true}
              pullToRefreshEnabled={true}
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