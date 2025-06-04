import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, View, useColorScheme } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function TabBarIcon(props: {
  iconType?: 'ionicons' | 'material' | 'fa5' | 'fa6';
  name: any;
  color: string;
  size?: number;
  style?: any;
  solid?: boolean;
  animatedStyle?: any;
}) {
  const { iconType = 'ionicons', animatedStyle, ...rest } = props;
  
  const IconComponent = () => {
    if (iconType === 'material') {
      return <MaterialIcons size={props.size || 24} {...rest} />;
    } else if (iconType === 'fa5') {
      return <FontAwesome5 size={props.size || 24} {...rest} />;
    } else if (iconType === 'fa6') {
      return <FontAwesome6 size={props.size || 24} {...rest} />;
    } else {
      return <Ionicons size={props.size || 24} {...rest} />;
    }
  };
  
  if (animatedStyle) {
    return (
      <Animated.View style={animatedStyle}>
        <IconComponent />
      </Animated.View>
    );
  }
  
  return <IconComponent />;
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  // Animation values
  const tabWidth = SCREEN_WIDTH / state.routes.length;
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const iconAnimations = useRef(
    state.routes.map(() => ({
      scale: new Animated.Value(1),
      opacity: new Animated.Value(state.index === 0 ? 0 : 1)
    }))
  ).current;
  
  // Update animations when tab changes
  useEffect(() => {
    // Animate bubble position
    Animated.spring(animatedValue, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      tension: 70,
      friction: 7
    }).start();
    
    // Animate bubble scale
    Animated.sequence([
      Animated.timing(animatedScale, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.spring(animatedScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4
      })
    ]).start();
    
    // Animate icons
    state.routes.forEach((_: any, i: number) => {
      Animated.parallel([
        Animated.timing(iconAnimations[i].scale, {
          toValue: i === state.index ? 1.1 : 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(iconAnimations[i].opacity, {
          toValue: i === state.index ? 0 : 1,
          duration: 150,
          useNativeDriver: true
        })
      ]).start();
    });
  }, [state.index]);
  
  const getTabIcon = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case 'index':
        return {
          iconType: 'material' as const,
          name: 'view-list',
          size: isFocused ? 24 : 26,
        };
      case 'liked':
        return {
          iconType: 'fa5' as const,
          name: 'heart',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };
      case 'add':
        return {
          iconType: 'fa6' as const,
          name: 'plus',
          size: isFocused ? 24 : 26,
        };
      case 'chats':
        return {
          iconType: 'fa5' as const,
          name: 'comment',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };
      case 'profile':
        return {
          iconType: 'fa5' as const,
          name: 'user',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };
      default:
        return {
          iconType: 'fa5' as const,
          name: 'question-circle',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };
    }
  };
  
  // Animation styles
  const bubbleTranslateX = animatedValue.interpolate({
    inputRange: [0, SCREEN_WIDTH - tabWidth],
    outputRange: [(tabWidth - 34) / 2, SCREEN_WIDTH - tabWidth + (tabWidth - 34) / 2],
    extrapolate: 'clamp'
  });
  
  const bubbleTransformStyle = {
    transform: [
      { translateX: bubbleTranslateX },
      { translateY: -15 },
      { scale: animatedScale }
    ]
  };

  return (
    <View style={styles.tabBarContainer}>
      <View />
      
      {/* Animated Floating Bubble */}
      <Animated.View style={[styles.floatingBubble, bubbleTransformStyle]}>
        <TabBarIcon
          iconType={getTabIcon(state.routes[state.index].name, true).iconType}
          name={getTabIcon(state.routes[state.index].name, true).name}
          color="#FFFFFF"
          size={getTabIcon(state.routes[state.index].name, true).size}
          style={styles.activeIcon}
          solid={getTabIcon(state.routes[state.index].name, true).solid}
        />
      </Animated.View>
      
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const tabIcon = getTabIcon(route.name, isFocused);
        
        const iconAnimatedStyle = {
          transform: [{ scale: iconAnimations[index].scale }],
          opacity: iconAnimations[index].opacity
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
          >
            <TabBarIcon
              iconType={tabIcon.iconType}
              name={tabIcon.name}
              color="#333333"
              size={tabIcon.size}
              style={styles.inactiveIcon}
              solid={tabIcon.solid}
              animatedStyle={iconAnimatedStyle}
            />
          </Pressable>
        );
      })}
      <View style={styles.bottomIndicator} />
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Listings',
        }}
      />
      
      <Tabs.Screen
        name="liked"
        options={{
          title: 'Liked',
        }}
      />
      
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
        }}
      />
      
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'white',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    height: 75,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 5,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 22,
    height: '100%',
    width: 65,
    position: 'relative',
  },
  floatingBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2528be',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2528be',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
    position: 'absolute',
    top: -10,
    left: 0,
    zIndex: 10,
  },
  activeIcon: {
    zIndex: 2,
  },
  inactiveIcon: {
    opacity: 0.9,
  },
  bottomIndicator: {
    width: 134,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    position: 'absolute',
    bottom: 8,
    opacity: 0.7,
  },
});
