import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { setAuthToken, setOnUnauthorizedCallback } from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      logout();
    });
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('user_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setAuthToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to load stored auth state:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await apiClient.post('/auth/login', { username, password });
      const { accessToken, username: userRes, email: emailRes, role, isProfileCompleted } = response.data;

      const userData = {
        username: userRes,
        email: emailRes || '',
        role: role || 'user',
        isProfileCompleted: Boolean(isProfileCompleted)
      };
      await AsyncStorage.setItem('user_token', accessToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      setToken(accessToken);
      setAuthToken(accessToken);
      setUser(userData);
      return { success: true, isProfileCompleted: userData.isProfileCompleted };
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Invalid credentials or connection error.';
      return { success: false, error: errorMsg };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await apiClient.post('/auth/register', { username, email, password });
      return { success: true, message: response.data.message };
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Registration failed. Please try again.';
      return { success: false, error: errorMsg };
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const response = await apiClient.post('/auth/verify-otp', { email, otp });
      const { accessToken, username: userRes, email: emailRes, role, isProfileCompleted } = response.data;

      const userData = {
        username: userRes,
        email: emailRes || email || '',
        role: role || 'user',
        isProfileCompleted: Boolean(isProfileCompleted)
      };
      await AsyncStorage.setItem('user_token', accessToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      setToken(accessToken);
      setAuthToken(accessToken);
      setUser(userData);
      return { success: true, isProfileCompleted: userData.isProfileCompleted };
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Invalid verification code.';
      return { success: false, error: errorMsg };
    }
  };

  const completeProfileSetup = async (updatedFields = {}) => {
    try {
      const updatedUser = {
        ...(user || {}),
        ...updatedFields,
        isProfileCompleted: true
      };
      await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (e) {
      console.error('Failed to update profile completion state:', e);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user_token');
      await AsyncStorage.removeItem('user_data');
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setToken(null);
      setAuthToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      login, register, verifyOtp, completeProfileSetup, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
