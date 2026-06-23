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
      <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center p-4">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative z-10 w-full max-w-md">
          <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="relative z-10 text-center">
              <h1 className="text-2xl font-semibold text-white mb-4">Google Sign-In Failed</h1>
              <p className="text-slate-300 mb-6">{error}</p>
              <Link
                to="/login"
                className="inline-block bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-3 px-6 rounded-2xl transition shadow-lg shadow-cyan-500/20"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
          <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            </div>
            <h1 className="text-2xl font-semibold text-white mb-4">Signing you in...</h1>
            <p className="text-slate-300">Completing Google authentication and redirecting to your dashboard.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OauthCallback;
