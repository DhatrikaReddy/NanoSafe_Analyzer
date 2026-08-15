import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Fallback host detection: 10.0.2.2 for Android Emulator, localhost for iOS/Web, or standard IP
const BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:5000/mobile/v1'
  : 'http://localhost:5000/mobile/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to attach JWT Token
apiClient.interceptors.request.use(
  async (config) => {
    const token = asyncStorageGetToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let cachedToken = null;

export const setAuthToken = (token) => {
  cachedToken = token;
};

const asyncStorageGetToken = () => cachedToken;

export default apiClient;
