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
    />
  );
} 