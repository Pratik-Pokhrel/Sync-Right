import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { tokenStorage } from '../utils/tokenStorage';
import FormInput from '../components/FormInput';
import AuthPageLayout from '../components/AuthPageLayout';

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
      const response = await api.post('/auth/login', formData);
      const { accessToken } = response.data;

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

    <AuthPageLayout subtitle="Sign in to your account">
      <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl" >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
        <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          {error && (
            <div className="mb-6 rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
            className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-500/60"
            >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 space-y-4">
          <a
            href="http://localhost:8000/auth/google"
            className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/15"
            >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" className="h-5 w-5">
              <path fill="#4285f4" d="M533.5 278.4c0-18.4-1.5-36.1-4.3-53.4H272v101h146.9c-6.4 34.4-25.6 63.5-54.6 83v68h88.3c51.8-47.8 81.9-118 81.9-198.6z"/>
              <path fill="#34a853" d="M272 544.3c73.4 0 135-24.3 180-65.7l-88.3-68c-24.6 16.5-56 26.3-91.7 26.3-70.6 0-130.4-47.7-151.9-111.9H30.6v70.4C76 499.8 167.4 544.3 272 544.3z"/>
              <path fill="#fbbc04" d="M120.1 323.1c-10.2-30.6-10.2-63.6 0-94.2V158.5H30.6c-39.7 79.5-39.7 173.6 0 253.1l89.5-70.4z"/>
              <path fill="#ea4335" d="M272 107.7c39.9 0 75.7 13.7 104 40.6l78-78C404.4 24.3 343.4 0 272 0 167.4 0 76 44.5 30.6 113.1l89.5 70.4C141.6 155.4 201.4 107.7 272 107.7z"/>
            </svg>
            Continue with Google
          </a>

          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-white hover:text-cyan-200">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
      </div>
    </AuthPageLayout>


    );
  };


export default Login;