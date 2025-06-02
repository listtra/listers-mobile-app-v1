import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

export default function ChatDetailScreen() {
  const { isInitializing, user, tokens } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [conversationData, setConversationData] = useState<any>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const webViewRef = useRef<any>(null);
  
  // Handle WebView messages from the chat page
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Received message from WebView:', data.type);
      
      if (data.type === 'CHAT_ERROR') {
        console.error('Chat error received:', data.message);
        setNeedsReload(true);
      }
      
      if (data.type === 'DOM_DEBUG') {
        console.log('DOM Debug received:', data.info);
      }
      
      if (data.type === 'CHAT_LOADED') {
        console.log('Chat successfully loaded');
        setNeedsReload(false);
      }
    } catch (error) {
      console.error('Failed to process WebView message', error);
    }
  };
  
  // Force reload of WebView content
  const handleReload = () => {
    if (webViewRef.current) {
      console.log('Forcing reload of chat WebView');
      
      // Force token injection before reload
      const injectTokensScript = `
        (function() {
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken}');
          localStorage.setItem('user', '${JSON.stringify(user)}');
          return true;
        })();
      `;
      
      webViewRef.current.injectJavaScript(injectTokensScript);
      
      // Then reload
      setTimeout(() => {
        webViewRef.current.reload();
        setNeedsReload(false);
      }, 300);
    }
  };
  
  useEffect(() => {
    // Fetch conversation data to determine if user is buyer or seller
    const fetchConversationData = async () => {
      if (!user || !tokens.accessToken) return;
      
      try {
        setIsLoading(true);
        console.log(`Fetching conversation data for ID: ${id}`);
        
        const response = await axios.get(`https://backend.listtra.com/api/chat/conversations/${id}/`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        });
        
        console.log('Fetched conversation data:', response.data);
        setConversationData(response.data);
      } catch (error) {
        console.error('Error fetching conversation:', error);
        Alert.alert('Error', 'Could not load conversation data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchConversationData();
  }, [id, user, tokens.accessToken]);
  
  // Wait for auth initialization before loading WebView
  if (isInitializing) {
    return <View style={styles.container} />;
  }

  // Calculate if user is buyer based on conversation data
  const isBuyer = user && conversationData?.listing?.seller_id !== user.id;
  
  // Use a clean URL without query parameters - let the script handle the role
  const chatUrl = `https://listtra.com/chat/${id}`;
  
  console.log('Rendering chat with URL:', chatUrl);
  console.log('User is buyer:', isBuyer);

  // Create a lightweight script that just sets the role without complex DOM manipulation
  const injectedJs = `
    (function() {
      try {
        console.log('[CHAT DEBUG] Initializing chat role detection');
        console.log('[CHAT DEBUG] Current URL:', window.location.href);
        
        // Store isBuyer value as a global variable
        window.__isBuyer = ${isBuyer ? 'true' : 'false'};
        window.__userId = "${user?.id || ''}";
        window.__isNativeApp = true;
        window.__conversationId = "${id}";
        
        // Log the role for debugging
        console.log('[CHAT DEBUG] Setting user role in web app:', ${isBuyer ? '"Buyer"' : '"Seller"'});
        
        // Debug function to log DOM structure
        window.debugChatDOM = function() {
          console.log('[CHAT DEBUG] DOM Structure:');
          
          // Log body classes
          console.log('[CHAT DEBUG] Body classes:', document.body.className);
          
          // Find main chat container
          const chatContainer = document.querySelector('main') || document.querySelector('.chat-container');
          console.log('[CHAT DEBUG] Main container found:', !!chatContainer);
          
          // Log offer input if present
          const offerInput = document.querySelector('input[type="number"]');
          console.log('[CHAT DEBUG] Offer input found:', !!offerInput);
          
          // Log buttons
          const buttons = document.querySelectorAll('button');
          console.log('[CHAT DEBUG] Total buttons found:', buttons.length);
          
          buttons.forEach((btn, index) => {
            if (btn.innerText) {
              console.log(\`[CHAT DEBUG] Button \${index}: \${btn.innerText}\`);
            }
          });
          
          // Check loading indicators
          const loadingElements = document.querySelectorAll('.animate-spin, .loading');
          console.log('[CHAT DEBUG] Loading elements:', loadingElements.length);
          
          return "DOM structure logged to console";
        };
        
        // Call debug function after 3 seconds to capture initial state
        setTimeout(window.debugChatDOM, 3000);
        
        // Check if page loaded properly after 5 seconds
        setTimeout(() => {
          // Check for chat content
          const messagesContainer = document.querySelector('.chat-messages') || 
                                   document.querySelector('.overflow-y-auto') ||
                                   document.querySelector('main');
                                   
          if (!messagesContainer || messagesContainer.children.length === 0) {
            console.log('[CHAT DEBUG] Chat content not loaded properly');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CHAT_ERROR',
              message: 'Chat content not loaded properly'
            }));
          } else {
            console.log('[CHAT DEBUG] Chat content loaded successfully');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CHAT_LOADED',
              message: 'Chat loaded successfully'
            }));
          }
        }, 5000);
        
        // More aggressive approach to ensure the buttons work correctly
        const setupButtonHandlers = () => {
          console.log('[CHAT DEBUG] Setting up button handlers');
          
          // Function to get offer amount from input
          const getOfferAmount = () => {
            const offerInput = document.querySelector('input[type="number"]');
            return offerInput ? offerInput.value : null;
          };
          
          // Replace Make Offer button behavior
          if (${isBuyer ? 'true' : 'false'}) {
            // Find Make Offer button by text content
            const makeOfferButtons = Array.from(document.querySelectorAll('button')).filter(
              btn => btn.innerText && btn.innerText.includes('Make Offer')
            );
            
            console.log('[CHAT DEBUG] Found', makeOfferButtons.length, 'Make Offer buttons');
            
            makeOfferButtons.forEach(btn => {
              if (!btn.dataset.enhanced) {
                console.log('[CHAT DEBUG] Enhanced Make Offer button found');
                btn.dataset.enhanced = 'true';
                
                // Replace click handler completely
                btn.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const amount = getOfferAmount();
                  console.log('[CHAT DEBUG] Make Offer clicked with amount:', amount);
                  
                  if (!amount || parseFloat(amount) <= 0) {
                    alert('Please enter a valid offer amount');
                    return;
                  }
                  
                  // Notify native app
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CHAT_ACTION',
                    action: 'MAKE_OFFER',
                    amount: amount,
                    conversationId: '${id}'
                  }));
                  
                  // Directly make API call to create offer
                  const token = localStorage.getItem('token');
                  
                  fetch('https://backend.listtra.com/api/chat/messages/', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                      conversation: parseInt('${id}'),
                      content: \`Made offer: A$\${amount}\`,
                      message_type: 'text',
                      is_offer: true,
                      price: parseFloat(amount),
                      sender_id: '${user?.id}'
                    })
                  })
                  .then(response => response.json())
                  .then(data => {
                    console.log('[CHAT DEBUG] Offer created successfully:', data);
                    // Reload the page to show the new offer
                    window.location.reload();
                  })
                  .catch(error => {
                    console.error('[CHAT DEBUG] Failed to create offer:', error);
                    alert('Failed to create offer. Please try again.');
                  });
                  
                  return false;
                }, true); // Use capture to ensure our handler runs first
              }
            });
          }
          
          // Replace Accept/Reject offer buttons for seller
          if (!${isBuyer ? 'true' : 'false'}) {
            // Find Accept button
            const acceptButtons = Array.from(document.querySelectorAll('button')).filter(
              btn => btn.innerText && btn.innerText.includes('Accept')
            );
            
            console.log('[CHAT DEBUG] Found', acceptButtons.length, 'Accept Offer buttons');
            
            acceptButtons.forEach(btn => {
              if (!btn.dataset.enhanced) {
                console.log('[CHAT DEBUG] Enhanced Accept Offer button found');
                btn.dataset.enhanced = 'true';
                
                // Get the offer ID from the button or parent elements
                const getOfferId = () => {
                  // Try to find offer ID in data attributes or parent element data
                  let el = btn;
                  while (el && el !== document.body) {
                    if (el.dataset.offerId) return el.dataset.offerId;
                    el = el.parentElement;
                  }
                  
                  // If not found, try to get it from URL parameters
                  const urlParams = new URLSearchParams(window.location.search);
                  return urlParams.get('offerId');
                };
                
                btn.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const offerId = getOfferId();
                  console.log('[CHAT DEBUG] Accept offer clicked for offer ID:', offerId);
                  
                  // Notify native app
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CHAT_ACTION',
                    action: 'ACCEPT_OFFER',
                    offerId: offerId,
                    conversationId: '${id}'
                  }));
                  
                  // Make direct API call to accept offer
                  const token = localStorage.getItem('token');
                  // Look for offer ID in button attributes or parent container
                  const offerIdRegex = /\\/api\\/offers\\/([^\\/]+)\\/accept/;
                  let foundOfferId = null;
                  
                  // If button has onclick with URL containing offer ID
                  if (btn.getAttribute('onclick')) {
                    const onclickValue = btn.getAttribute('onclick');
                    const match = onclickValue.match(offerIdRegex);
                    if (match) foundOfferId = match[1];
                  }
                  
                  // Try to find the offer ID in any parent form action
                  if (!foundOfferId) {
                    const parentForm = btn.closest('form');
                    if (parentForm && parentForm.action) {
                      const match = parentForm.action.match(offerIdRegex);
                      if (match) foundOfferId = match[1];
                    }
                  }
                  
                  if (foundOfferId) {
                    fetch(\`https://backend.listtra.com/api/offers/\${foundOfferId}/accept/\`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                      }
                    })
                    .then(response => {
                      if (response.ok) {
                        console.log('[CHAT DEBUG] Offer accepted successfully');
                        window.location.reload();
                      } else {
                        throw new Error('Failed to accept offer');
                      }
                    })
                    .catch(error => {
                      console.error('[CHAT DEBUG] Failed to accept offer:', error);
                      alert('Failed to accept offer. Please try again.');
                    });
                  } else {
                    console.error('[CHAT DEBUG] Could not find offer ID for acceptance');
                    // Try to submit the form directly as fallback
                    const parentForm = btn.closest('form');
                    if (parentForm) parentForm.submit();
                  }
                  
                  return false;
                }, true);
              }
            });
            
            // Find Reject button with similar approach
            const rejectButtons = Array.from(document.querySelectorAll('button')).filter(
              btn => btn.innerText && btn.innerText.includes('Reject')
            );
            
            console.log('[CHAT DEBUG] Found', rejectButtons.length, 'Reject Offer buttons');
            
            rejectButtons.forEach(btn => {
              if (!btn.dataset.enhanced) {
                console.log('[CHAT DEBUG] Enhanced Reject Offer button found');
                btn.dataset.enhanced = 'true';
                
                btn.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Similar implementation as Accept but for reject
                  // Notify native app
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CHAT_ACTION',
                    action: 'REJECT_OFFER',
                    conversationId: '${id}'
                  }));
                  
                  // Make direct API call to reject offer
                  const token = localStorage.getItem('token');
                  const offerIdRegex = /\\/api\\/offers\\/([^\\/]+)\\/reject/;
                  let foundOfferId = null;
                  
                  if (btn.getAttribute('onclick')) {
                    const onclickValue = btn.getAttribute('onclick');
                    const match = onclickValue.match(offerIdRegex);
                    if (match) foundOfferId = match[1];
                  }
                  
                  if (!foundOfferId) {
                    const parentForm = btn.closest('form');
                    if (parentForm && parentForm.action) {
                      const match = parentForm.action.match(offerIdRegex);
                      if (match) foundOfferId = match[1];
                    }
                  }
                  
                  if (foundOfferId) {
                    fetch(\`https://backend.listtra.com/api/offers/\${foundOfferId}/reject/\`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                      }
                    })
                    .then(response => {
                      if (response.ok) {
                        console.log('[CHAT DEBUG] Offer rejected successfully');
                        window.location.reload();
                      } else {
                        throw new Error('Failed to reject offer');
                      }
                    })
                    .catch(error => {
                      console.error('[CHAT DEBUG] Failed to reject offer:', error);
                      alert('Failed to reject offer. Please try again.');
                    });
                  } else {
                    console.error('[CHAT DEBUG] Could not find offer ID for rejection');
                    // Try to submit the form directly as fallback
                    const parentForm = btn.closest('form');
                    if (parentForm) parentForm.submit();
                  }
                  
                  return false;
                }, true);
              }
            });
          }
          
          // Handle Cancel Offer button for buyer
          if (${isBuyer ? 'true' : 'false'}) {
            const cancelButtons = Array.from(document.querySelectorAll('button')).filter(
              btn => btn.innerText && btn.innerText.includes('Cancel Offer')
            );
            
            console.log('[CHAT DEBUG] Found', cancelButtons.length, 'Cancel Offer buttons');
            
            cancelButtons.forEach(btn => {
              if (!btn.dataset.enhanced) {
                console.log('[CHAT DEBUG] Enhanced Cancel Offer button found');
                btn.dataset.enhanced = 'true';
                
                btn.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Notify native app
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CHAT_ACTION',
                    action: 'CANCEL_OFFER',
                    conversationId: '${id}'
                  }));
                  
                  // Make direct API call to cancel offer
                  const token = localStorage.getItem('token');
                  const offerIdRegex = /\\/api\\/offers\\/([^\\/]+)\\/cancel/;
                  let foundOfferId = null;
                  
                  if (btn.getAttribute('onclick')) {
                    const onclickValue = btn.getAttribute('onclick');
                    const match = onclickValue.match(offerIdRegex);
                    if (match) foundOfferId = match[1];
                  }
                  
                  if (!foundOfferId) {
                    const parentForm = btn.closest('form');
                    if (parentForm && parentForm.action) {
                      const match = parentForm.action.match(offerIdRegex);
                      if (match) foundOfferId = match[1];
                    }
                  }
                  
                  if (foundOfferId) {
                    fetch(\`https://backend.listtra.com/api/offers/\${foundOfferId}/cancel/\`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                      }
                    })
                    .then(response => {
                      if (response.ok) {
                        console.log('[CHAT DEBUG] Offer cancelled successfully');
                        window.location.reload();
                      } else {
                        throw new Error('Failed to cancel offer');
                      }
                    })
                    .catch(error => {
                      console.error('[CHAT DEBUG] Failed to cancel offer:', error);
                      alert('Failed to cancel offer. Please try again.');
                    });
                  } else {
                    console.error('[CHAT DEBUG] Could not find offer ID for cancellation');
                    // Try to submit the form directly as fallback
                    const parentForm = btn.closest('form');
                    if (parentForm) parentForm.submit();
                  }
                  
                  return false;
                }, true);
              }
            });
          }
        };
        
        // Function to apply the role to the document
        const applyRole = () => {
          // Add class to body for CSS targeting
          document.body.classList.add(${isBuyer ? '"is-buyer"' : '"is-seller"'});
          
          // Add simple CSS that hides specific elements based on role
          if (!document.getElementById('chat-role-styles')) {
            const style = document.createElement('style');
            style.id = 'chat-role-styles';
            style.textContent = \`
              /* When user is buyer, hide seller-only elements */
              body.is-buyer .flex.gap-3.justify-center.mt-1 {
                display: none !important;
              }
              
              /* When user is seller, hide buyer-only elements */
              body.is-seller .mt-2:has(input[type="number"]) {
                display: none !important;
              }
              
              /* Fix chat message height */
              .overflow-y-auto {
                min-height: 70vh !important;
                max-height: 80vh !important;
              }
              
              /* Ensure buttons are visible */
              button {
                opacity: 1 !important;
                pointer-events: auto !important;
              }
              
              /* Make offer container is always visible for buyer */
              body.is-buyer .mt-2:has(input[type="number"]) {
                display: block !important;
                visibility: visible !important;
              }
              
              /* Make Accept/Reject buttons always visible for seller */
              body.is-seller .flex.gap-3.justify-center.mt-1 {
                display: flex !important;
                visibility: visible !important;
              }
              
              /* Prevent any loading overlay from persisting */
              #loading-overlay, .loading-container, .loading-indicator {
                display: none !important;
              }
            \`;
            document.head.appendChild(style);
          }
        };
        
        // Apply role immediately
        applyRole();
        
        // Function to check page loading status
        const checkPageLoading = () => {
          const loadingEl = document.querySelector('.animate-spin');
          if (loadingEl) {
            console.log('[CHAT DEBUG] Page still loading...');
            return true;
          }
          
          console.log('[CHAT DEBUG] Page loading complete');
          return false;
        };
        
        // Try multiple times to set up button handlers to ensure they catch dynamically loaded buttons
        setTimeout(() => {
          if (!checkPageLoading()) setupButtonHandlers();
        }, 500);
        
        setTimeout(() => {
          if (!checkPageLoading()) setupButtonHandlers();
        }, 1500);
        
        setTimeout(() => {
          // Force setup regardless of loading state
          setupButtonHandlers();
        }, 3000);
        
        // MutationObserver to catch dynamically added buttons
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              // Check if any buttons were added
              for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.tagName === 'BUTTON') {
                  setupButtonHandlers();
                  break;
                } else if (node.nodeType === 1 && node.querySelectorAll) {
                  // Check for buttons inside added nodes
                  const buttons = node.querySelectorAll('button');
                  if (buttons.length > 0) {
                    setupButtonHandlers();
                    break;
                  }
                }
              }
            }
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        return true;
      } catch(e) {
        console.error('[CHAT DEBUG] Error in chat role detection:', e);
        return false;
      }
    })();
  `;

  return (
    <View style={styles.container}>
      {needsReload && (
        <TouchableOpacity style={styles.reloadButton} onPress={handleReload}>
          <Text style={styles.reloadText}>Reload Chat</Text>
        </TouchableOpacity>
      )}
      <WebViewScreen 
        uri={chatUrl}
        showLoader={true}
        requiresAuth={true}
        injectedJavaScript={injectedJs}
        onMessage={handleWebViewMessage}
        ref={webViewRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  reloadButton: {
    backgroundColor: '#4046F9',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadText: {
    color: 'white',
    fontWeight: 'bold',
  },
}); 