import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store (SDK 58) no soporta web: en el navegador usamos localStorage.
const isWeb = Platform.OS === 'web';

export const getSecure = async (key) => {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }
  return await SecureStore.getItemAsync(key);
};

export const setSecure = async (key, value) => {
  if (isWeb) {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

export const deleteSecure = async (key) => {
  if (isWeb) {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
};
