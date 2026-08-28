import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, {
  uploadProfilePicture,
  removeProfilePicture,
  setup2FA,
  verifySetup2FA,
  disable2FA,
} from '../utils/api';
import { getAvatarUrl, getDisplayName } from '../utils/avatar';
import { disconnectSocket } from '../utils/socket';
import { tokenStorage } from '../utils/tokenStorage';

const Profile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [setupToken, setSetupToken] = useState('');
  const [disableOtp, setDisableOtp] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        const currentUser = response.data?.user;
        setUser(currentUser);
        setAvatarUrl(getAvatarUrl(currentUser));
      } catch (error) {
        console.error('Failed to fetch current user', error);
        navigate('/dashboard');
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  // Handle keyboard and click-outside to close modal
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setIsModalOpen(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'auto';
    };
  }, [isModalOpen]);

  const handleBackClick = () => {
    navigate('/dashboard');
  };

  const handleLogout = () => {
    disconnectSocket();
    tokenStorage.removeToken();
    navigate('/login');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessageType('error');
      setMessage('Please choose a valid image file.');
      event.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessageType('error');
      setMessage('Please choose an image smaller than 10MB.');
      event.target.value = '';
      return;
    }

    setUploadingAvatar(true);
    setMessage('');

    try {
      const response = await uploadProfilePicture(file);
      setUser((prevUser) => {
        const nextUser = prevUser ? { ...prevUser, avatar: response.avatar } : { avatar: response.avatar };
        setAvatarUrl(getAvatarUrl(nextUser));
        return nextUser;
      });
      setMessageType('success');
      setMessage('Profile picture updated successfully.');
    } catch (error) {
      setMessageType('error');
      setMessage(error.response?.data?.message || 'Unable to update profile picture.');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.avatar) {
      setMessageType('warning');
      setMessage('No profile picture to remove.');
      return;
    }

    if (!confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setRemovingAvatar(true);
    setMessage('');

    try {
      await removeProfilePicture();
      setUser((prevUser) => {
        const nextUser = prevUser ? { ...prevUser, avatar: null } : { avatar: null };
        setAvatarUrl(getAvatarUrl(nextUser));
        return nextUser;
      });
      setMessageType('success');
      setMessage('Profile picture removed successfully.');
    } catch (error) {
      setMessageType('error');
      setMessage(error.response?.data?.message || 'Unable to remove profile picture.');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSetup2FA = async () => {
    setTwoFactorLoading(true);
    setMessage('');

    try {
      const response = await setup2FA();
      setTwoFactorSetup(response);
      setSetupToken('');
      setMessageType('success');
      setMessage('Scan the QR code, then enter the code from your authenticator app.');
    } catch (error) {
      setMessageType('error');
      setMessage(error.response?.data?.message || 'Unable to start 2FA setup.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifySetup2FA = async (event) => {
    event.preventDefault();
    setTwoFactorLoading(true);
    setMessage('');

    try {
      await verifySetup2FA(setupToken);
      setUser((prevUser) => ({ ...prevUser, twoFactorEnabled: true }));
      setTwoFactorSetup(null);
      setSetupToken('');
      setMessageType('success');
      setMessage('Two-factor authentication is now enabled.');
    } catch (error) {
      setMessageType('error');
      setMessage(error.response?.data?.message || 'Unable to verify the 2FA code.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async (event) => {
    event.preventDefault();
    setTwoFactorLoading(true);
    setMessage('');

    try {
      await disable2FA(disableOtp);
      setUser((prevUser) => ({ ...prevUser, twoFactorEnabled: false }));
      setDisableOtp('');
      setMessageType('success');
      setMessage('Two-factor authentication has been disabled.');
    } catch (error) {
      setMessageType('error');
      setMessage(error.response?.data?.message || 'Unable to disable 2FA.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-300">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-page min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_20%)]" />

      <div className="relative z-10 p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  onClick={handleBackClick}
                  className="cursor-pointer text-sm text-sky-300 transition duration-200 ease-out hover:-translate-y-0.5 hover:text-sky-200"
                >
                  ← Back to Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className="cursor-pointer rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-rose-500/20 hover:shadow-lg hover:shadow-rose-500/10"
                >
                  Logout
                </button>
              </div>
              <h1 className="text-3xl font-semibold text-white">My Profile</h1>
            </div>
          </div>

          {/* Profile Card */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="relative z-10 space-y-6">
              {/* Profile Picture Section */}
              <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="relative h-40 w-40 rounded-full border-4 border-white/20 bg-slate-900/70 shadow-lg shadow-slate-950/30 overflow-hidden cursor-pointer transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-cyan-300/60 hover:shadow-cyan-500/10"
                    title="Click to view full profile picture"
                  >
                    <img
                      src={avatarUrl || getAvatarUrl(user)}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                    </div>
                  </button>
                  <div className="absolute bottom-0 right-0 flex gap-2">
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      disabled={uploadingAvatar}
                      className="cursor-pointer rounded-full bg-cyan-500 p-3 text-white shadow-lg shadow-cyan-500/20 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.05] hover:bg-cyan-400 hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-70"
                      title="Update profile picture"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    {user?.avatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={removingAvatar}
                        className="cursor-pointer rounded-full bg-rose-500 p-3 text-white shadow-lg shadow-rose-500/20 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.05] hover:bg-rose-400 hover:shadow-rose-500/30 disabled:cursor-not-allowed disabled:opacity-70"
                        title="Remove profile picture"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Display */}
              {message && (
                <div className={`rounded-lg p-4 text-center text-sm font-medium ${
                  messageType === 'success'
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-200'
                    : messageType === 'error'
                    ? 'bg-rose-500/20 border border-rose-500/50 text-rose-200'
                    : 'bg-amber-500/20 border border-amber-500/50 text-amber-200'
                }`}>
                  {message}
                </div>
              )}

              {/* User Details Section */}
              <div className="space-y-4 border-t border-white/10 pt-6">
                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Username
                  </label>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-slate-100">
                    {user?.username || 'N/A'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Email
                  </label>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-slate-100">
                    {user?.email || 'N/A'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Account Status
                  </label>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-slate-100 flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
                    Active
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Role
                  </label>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-slate-100 capitalize">
                    {user?.role || 'User'}
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-white/10 pt-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Two-factor authentication</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {user.twoFactorEnabled
                      ? 'Your account is protected with an authenticator app.'
                      : 'Add an authenticator app for an extra sign-in check.'}
                  </p>
                </div>

                {user.twoFactorEnabled ? (
                  <form onSubmit={handleDisable2FA} className="space-y-3">
                    <label htmlFor="disable-2fa-otp" className="block text-sm text-slate-300">
                      Current authenticator code
                    </label>
                    <input
                      id="disable-2fa-otp"
                      type="text"
                      value={disableOtp}
                      onChange={(event) => setDisableOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300"
                      placeholder="e.g.123456"
                    />
                    <button
                      type="submit"
                      disabled={twoFactorLoading}
                      className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {twoFactorLoading ? 'Working...' : 'Disable 2FA'}
                    </button>
                  </form>
                ) : twoFactorSetup ? (
                  <form onSubmit={handleVerifySetup2FA} className="space-y-4">
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                      <img src={twoFactorSetup.qrCode} alt="2FA setup QR code" className="h-48 w-48 rounded-lg bg-white p-2" />
                      <p className="break-all text-center text-xs text-slate-400">{twoFactorSetup.otpauth}</p>
                    </div>
                    <label htmlFor="setup-2fa-token" className="block text-sm text-slate-300">
                      Verification code
                    </label>
                    <input
                      id="setup-2fa-token"
                      type="text"
                      value={setupToken}
                      onChange={(event) => setSetupToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300"
                      placeholder="123456"
                    />
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={twoFactorLoading}
                        className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {twoFactorLoading ? 'Verifying...' : 'Enable 2FA'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTwoFactorSetup(null)}
                        className="rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={handleSetup2FA}
                    disabled={twoFactorLoading}
                    className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {twoFactorLoading ? 'Starting setup...' : 'Set up 2FA'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />

          {/* Profile Picture Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div
                ref={modalRef}
                className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
              >
                {/* Close button */}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 z-10 cursor-pointer rounded-full bg-slate-950/80 p-2 text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.05] hover:bg-slate-950 focus:outline-none"
                  title="Close (ESC)"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Image container */}
                <div className="relative bg-slate-950 flex items-center justify-center" style={{ maxHeight: '80vh' }}>
                  <img
                    src={avatarUrl || getAvatarUrl(user)}
                    alt="Profile Full View"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Footer with user info */}
                <div className="bg-slate-800/50 backdrop-blur-sm p-4 border-t border-white/10">
                  <div className="text-center">
                    <h2 className="text-lg font-semibold text-white">{getDisplayName(user)}</h2>
                    <p className="text-sm text-slate-300">{user?.email}</p>
                  </div>
                </div>

                {/* Keyboard hint */}
                <div className="absolute bottom-4 right-4 text-xs text-slate-400">
                  Press ESC to close
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
