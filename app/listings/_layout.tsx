import { Stack } from 'expo-router';
import React from 'react';

// Primary color constant
const PRIMARY_COLOR = '#2528be';

export default function ListingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: PRIMARY_COLOR,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        animation: 'slide_from_right',
      }}
    >
      {/* Explicitly hide header for product detail page */}
      <Stack.Screen 
        name="[slug]/[product_id]/page" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right'
        }} 
      />
    </Stack>
  );
} 