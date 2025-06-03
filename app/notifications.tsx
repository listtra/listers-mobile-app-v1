import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

// Header component for the notifications page
const NotificationsHeader = () => {
  const router = useRouter();
  
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#333" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>Notifications</Text>
      
      {/* Empty view to balance the header */}
      <View style={styles.headerButton} />
    </View>
  );
};

// Helper function to format timestamp (simplified to match the design)
const formatTimestamp = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHrs < 1) return "Just now";
    if (diffHrs < 24) return `${diffHrs}hrs`;
    return `${Math.floor(diffHrs / 24)}d`;
  } catch (e) {
    return '2hrs'; // Fallback to match the design
  }
};

// Helper function to get emoji based on notification type
const getNotificationIcon = (type: string): string => {
  switch (type) {
    case 'like':
      return '♥️';
    case 'offer':
      return '💰';
    case 'message':
      return '💬';
    case 'review':
      return '⭐';
    case 'price_update':
      return '💲';
    case 'item_sold':
      return '🛒';
    default:
      return '📌';
  }
};

export default function NotificationsScreen() {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error, 
    markAsRead, 
    markAllAsRead,
    fetchNotifications 
  } = useNotifications();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Fetch notifications on screen load
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Handle notification click
  const handleNotificationClick = async (notification: any) => {
    await markAsRead(notification.id);

    // Navigate based on notification type
    if (
      (notification.notification_type === 'like' ||
        notification.notification_type === 'price_update' ||
        notification.notification_type === 'review' ||
        notification.notification_type === 'item_sold' ||
        notification.notification_type === 'offer' ||
        notification.notification_type === 'message') &&
      notification.object_id
    ) {
      // Split the object_id to get slug and product_id
      const [slug, product_id] = notification.object_id.split(':');
      if (slug && product_id) {
        router.push({
          pathname: '/listings/[slug]/[product_id]/page',
          params: { slug, product_id }
        });
      } else {
        console.log('Invalid object_id format:', notification.object_id);
      }
    }
  };

  // Sort notifications by created_at in descending order
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Handle "Mark all as read" button press
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <NotificationsHeader />
      
      <View style={styles.container}>
        {unreadCount > 0 && (
          <TouchableOpacity 
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2528be" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => fetchNotifications()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : sortedNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          <FlatList
            data={sortedNotifications}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.notificationItem}
                onPress={() => handleNotificationClick(item)}
              >
                <View style={styles.notificationIcon}>
                  {item.product_image ? (
                    <Image
                      source={{ uri: item.product_image }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.iconText}>
                        {getNotificationIcon(item.notification_type)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationText} numberOfLines={2}>
                    {item.text || item.message}
                  </Text>
                </View>
                <View style={styles.rightContent}>
                  <Text style={styles.timestamp}>
                    {formatTimestamp(item.created_at)}
                  </Text>
                  {!item.is_read && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerButton: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  markAllButton: {
    alignSelf: 'flex-end',
    margin: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2528be',
    borderRadius: 6,
  },
  markAllText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 20,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2528be',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  notificationItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  notificationIcon: {
    width: 60,
    height: 60,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginRight: 15,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  rightContent: {
    alignItems: 'flex-end',
    marginLeft: 10,
    width: 45,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2528be',
  },
}); 