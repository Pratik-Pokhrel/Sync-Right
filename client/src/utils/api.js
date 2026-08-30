import axios from "axios";
import { tokenStorage } from "./tokenStorage";

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol || "http:";

  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    return "http://localhost:8000";
  }

  return `${protocol}//${hostname}:8000`;
};

export const API_BASE_URL = getApiBaseUrl();

let csrfToken = null;
let csrfTokenRequest = null;

export const getCsrfToken = async () => {
  if (csrfToken) return csrfToken;
  if (!csrfTokenRequest) {
    csrfTokenRequest = axios
      .get(`${API_BASE_URL}/auth/csrf-token`, { withCredentials: true })
      .then((response) => {
        csrfToken = response.data?.csrfToken || null;
        return csrfToken;
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
  }
  return csrfTokenRequest;
};

// Create axios instance with base URL pointing to the backend server
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Enable sending cookies with requests for refresh token
});

// Request interceptor - add access token to every request
api.interceptors.request.use(
  async (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const method = config.method?.toUpperCase();
    const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    if (needsCsrf) {
      const token = await getCsrfToken();
      if (token) config.headers["X-CSRF-Token"] = token;
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
          `${API_BASE_URL}/refresh`,
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

export const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.patch("/auth/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const removeProfilePicture = async () => {
  const response = await api.delete("/auth/avatar");
  return response.data;
};

export const setup2FA = async () => {
  const response = await api.post("/auth/2fa/setup");
  return response.data;
};

export const verifySetup2FA = async (token) => {
  const response = await api.post("/auth/2fa/verify-setup", { token });
  return response.data;
};

export const disable2FA = async (otp) => {
  const response = await api.post("/auth/2fa/disable", { otp });
  return response.data;
};

/* Looks up the session tied to a room, so RoomChat.jsx doesn't need to
  capture and thread the sessionId from the join response.
 */
export const getActiveSession = async (roomId) => {
  const response = await api.get(`/sessions/room/${roomId}/active`);
  return response.data; // { success, sessionId }
};

// transcript is built client-side from already-decrypted messages
// Only the summary/actionItems that come back get persisted server-side,
// the transcript itself is never stored.
export const submitSessionSummary = async (sessionId, transcript) => {
  const response = await api.post(`/sessions/${sessionId}/summarize`, {
    transcript,
  });
  return response.data; // { success, summary, actionItems }
};

// Not an axios call, just builds the download URL, the browser handles
// the actual GET + file download when the user clicks it.
export const getSessionReportUrl = (sessionId) =>
  `${API_BASE_URL}/sessions/${sessionId}/report`;

/* protect middleware only reads the Authorization header,
  not a cookie, so a plain window.open(getSessionReportUrl(...)) would
  hit a 401. Use this instead, it goes through the axios instance
 (which attaches the Bearer token) and triggers the download manually.
*/
export const downloadSessionReport = async (sessionId) => {
  const response = await api.get(`/sessions/${sessionId}/report`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `session-report-${sessionId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;
