import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { tokenStorage } from '../utils/tokenStorage';

const OauthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const oauthError = params.get('error');

    if (token) {
      tokenStorage.setToken(token);
      navigate('/dashboard', { replace: true });
      return;
    }

    setError(oauthError || 'Google sign-in failed. Please try again.');
  }, [location.search, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-sm border border-amber-200 rounded-lg shadow-lg p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold text-amber-900 mb-4">Google Sign-In Failed</h1>
          <p className="text-amber-700 mb-6">{error}</p>
          <Link
            to="/login"
            className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-sm border border-amber-200 rounded-lg shadow-lg p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold text-amber-900 mb-4">Signing you in...</h1>
        <p className="text-amber-700">Completing Google authentication and redirecting to your dashboard.</p>
      </div>
    </div>
  );
};

export default OauthCallback;
