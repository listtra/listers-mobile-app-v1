import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

// Define the types for our data
type Listing = {
  product_id: string;
  title: string;
  price: string;
  images: Array<{image_url: string; is_primary?: boolean}>;
  main_image?: string;
  condition: string;
  slug: string;
};

type Review = {
  id: string;
  rating: number;
  review_text: string;
  reviewer_nickname: string;
  created_at: string;
  reviewed_product_image?: string;
  reviewed_product_title?: string;
};

type Profile = {
  id: string;
  nickname: string;
  email: string;
  avatar?: string;
  created_at: string;
};

export default function ProfileScreen() {
  const { isInitializing, isAuthenticated, tokens, user } = useAuth();
  const [activeTab, setActiveTab] = useState('Listings');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [likedListings, setLikedListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [likedItems, setLikedItems] = useState<{[key: string]: boolean}>({});
  
  const router = useRouter();
  const windowWidth = Dimensions.get('window').width;
  
  // Format condition text
  const formatCondition = (condition: string) => {
    if (!condition) return '';
    
    // Convert snake_case or kebab-case to readable format
    return condition
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  // Calculate average rating
  const calculateAverageRating = (reviews: Review[]) => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  };
  
  // Add debug logging
  useEffect(() => {
    console.log('ProfileScreen: Auth state:', { 
      isInitializing, 
      isAuthenticated, 
      hasAccessToken: !!tokens?.accessToken,
      hasRefreshToken: !!tokens?.refreshToken,
      hasUser: !!user,
      userId: user?.id
    });
  }, [isInitializing, isAuthenticated, tokens, user]);
  
  // Handle fetch data functions
  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Create API instance with auth token
      const api = axios.create({
        baseURL: 'https://backend.listtra.com',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('ProfileScreen: Fetching user profile data');
      
      // Fetch user profile
      const profileResponse = await api.get('/api/profile/');
      console.log('ProfileScreen: Profile data received:', profileResponse.status);
      setProfile(profileResponse.data);
      
      // Fetch user's listings
      const listingsResponse = await api.get(`/api/listings/?seller=${profileResponse.data.id}`);
      console.log('ProfileScreen: Listings data received:', listingsResponse.status, listingsResponse.data.listings?.length);
      setListings(listingsResponse.data.listings || []);
      
      // Fetch user's liked listings
      const likedResponse = await api.get('/api/listings/liked/');
      console.log('ProfileScreen: Liked data received:', likedResponse.status, likedResponse.data?.length);
      setLikedListings(likedResponse.data || []);
      
      // Fetch reviews received by the user
      const reviewsResponse = await api.get(`/api/reviews/seller/${profileResponse.data.id}/`);
      console.log('ProfileScreen: Reviews data received:', reviewsResponse.status, reviewsResponse.data?.length);
      setReviews(reviewsResponse.data || []);
      
    } catch (error) {
      console.error('ProfileScreen: Error fetching data:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log('ProfileScreen: Authentication error, redirecting to signin');
        router.push('/auth/signin');
      } else {
        setError('Failed to load profile data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Wait for auth to initialize, then fetch data
  useEffect(() => {
    if (!isInitializing) {
      if (!isAuthenticated || !tokens.accessToken) {
        console.log('ProfileScreen: Not authenticated, redirecting to signin');
        router.push('/auth/signin');
      } else {
        console.log('ProfileScreen: Authenticated, fetching profile data');
        fetchProfile();
      }
    }
  }, [isInitializing, isAuthenticated, tokens]);
  
  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };
  
  // Helper to get image URL
  const getImageUrl = (item: Listing) => {
    // First try to use main_image if available
    if (item.main_image) {
      return item.main_image;
    }
    
    // Then try to find primary image
    if (item.images && item.images.length > 0) {
      const primaryImage = item.images.find(img => img.is_primary === true);
      if (primaryImage?.image_url) {
        return primaryImage.image_url;
      }
      
      // Fallback to first image
      return item.images[0]?.image_url || '';
    }
    
    return '';
  };
  
  // Get initial of name for avatar placeholder
  const getInitial = (name: string) => {
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : 'U';
  };
  
  // Function to toggle like status
  const toggleLike = (itemId: string) => {
    setLikedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
    
    // In a real implementation, you would make an API call here
    // to update the like status on the server
  };
  
  // Render a listing card
  const renderListingItem = ({ item }: { item: Listing }) => {
    const imageUrl = getImageUrl(item);
    const isLiked = likedItems[item.product_id] || false;
    
    return (
      <TouchableOpacity 
        style={styles.listingCard}
        onPress={() => {
          const listingUrl = `https://listtra.com/listings/${item.slug || 'item'}/${item.product_id}`;
          router.push(`/web?uri=${encodeURIComponent(listingUrl)}` as any);
        }}
      >
        <View style={styles.listingImageContainer}>
          {/* Like Button */}
          <TouchableOpacity 
            style={styles.likeButton}
            onPress={() => toggleLike(item.product_id)}
          >
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              style={[styles.likeIcon, {color: isLiked ? '#ff5252' : '#666'}]} 
            />
          </TouchableOpacity>
          
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.listingImage} 
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>No Image</Text>
            </View>
          )}
        </View>
        <View style={styles.listingContent}>
          <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.listingPrice}>${item.price}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.listingCondition}>{formatCondition(item.condition)}</Text>
            <Text style={styles.sellerName}>{profile?.nickname || 'User'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Render a review card
  const renderReviewItem = ({ item }: { item: Review }) => {
    const isExpanded = expandedReview === item.id;
    const reviewText = item.review_text || 'No comment provided';
    
    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewUserContainer}>
            <View style={styles.reviewAvatar}>
              <Text style={styles.avatarText}>
                {getInitial(item.reviewer_nickname)}
              </Text>
            </View>
            <View>
              <Text style={styles.reviewerName}>{item.reviewer_nickname || 'User'}</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>★ {item.rating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.reviewDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        
        <Text 
          style={[styles.reviewText, isExpanded ? {} : styles.reviewTextCollapsed]}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {reviewText}
        </Text>
        
        {reviewText.length > 80 && (
          <TouchableOpacity 
            onPress={() => setExpandedReview(isExpanded ? null : item.id)}
            style={styles.readMoreButton}
          >
            <Text style={styles.readMoreText}>
              {isExpanded ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // Initialize liked items based on data from API
  useEffect(() => {
    const initialLikes: {[key: string]: boolean} = {};
    
    // Set initial likes from liked listings
    likedListings.forEach(item => {
      initialLikes[item.product_id] = true;
    });
    
    setLikedItems(initialLikes);
  }, [likedListings]);
  
  // Show loading spinner while initializing
  if (isInitializing || loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#4046F9" />
      </View>
    );
  }
  
  // Show error if any
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Show empty state if no profile
  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Profile not found</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2528be" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {/* Avatar */}
          {profile.avatar ? (
            <Image
              source={{ uri: profile.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{getInitial(profile.nickname)}</Text>
            </View>
          )}
          
          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.nickname}</Text>
            <Text style={styles.profileRating}>★ {calculateAverageRating(reviews)}</Text>
            <Text style={styles.profileReviewCount}>{reviews.length} reviews</Text>
          </View>
        </View>
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Listings' ? styles.activeTab : null]}
            onPress={() => setActiveTab('Listings')}
          >
            <Text style={[styles.tabText, activeTab === 'Listings' ? styles.activeTabText : null]}>
              My Listing
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Liked' ? styles.activeTab : null]}
            onPress={() => setActiveTab('Liked')}
          >
            <Text style={[styles.tabText, activeTab === 'Liked' ? styles.activeTabText : null]}>
              Liked
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Reviews' ? styles.activeTab : null]}
            onPress={() => setActiveTab('Reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'Reviews' ? styles.activeTabText : null]}>
              Reviews
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'Listings' && (
            <>
              {listings.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No listings found</Text>
                </View>
              ) : (
                <FlatList
                  data={listings}
                  renderItem={renderListingItem}
                  keyExtractor={(item) => item.product_id}
                  numColumns={2}
                  scrollEnabled={false}
                  contentContainerStyle={styles.listingsGrid}
                />
              )}
            </>
          )}
          
          {activeTab === 'Liked' && (
            <>
              {likedListings.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No liked items found</Text>
                </View>
              ) : (
                <FlatList
                  data={likedListings}
                  renderItem={renderListingItem}
                  keyExtractor={(item) => item.product_id}
                  numColumns={2}
                  scrollEnabled={false}
                  contentContainerStyle={styles.listingsGrid}
                />
              )}
            </>
          )}
          
          {activeTab === 'Reviews' && (
            <>
              {reviews.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No reviews yet</Text>
                </View>
              ) : (
                <FlatList
                  data={reviews}
                  renderItem={renderReviewItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={styles.reviewsList}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#e53935',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4046F9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  profileHeader: {
    backgroundColor: '#2528be',
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f2f6',
    borderWidth: 0,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f2f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#757575',
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 15,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  profileRating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  profileReviewCount: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2528be',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#757575',
  },
  activeTabText: {
    color: '#000',
    fontWeight: 'bold',
  },
  tabContent: {
    padding: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
  },
  listingsGrid: {
    paddingHorizontal: 5,
  },
  listingCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    marginHorizontal: 5,
    width: Dimensions.get('window').width / 2 - 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  listingImageContainer: {
    height: 150,
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f8f8f8',
    position: 'relative',
  },
  listingImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  noImageText: {
    color: '#757575',
  },
  listingContent: {
    padding: 10,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 5,
    height: 40,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  listingCondition: {
    fontSize: 14,
    color: '#757575',
  },
  sellerName: {
    fontSize: 14,
    color: '#2528be',
    marginTop: 5,
    textAlign: 'right',
  },
  likeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  likeIcon: {
    color: '#ff5252',
    fontSize: 18,
  },
  reviewsList: {
    marginTop: 10,
  },
  reviewCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#F9A825',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewDate: {
    fontSize: 12,
    color: '#9e9e9e',
  },
  reviewText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  reviewTextCollapsed: {
    height: 40,
  },
  readMoreButton: {
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    color: '#2528be',
    fontSize: 12,
  },
});