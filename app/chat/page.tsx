import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

// Debug flag to show detailed logging
const DEBUG_MODE = true;

export default function ChatListScreen() {
  const { isInitializing, user, tokens, isAuthenticated } = useAuth();
  const params = useLocalSearchParams();
  const listingId = params.listing as string;
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [listing, setListing] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  
  // Log key information at component mount
  useEffect(() => {
    console.log('ChatListScreen mounted');
    console.log('Auth state:', { 
      isInitializing, 
      isAuthenticated, 
      userId: user?.id,
      hasTokens: !!tokens?.accessToken
    });
    console.log('Listing ID from params:', listingId);
    
    // Check app environment
    console.log('Platform:', Platform.OS);
    console.log('Expo environment:', process.env.NODE_ENV);
  }, []);
  
  // Open the web chat page in browser as a fallback
  const openWebChatInBrowser = () => {
    const url = listingId 
      ? `https://listtra.com/chat?listing=${listingId}` 
      : 'https://listtra.com/chat';
    
    Linking.openURL(url)
      .then(() => console.log('Browser opened with URL:', url))
      .catch(err => console.error('Failed to open browser:', err));
  };
  
  // Test the API connection (simplified)
  const testApiConnection = async () => {
    try {
      const response = await axios.get('https://backend.listtra.com/api/health-check');
      Alert.alert('API Connection Test', `Status: ${response.status}\nData: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      Alert.alert('API Connection Failed', `Error: ${error.message}`);
    }
  };
  
  // Test the auth token
  const testAuthToken = async () => {
    if (!tokens?.accessToken) {
      Alert.alert('No Auth Token', 'You are not logged in');
      return;
    }
    
    try {
      const response = await axios.get('https://backend.listtra.com/api/users/me/', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      });
      
      Alert.alert(
        'Auth Token Test', 
        `Status: ${response.status}\nUser ID: ${response.data.id}\nEmail: ${response.data.email}`
      );
    } catch (error: any) {
      Alert.alert(
        'Auth Token Test Failed', 
        `Error: ${error.message}\nStatus: ${error.response?.status || 'Unknown'}`
      );
    }
  };
  
  // Fetch data with better error handling and logging
  useEffect(() => {
    // Skip if auth is still initializing
    if (isInitializing) {
      console.log('Auth still initializing, waiting...');
      return;
    }
    
    console.log('Starting data fetch, auth initialized');
    
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const fetchData = async () => {
      // Check if user is authenticated
      if (!isAuthenticated || !tokens?.accessToken) {
        console.log('User not authenticated, showing error');
        setError('Please sign in to view your chats');
        setIsLoading(false);
        return;
      }
      
      // Set timeout to avoid infinite loading
      timeoutId = setTimeout(() => {
        if (isMounted && isLoading) {
          console.log('Loading timeout reached');
          setError('Loading took too long. Please try again.');
          setIsLoading(false);
        }
      }, 15000);
      
      try {
        setLoadingStep('Setting up request...');
        console.log('Fetching data with token:', tokens.accessToken.substring(0, 15) + '...');
        
        // Simple headers
        const headers = {
          Authorization: `Bearer ${tokens.accessToken}`
        };
        
        // First verify token with a simple request
        setLoadingStep('Verifying authentication...');
        console.log('Verifying user auth...');
        
        try {
          const userCheck = await axios.get('https://backend.listtra.com/api/users/me/', { 
            headers,
            timeout: 5000 // 5 second timeout
          });
          console.log('User verification successful:', userCheck.data.id);
        } catch (error: any) {
          console.error('User verification failed:', error.message);
          throw new Error(`Authentication verification failed: ${error.message}`);
        }
        
        // Fetch listing first if needed
        if (listingId) {
          setLoadingStep('Loading listing details...');
          console.log('Fetching listing:', listingId);
          
          const listingResponse = await axios.get(
            `https://backend.listtra.com/api/listings/${listingId}/`, 
            {
              headers,
              timeout: 5000
            }
          );
          
          if (isMounted) {
            setListing(listingResponse.data);
            console.log('Listing fetched successfully:', listingResponse.data.title);
          }
        }
        
        // Fetch conversations
        setLoadingStep('Loading conversations...');
        console.log('Fetching conversations...');
        
        const conversationsResponse = await axios.get(
          'https://backend.listtra.com/api/chat/conversations/', 
          {
            headers,
            timeout: 8000
          }
        );
        
        console.log('Conversations fetched:', conversationsResponse.data.length);
        
        // Filter conversations if needed
        let filteredConversations = conversationsResponse.data;
        
        if (listingId) {
          console.log('Filtering conversations for listing:', listingId);
          filteredConversations = filteredConversations.filter(
            (conv: any) => conv.listing?.product_id === listingId
          );
          console.log('Filtered conversations count:', filteredConversations.length);
        }
        
        if (isMounted) {
          setConversations(filteredConversations);
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
      } catch (error: any) {
        console.error('Error fetching chat data:', error);
        
        if (isMounted) {
          clearTimeout(timeoutId);
          setError(`Failed to load: ${error.message}`);
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      console.log('Cleaning up chat list screen');
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isInitializing, isAuthenticated, tokens, listingId]);
  
  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen 
          options={{
            title: 'Chats',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Feather name="chevron-left" size={24} color="#2528be" />
              </TouchableOpacity>
            ),
          }} 
        />
        <ActivityIndicator size="large" color="#2528be" />
        <Text style={styles.loadingText}>{loadingStep}</Text>
        <Text style={styles.loadingSubtext}>Please wait while we prepare everything</Text>
        
        {DEBUG_MODE && (
          <View style={styles.debugButtonsContainer}>
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={testApiConnection}
            >
              <Text style={styles.debugButtonText}>Test API</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={testAuthToken}
            >
              <Text style={styles.debugButtonText}>Test Auth</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={openWebChatInBrowser}
            >
              <Text style={styles.debugButtonText}>Open in Browser</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Chats',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Feather name="chevron-left" size={24} color="#2528be" />
              </TouchableOpacity>
            ),
          }} 
        />
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          
          <View style={styles.errorButtonsRow}>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setIsLoading(true);
                setError(null);
                setLoadingStep('Retrying...');
                // Force reload by updating params
                router.setParams({ timestamp: Date.now().toString() });
              }}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.browserButton}
              onPress={openWebChatInBrowser}
            >
              <Text style={styles.browserButtonText}>Open in Browser</Text>
            </TouchableOpacity>
          </View>
          
          {!isAuthenticated && (
            <TouchableOpacity 
              style={styles.signInButton}
              onPress={() => router.push('/auth/signin')}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          )}
          
          {DEBUG_MODE && (
            <View style={styles.debugButtonsContainer}>
              <TouchableOpacity 
                style={styles.debugButton} 
                onPress={testApiConnection}
              >
                <Text style={styles.debugButtonText}>Test API</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.debugButton} 
                onPress={testAuthToken}
              >
                <Text style={styles.debugButtonText}>Test Auth</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }
  
  // Show content when loaded successfully
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: listing ? listing.title : 'Chats',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="chevron-left" size={24} color="#2528be" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      {/* Header with listing info if applicable */}
      {listing && (
        <View style={styles.listingHeader}>
          <View style={styles.listingImageContainer}>
            {listing.images && listing.images[0] ? (
              <Image 
                source={{ uri: listing.images[0].image_url }} 
                style={styles.listingImage} 
                resizeMode="cover"
              />
            ) : (
              <View style={styles.noImagePlaceholder}>
                <Feather name="image" size={24} color="#ccc" />
              </View>
            )}
          </View>
          
          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
            <Text style={styles.listingPrice}>${listing.price}</Text>
          </View>
        </View>
      )}
      
      {/* Conversations list */}
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.conversationItem}
              onPress={() => router.push({
                pathname: '/chat/[id]',
                params: { id: item.id }
              })}
            >
              <View style={styles.avatar}>
                {item.other_participant?.avatar ? (
                  <Image 
                    source={{ uri: item.other_participant.avatar }} 
                    style={styles.avatarImage} 
                  />
                ) : (
                  <View style={styles.defaultAvatar}>
                    <Text style={styles.avatarText}>
                      {item.other_participant?.nickname?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {item.other_participant?.nickname || "Unknown User"}
                  </Text>
                  {item.last_message && (
                    <Text style={styles.timestamp}>
                      {formatTimestamp(item.last_message.created_at)}
                    </Text>
                  )}
                </View>
                
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {getLastMessageText(item)}
                </Text>
              </View>
              
              <Feather name="chevron-right" size={18} color="#999" />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No conversations found</Text>
          {listingId && (
            <Text style={styles.emptySubtext}>
              No one has messaged about this listing yet
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// Helper function to format timestamp
const formatTimestamp = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const now = new Date();
    const messageDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return messageDate.toLocaleDateString();
  } catch (e) {
    return 'Unknown date';
  }
};

// Helper function to get last message text
const getLastMessageText = (conversation: any): string => {
  if (!conversation.last_message) return "No messages yet";

  try {
    if (conversation.last_message.is_offer) {
      const offer = conversation.last_message.offer;
      if (offer.status === "Pending") {
        return `Offer: $${offer.price}`;
      } else if (offer.status === "Accepted") {
        return `Offer accepted: $${offer.price}`;
      } else if (offer.status === "Rejected") {
        return `Offer rejected: $${offer.price}`;
      }
      return `Offer: $${offer.price}`;
    } else if (conversation.last_message.review_data) {
      const review = conversation.last_message.review_data;
      return `${review.reviewer_username} left a ${review.rating}-star review`;
    } else {
      return conversation.last_message.content;
    }
  } catch (e) {
    return "Message unavailable";
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#777',
  },
  listingHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  listingImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2528be',
  },
  listContent: {
    paddingBottom: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#777',
  },
  conversationContent: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 76,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  errorButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2528be',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  browserButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2528be',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  browserButtonText: {
    color: '#2528be',
    fontWeight: '500',
    fontSize: 16,
  },
  signInButton: {
    backgroundColor: '#ff9500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  signInButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  debugButtonsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 8,
  },
  debugButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugButtonText: {
    color: '#555',
    fontSize: 12,
  },
}); 