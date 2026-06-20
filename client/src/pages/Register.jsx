import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import FormInput from '../components/FormInput';
import AuthPageLayout from '../components/AuthPageLayout';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
    setFieldErrors({});

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password
      });

      // Show success message
      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      // Handle field-level errors from backend
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
        setError(err.response.data.message || 'Registration failed');
      } else {
        setError(err.response?.data?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout title="Create your account" subtitle="Start collaborating with secure access">
      <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
        <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          {success && (
            <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              Registration successful! Redirecting to login...
            </div>
          )}

        {error && (
          <div className="mb-6 rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" disabled={success}>
          <FormInput
            label="Username"
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Choose a username"
            required
            error={fieldErrors.username}
          />

          <FormInput
            label="Email Address"
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
            error={fieldErrors.email}
          />

          <FormInput
            label="Password"
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Create a password"
            required
          />

          <FormInput
            label="Confirm Password"
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm your password"
            required
          />

          <button
            type="submit"
            disabled={loading || success}
            className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-500/60"
          >
            {loading ? 'Creating Account...' : success ? 'Account Created!' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-white hover:text-cyan-200">
            Sign in here
          </Link>
        </p>
      </div>
      </div>
    </AuthPageLayout>
  );
};

export default Register;