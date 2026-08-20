import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Determine Host IP dynamically from Expo environment (supports iPhone, Android, and Web)
const getBaseUrl = () => {
  let host = 'localhost';

  // 1. Try to detect host IP from Expo Go bundler connection (iPhone/Android on Wi-Fi)
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  if (debuggerHost) {
    host = debuggerHost.split(':')[0];
  } else if (Platform.OS === 'android') {
    host = '10.0.2.2'; // Standard Android emulator fallback
  }

  // If running on physical device where host is detected as localhost, fallback to known Wi-Fi IP
  if (host === 'localhost' && Platform.OS !== 'web') {
    host = '172.20.10.3';
  }

  return `http://${host}:5000/mobile/v1`;
};

const BASE_URL = getBaseUrl();
console.log('📡 [NanoSafe API] Configured Base URL:', BASE_URL);

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to attach JWT Token
apiClient.interceptors.request.use(
  async (config) => {
    let token = cachedToken;
    if (!token) {
      try {
        token = await AsyncStorage.getItem('user_token');
        if (token) {
          cachedToken = token;
        }
      } catch (e) {
        // storage read error ignored
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let cachedToken = null;
let onUnauthorizedCallback = null;

export const setAuthToken = (token) => {
  cachedToken = token;
};

export const setOnUnauthorizedCallback = (callback) => {
  onUnauthorizedCallback = callback;
};

// Response interceptor to handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('⚠️ [NanoSafe API] 401 Unauthorized encountered. Resetting session...');
      cachedToken = null;
      try {
        await AsyncStorage.removeItem('user_token');
      } catch (e) {}
      if (typeof onUnauthorizedCallback === 'function') {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

const asyncStorageGetToken = () => cachedToken;

export default apiClient;
