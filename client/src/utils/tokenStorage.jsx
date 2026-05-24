const TOKEN_KEY = 'accessToken';

export const tokenStorage = {
  // Save the access token to localStorage
  setToken: (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  // Retrieve the access token from localStorage
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },

  // Remove the access token from localStorage
  removeToken: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  // Check if a token exists
  hasToken: () => {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};
