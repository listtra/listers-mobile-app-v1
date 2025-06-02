import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { AntDesign, Feather, FontAwesome, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Carousel from 'react-native-snap-carousel';
import { useAuth } from '../../../../context/AuthContext';

// Primary color constant
const PRIMARY_COLOR = '#2528be';
const SCREEN_WIDTH = Dimensions.get('window').width;

// Define image type
interface ListingImage {
  id?: string;
  image_url: string;
  is_primary?: boolean;
}

// Define listing data type
interface ListingData {
  product_id: string;
  slug: string;
  title: string;
  description: string;
  price: string | number;
  condition: string;
  location: string;
  status: 'available' | 'pending' | 'sold';
  created_at: string;
  seller_name: string;
  seller_id: string | number;
  images: ListingImage[];
  main_image?: string;
  is_liked?: boolean;
  likes_count?: number;
}

// Condition mapping
const formatCondition = (condition: string): string => {
  const conditionMap: Record<string, string> = {
    new_with_tags: 'New with tags',
    new_without_tags: 'New without tags',
    like_new: 'Like new',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor'
  };
  
  return conditionMap[condition] || condition;
};

export default function ListingDetailScreen() {
  // Load Manrope font
  let [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  
  const params = useLocalSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : String(params.slug || '');
  const product_id = typeof params.product_id === 'string' ? params.product_id : String(params.product_id || '');
  const { isInitializing, user, tokens, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [listingData, setListingData] = useState<ListingData | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const carouselRef = useRef<any>(null);
  const modalCarouselRef = useRef<any>(null);
  const router = useRouter();
  
  // Fetch listing data and check ownership
  useEffect(() => {
    const fetchListingData = async () => {
      if (isInitializing) return;
      
      try {
        setIsLoading(true);
        const url = `https://backend.listtra.com/api/listings/${product_id}/`;
        
        const headers = tokens?.accessToken 
          ? { Authorization: `Bearer ${tokens.accessToken}` } 
          : {};
          
        const response = await axios.get(url, { headers });
        setListingData(response.data);
        
        // Set initial like state
        setIsLiked(response.data.is_liked || false);
        setLikesCount(response.data.likes_count || 0);
        setConversationCount(response.data.conversation_count || 0);
        
        // Check if the current user is the owner
        if (isAuthenticated && user) {
          const userIdStr = String(user.id).trim();
          const sellerIdStr = String(response.data.seller_id || '').trim();
          
          console.log('Checking ownership:', { userId: userIdStr, sellerId: sellerIdStr });
          setIsOwner(userIdStr === sellerIdStr);
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error('Error fetching listing details:', error);
        Alert.alert('Error', 'Failed to load listing details');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchListingData();
  }, [isInitializing, isAuthenticated, user, product_id, tokens]);
  
  // Handle updating listing status
  const updateListingStatus = async (newStatus: 'available' | 'pending' | 'sold') => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to update listing status');
      router.push('/auth/signin');
      return;
    }
    
    try {
      setUpdateStatusLoading(true);
      const url = `https://backend.listtra.com/api/listings/${product_id}/status/`;
      
      const response = await axios.patch(
        url, 
        { status: newStatus },
        { 
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`
          } 
        }
      );
      
      // Update local state with new status
      setListingData(prev => {
        if (prev) {
          return {
            ...prev,
            status: response.data.status
          };
        }
        return prev;
      });
      
      Alert.alert('Success', `Status updated to ${response.data.status}`);
    } catch (error) {
      console.error('Error updating listing status:', error);
      Alert.alert('Error', 'Failed to update listing status');
    } finally {
      setUpdateStatusLoading(false);
    }
  };
  
  // Handle toggling like status
  const toggleLike = async () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to like this listing');
      router.push('/auth/signin');
      return;
    }
    
    try {
      const url = `https://backend.listtra.com/api/listings/${product_id}/like/`;
      
      const method = isLiked ? 'delete' : 'post';
      await axios({
        method,
        url,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`
        }
      });
      
      // Update local state
      setIsLiked(!isLiked);
      setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    } catch (error) {
      console.error('Error toggling like status:', error);
      Alert.alert('Error', 'Failed to update like status');
    }
  };
  
  // Handle starting a chat
  const handleStartChat = async () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to make an offer');
      router.push('/auth/signin');
      return;
    }
    
    try {
      const url = 'https://backend.listtra.com/api/chat/conversations/';
      const response = await axios.post(
        url,
        { listing: product_id },
        { 
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`
          } 
        }
      );
      
      console.log('Conversation created:', response.data);
      router.push({
        pathname: '/chat/[id]',
        params: { id: response.data.id }
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };
  
  // Handle viewing all chats
  const handleViewChats = () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to view chats');
      router.push('/auth/signin');
      return;
    }
    
    // Navigate to the dedicated product chats page
    router.push({
      pathname: '/chat/listing/[product_id]',
      params: { product_id }
    });
  };
  
  // Handle editing listing
  const handleEditListing = () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to edit this listing');
      router.push('/auth/signin');
      return;
    }
    
    router.push({
      pathname: '/listings/[slug]/[product_id]/edit',
      params: { slug, product_id }
    });
  };
  
  // Handle opening image modal
  const openImageModal = (index: number) => {
    setModalImageIndex(index);
    setIsImageModalVisible(true);
  };
  
  // Get arranged images with primary first (like web version)
  const getArrangedImages = (): ListingImage[] => {
    if (!listingData?.images || listingData.images.length === 0) {
      return [];
    }
    
    const images = listingData.images;
    const primaryIndex = images.findIndex(img => img.is_primary === true);
    
    if (primaryIndex === -1) {
      // No primary image, return as is
      return images;
    }
    
    // Move primary image to front
    const arrangedImages = [...images];
    const primaryImage = arrangedImages.splice(primaryIndex, 1)[0];
    return [primaryImage, ...arrangedImages];
  };
  
  // Get safe image URL (matching web implementation)
  const getImageUrl = (image?: ListingImage, useMainImage = false): string => {
    // First check for main image if requested
    if (useMainImage && listingData?.main_image) {
      return listingData.main_image;
    }
    
    // Check for valid image object
    if (image && image.image_url) {
      const url = image.image_url;
      if (url.startsWith('http') || url.startsWith('/')) {
        return url;
      } else {
        return `/${url}`;
      }
    }
    
    // Fallback to placeholder
    return 'https://via.placeholder.com/400x400?text=No+Image';
  };
  
  // Carousel render item
  const renderCarouselItem = ({ item }: { item: any; index: number }) => {
    return (
      <TouchableOpacity 
        style={styles.carouselItem}
        onPress={() => {
          const index = arrangedImages.findIndex(img => img.image_url === item.image_url);
          openImageModal(index >= 0 ? index : 0);
        }}
        activeOpacity={0.9}
      >
        <Image 
          source={{ uri: getImageUrl(item) }} 
          style={styles.carouselImage}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  };
  
  // Modal carousel render item
  const renderModalCarouselItem = ({ item }: { item: any; index: number }) => {
    return (
      <View style={styles.modalCarouselItem}>
        <Image 
          source={{ uri: getImageUrl(item) }} 
          style={styles.modalCarouselImage}
          resizeMode="contain"
        />
      </View>
    );
  };
  
  // Show loading spinner while initializing or loading data
  if (isInitializing || isLoading || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }
  
  // If listing data failed to load
  if (!listingData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load listing details</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Get arranged images
  const arrangedImages = getArrangedImages();
  
  // Extract listing data
  const { 
    title, 
    description, 
    price, 
    condition, 
    location, 
    status, 
    created_at, 
    seller_name,
  } = listingData;
  
  // Format listing date
  const listingDate = new Date(created_at).toLocaleDateString();
  
  // Status text
  const getStatusText = () => {
    switch (status) {
      case 'sold': return 'Sold';
      case 'pending': return 'Pending pickup';
      default: return 'Available';
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen 
        options={{
          title: '',
          headerShown: false,
        }} 
      />
      
      {/* Like button (top right) */}
      <TouchableOpacity 
        style={styles.likeButton}
        onPress={toggleLike}
      >
        <View style={styles.likeButtonInner}>
          <AntDesign
            name={isLiked ? "heart" : "hearto"}
            size={22}
            color={isLiked ? "red" : PRIMARY_COLOR}
          />
        </View>
      </TouchableOpacity>
      
      {/* Back button and Edit button (if owner) */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButtonCircle}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={26} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        
        {isOwner && (
          <View style={styles.editButtonContainer}>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleEditListing}
            >
              <FontAwesome name="edit" size={16} color="white" style={styles.editIcon} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.carouselContainer}>
          {arrangedImages.length > 0 ? (
            <View>
              <Carousel
                ref={carouselRef}
                data={arrangedImages}
                renderItem={renderCarouselItem}
                sliderWidth={SCREEN_WIDTH}
                itemWidth={SCREEN_WIDTH}
                onSnapToItem={(index: number) => setActiveSlide(index)}
                autoplay={arrangedImages.length > 1}
                autoplayDelay={3000}
                autoplayInterval={5000}
                loop={arrangedImages.length > 1}
                vertical={false}
              />
              
              {/* Carousel navigation arrows */}
              {arrangedImages.length > 1 && (
                <>
                  <TouchableOpacity 
                    style={styles.carouselArrowLeft}
                    onPress={() => {
                      if (carouselRef.current) {
                        carouselRef.current.snapToPrev();
                      }
                    }}
                  >
                    <Feather name="chevron-left" size={22} color={PRIMARY_COLOR} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.carouselArrowRight}
                    onPress={() => {
                      if (carouselRef.current) {
                        carouselRef.current.snapToNext();
                      }
                    }}
                  >
                    <Feather name="chevron-right" size={22} color={PRIMARY_COLOR} />
                  </TouchableOpacity>
                </>
              )}
              
              {/* Carousel pagination dots */}
              {arrangedImages.length > 1 && (
                <View style={styles.pagination}>
                  {arrangedImages.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        { backgroundColor: index === activeSlide ? PRIMARY_COLOR : '#ddd' }
                      ]}
                    />
                  ))}
                </View>
              )}
              
              {/* Status badge */}
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{getStatusText()}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          )}
        </View>
        
        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{title}</Text>
          
          <Text style={styles.price}>${price}</Text>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="verified" size={16} color="#555" />
            <Text style={styles.infoText}>{formatCondition(condition)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#555" />
            <Text style={styles.infoText}>{location}</Text>
          </View>
          
          <View style={styles.descriptionContainer}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          
          <View style={styles.sellerContainer}>
            <View>
              <Text style={styles.sectionTitle}>Seller</Text>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="account-outline" size={18} color={PRIMARY_COLOR} />
                <Text style={styles.sellerName}>{seller_name}</Text>
              </View>
            </View>
            
            <View>
              <Text style={styles.sectionTitle}>Listed on</Text>
              <View style={styles.infoRow}>
                <MaterialIcons name="calendar-today" size={16} color={PRIMARY_COLOR} />
                <Text style={styles.date}>{listingDate}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Footer with action buttons */}
      <View style={styles.footerContainer}>
        {isOwner ? (
          <View style={styles.ownerActionsContainer}>
            <View style={styles.chatButtonRow}>
              <TouchableOpacity
                style={styles.viewChatsButton}
                onPress={handleViewChats}
                disabled={updateStatusLoading}
              >
                <Text style={styles.viewChatsButtonText}>View all chats</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.chatIconButton}
                onPress={handleViewChats}
              >
                <MaterialIcons name="chat" size={20} color={PRIMARY_COLOR} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.statusButtonsContainer}>
              {status === 'available' && (
                <>
                  <TouchableOpacity
                    style={styles.statusButton}
                    onPress={() => updateListingStatus('pending')}
                    disabled={updateStatusLoading}
                  >
                    <Text style={styles.statusButtonText}>Pending pickup</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.statusButton}
                    onPress={() => updateListingStatus('sold')}
                    disabled={updateStatusLoading}
                  >
                    <Text style={styles.statusButtonText}>Mark as Sold</Text>
                  </TouchableOpacity>
                </>
              )}
              
              {status === 'pending' && (
                <>
                  <TouchableOpacity
                    style={[styles.statusButton, styles.primaryButton]}
                    onPress={() => updateListingStatus('available')}
                    disabled={updateStatusLoading}
                  >
                    <Text style={[styles.statusButtonText, styles.primaryButtonText]}>
                      Cancel Pending
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.statusButton}
                    onPress={() => updateListingStatus('sold')}
                    disabled={updateStatusLoading}
                  >
                    <Text style={styles.statusButtonText}>Mark as Sold</Text>
                  </TouchableOpacity>
                </>
              )}
              
              {status === 'sold' && (
                <TouchableOpacity
                  style={[styles.statusButton, styles.primaryButton]}
                  onPress={() => updateListingStatus('available')}
                  disabled={updateStatusLoading}
                >
                  <Text style={[styles.statusButtonText, styles.primaryButtonText]}>
                    Cancel Sold
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.buyerActionsContainer}>
            <TouchableOpacity
              style={styles.makeOfferButton}
              onPress={handleStartChat}
            >
              <Text style={styles.makeOfferButtonText}>Make Offer</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.chatIconButton}
              onPress={handleStartChat}
            >
              <MaterialIcons name="chat" size={24} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {/* Image modal/gallery */}
      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setIsImageModalVisible(false)}
          >
            <AntDesign name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <Carousel
            ref={modalCarouselRef}
            data={arrangedImages}
            renderItem={renderModalCarouselItem}
            sliderWidth={SCREEN_WIDTH}
            itemWidth={SCREEN_WIDTH}
            firstItem={modalImageIndex}
            inactiveSlideScale={1}
            inactiveSlideOpacity={1}
            vertical={false}
          />
          
          {/* Thumbnail carousel */}
          {arrangedImages.length > 1 && (
            <View style={styles.thumbnailContainer}>
              <FlatList
                horizontal
                data={arrangedImages}
                keyExtractor={(_, index) => `thumb-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailList}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => {
                      if (modalCarouselRef.current) {
                        modalCarouselRef.current.snapToItem(index);
                      }
                    }}
                    style={[
                      styles.thumbnail,
                      modalImageIndex === index && styles.activeThumbnail
                    ]}
                  >
                    <Image
                      source={{ uri: getImageUrl(item) }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 50,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editButtonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editIcon: {
    marginRight: 4,
  },
  editButtonText: {
    color: 'white',
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
  },
  likeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 50,
    right: 16,
    zIndex: 100,
  },
  likeButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Manrope_400Regular',
  },
  backButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontFamily: 'Manrope_500Medium',
  },
  carouselContainer: {
    position: 'relative',
    marginTop: 0,
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselArrowLeft: {
    position: 'absolute',
    top: '50%',
    left: 10,
    transform: [{ translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  carouselArrowRight: {
    position: 'absolute',
    top: '50%',
    right: 10,
    transform: [{ translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: '#ddd',
  },
  noImageContainer: {
    width: SCREEN_WIDTH,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  noImageText: {
    color: '#999',
    fontSize: 16,
    fontFamily: 'Manrope_400Regular',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 8,
    right: 0,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  statusText: {
    color: 'white',
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
  },
  detailsContainer: {
    padding: 16,
    marginTop: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    color: '#333',
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    fontFamily: 'Manrope_600SemiBold',
    color: PRIMARY_COLOR,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
    fontFamily: 'Manrope_400Regular',
  },
  descriptionContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontFamily: 'Manrope_400Regular',
  },
  sellerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 16,
  },
  sellerName: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    marginLeft: 8,
    fontFamily: 'Manrope_400Regular',
  },
  date: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    marginLeft: 8,
    fontFamily: 'Manrope_400Regular',
  },
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  ownerActionsContainer: {
    gap: 16,
  },
  chatButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewChatsButton: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewChatsButtonText: {
    color: 'white',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
  },
  chatIconButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonText: {
    color: PRIMARY_COLOR,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  primaryButtonText: {
    color: 'white',
  },
  buyerActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  makeOfferButton: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  makeOfferButtonText: {
    color: 'white',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCarouselItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCarouselImage: {
    width: '90%',
    height: '90%',
  },
  thumbnailContainer: {
    height: 80,
    marginTop: 10,
  },
  thumbnailList: {
    paddingHorizontal: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    marginHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#888',
    overflow: 'hidden',
  },
  activeThumbnail: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 2,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
}); 