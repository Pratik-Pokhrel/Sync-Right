import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { tokenStorage } from '../utils/tokenStorage';
import FormInput from '../components/FormInput';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/login', formData);
      const { accessToken, user } = response.data;

      // Store the access token
      tokenStorage.setToken(accessToken);

      // Redirect to dashboard or home page
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-sm border border-amber-200 rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif text-amber-900 mb-2">Welcome Back</h1>
          <p className="text-amber-700">Sign in to your account</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormInput
            label="Email Address"
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
          />

          <FormInput
            label="Password"
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-medium py-3 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4">
          <a
            href="http://localhost:8000/auth/google"
            className="flex items-center justify-center w-full gap-3 mt-3 border border-amber-200 hover:border-amber-300 bg-white text-amber-900 font-medium py-3 px-4 rounded-md transition duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" className="h-5 w-5">
              <path fill="#4285f4" d="M533.5 278.4c0-18.4-1.5-36.1-4.3-53.4H272v101h146.9c-6.4 34.4-25.6 63.5-54.6 83v68h88.3c51.8-47.8 81.9-118 81.9-198.6z"/>
              <path fill="#34a853" d="M272 544.3c73.4 0 135-24.3 180-65.7l-88.3-68c-24.6 16.5-56 26.3-91.7 26.3-70.6 0-130.4-47.7-151.9-111.9H30.6v70.4C76 499.8 167.4 544.3 272 544.3z"/>
              <path fill="#fbbc04" d="M120.1 323.1c-10.2-30.6-10.2-63.6 0-94.2V158.5H30.6c-39.7 79.5-39.7 173.6 0 253.1l89.5-70.4z"/>
              <path fill="#ea4335" d="M272 107.7c39.9 0 75.7 13.7 104 40.6l78-78C404.4 24.3 343.4 0 272 0 167.4 0 76 44.5 30.6 113.1l89.5 70.4C141.6 155.4 201.4 107.7 272 107.7z"/>
            </svg>
            Continue with Google
          </a>
        </div>

        <div className="mt-6 text-center">
          <p className="text-amber-700">
            Don't have an account?{' '}
            <Link to="/register" className="text-amber-600 hover:text-amber-800 font-medium underline">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;