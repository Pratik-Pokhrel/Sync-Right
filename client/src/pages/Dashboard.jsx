import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { getAvatarUrl, getDisplayName } from '../utils/avatar';
import { connectSocket, disconnectSocket } from '../utils/socket';
import { tokenStorage } from '../utils/tokenStorage';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const token = tokenStorage.getToken();
    if (token) {
      connectSocket(token);
    }

    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        const currentUser = response.data?.user;
        setUser(currentUser);
        setAvatarUrl(getAvatarUrl(currentUser));
      } catch (error) {
        console.error('Failed to fetch current user', error);
      }
    };

    fetchCurrentUser();
  }, []);

  const handleLogout = () => {
    disconnectSocket();
    tokenStorage.removeToken();
    navigate('/login');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_20%)]" />

      <div className="relative z-10 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <Link
                    to="/profile"
                    className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 shadow-lg shadow-slate-950/30 transition hover:scale-105"
                    title="View profile"
                  >
                    <img
                      src={avatarUrl || getAvatarUrl(user)}
                      alt="Profile"
                      className="h-full w-full rounded-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/60 text-lg font-semibold text-white opacity-0 transition group-hover:opacity-100">
                      →
                    </span>
                  </Link>
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-[0.3em] text-sky-300/70">Welcome</p>
                    <h1 className="text-2xl font-semibold text-white">{getDisplayName(user)}</h1>
                    <p className="text-sm text-slate-300">{user?.email || 'You are successfully logged in'}</p>
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap justify-end">
                  <Link
                    to="/rooms"
                    className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
                  >
                    Rooms
                  </Link>
                  {(() => {
                    const currentUser = tokenStorage.getUser();
                    if (currentUser && currentUser.role === 'admin') {
                      return (
                        <Link to="/admin" className="rounded-2xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400">
                          Admin Panel
                        </Link>
                      );
                    }
                    return null;
                  })()}
                  <button
                    onClick={handleLogout}
                    className="rounded-2xl bg-rose-500/20 border border-rose-400/50 px-6 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features Card */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="relative z-10">
              <h2 className="text-2xl font-semibold text-white mb-6">Features</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-slate-200 flex items-center gap-2"><span className="text-cyan-400">✓</span>Real-time Chat</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-slate-200 flex items-center gap-2"><span className="text-cyan-400">✓</span>WebRTC Video/Audio</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-slate-200 flex items-center gap-2"><span className="text-cyan-400">✓</span>Collaborative Whiteboard</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-slate-200 flex items-center gap-2"><span className="text-cyan-400">✓</span>Multiple Chat Rooms</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
