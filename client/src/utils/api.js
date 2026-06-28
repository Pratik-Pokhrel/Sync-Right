import axios from "axios";
import { tokenStorage } from "./tokenStorage";

// Create axios instance with base URL pointing to the backend server
const api = axios.create({
  baseURL: "http://192.168.1.74:8000",
  withCredentials: true, // Enable sending cookies with requests for refresh token
});

// Request interceptor - add access token to every request
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle token refresh or logout on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If we get a 401 and haven't already tried to refresh, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await axios.post(
          "http://192.168.1.74:8000/refresh",
          {},
          { withCredentials: true },
        );
        const { accessToken } = response.data;
        tokenStorage.setToken(accessToken);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear token and redirect to login
        tokenStorage.removeToken();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
