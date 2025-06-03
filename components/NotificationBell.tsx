import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useNotifications } from '../context/NotificationContext';

// Helper function to format timestamp relative to now
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

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, loading } = useNotifications();
  const router = useRouter();

  // Handle notification click
  const handleNotificationClick = async (notification: any) => {
    await markAsRead(notification.id);
    setIsOpen(false);

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

  // View all notifications
  const viewAllNotifications = () => {
    setIsOpen(false);
    router.push('/notifications');
  };

  // Sort notifications by created_at in descending order
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <View>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={styles.bellButton}
      >
        <Ionicons name="notifications-outline" size={24} color="#333" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Notifications</Text>
                  <TouchableOpacity onPress={() => setIsOpen(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2528be" />
                  </View>
                ) : sortedNotifications.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No notifications yet</Text>
                  </View>
                ) : (
                  <FlatList
                    data={sortedNotifications.slice(0, 5)}
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

                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={viewAllNotifications}
                >
                  <Text style={styles.viewAllText}>View all notifications</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
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
  viewAllButton: {
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewAllText: {
    color: '#2528be',
    fontWeight: '600',
  },
}); 