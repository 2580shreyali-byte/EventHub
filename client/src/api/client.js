import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Guarantees HTTP-only auth cookies are sent on every request
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for consistent error extraction
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data?.error;
    const message = errorData?.message || error.message || 'An unexpected error occurred';
    const code = errorData?.code || 'UNKNOWN_ERROR';
    
    // Create an enhanced error object
    const enhancedError = new Error(message);
    enhancedError.code = code;
    enhancedError.statusCode = error.response?.status;
    enhancedError.details = errorData?.details || [];
    enhancedError.raw = error.response?.data;
    
    return Promise.reject(enhancedError);
  }
);

export default api;
