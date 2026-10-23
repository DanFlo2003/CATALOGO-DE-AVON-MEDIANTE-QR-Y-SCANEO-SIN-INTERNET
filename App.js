import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import PinScreen from './src/screens/PinScreen';

export default function App() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PinScreen onUnlocked={() => setUnlocked(true)} />;
  }

  return (
    <AppProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </AppProvider>
  );
}
