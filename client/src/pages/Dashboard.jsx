import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getDisplayName } from '../utils/avatar';
import { connectSocket } from '../utils/socket';
import { tokenStorage } from '../utils/tokenStorage';
import FormInput from '../components/FormInput';
import JoinRoomDialog from '../components/JoinRoomDialog';

const MY_ROOM_IDS_KEY = 'sync-right-my-room-ids';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    password: '',
    maxParticipants: 10,
  });
  const [joinPassword, setJoinPassword] = useState({});
  const [activeJoinId, setActiveJoinId] = useState(null);
  const [extraActiveRooms, setExtraActiveRooms] = useState([]);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joiningById, setJoiningById] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const currentUser = useMemo(() => tokenStorage.getUser(), []);
  const currentUserId = currentUser?.id;

  const getParticipantId = (participant) => {
    if (!participant) return null;
    if (typeof participant === 'string') return participant;
    if (participant._id) return participant._id;
    return participant.toString?.() || null;
  };

  const isParticipant = (room) => {
    return room?.participants?.some((participant) => getParticipantId(participant) === currentUserId);
  };

  const getHostName = (room) => {
    if (room.host?.username) return room.host.username;
    if (typeof room.host === 'string' && room.host === currentUserId) return 'You';
    if (room.host?._id && room.host._id === currentUserId) return 'You';
    return 'Unknown';
  };

  const activeRooms = useMemo(() => {
    const joinedFetched = rooms.filter((room) => isParticipant(room));
    const merged = [...joinedFetched, ...extraActiveRooms];
    const seen = new Set();
    return merged.filter((room) => {
      if (seen.has(room._id)) return false;
      seen.add(room._id);
      return true;
    });
  }, [rooms, extraActiveRooms, currentUserId]);

  const hostRoomIds = useMemo(() => {
    return new Set(rooms.filter((room) => room.host?._id === currentUser?.id).map((room) => room._id));
  }, [rooms, currentUser]);

  const fetchRooms = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/rooms');
      setRooms(response.data.rooms || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = tokenStorage.getToken();
    if (token) {
      connectSocket(token);
    }

    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        const currentUserData = response.data?.user;
        setUser(currentUserData);
      } catch (error) {
        console.error('Failed to fetch current user', error);
      }
    };

    fetchCurrentUser();
    fetchRooms();
  }, []);

  const handleCreateChange = (e) => {
    const value = e.target.name === 'maxParticipants' ? Number(e.target.value) : e.target.value;
    setCreateForm({
      ...createForm,
      [e.target.name]: value,
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    if (!createForm.name.trim()) {
      setError('Room name is required');
      setCreating(false);
      return;
    }

    try {
      const createResponse = await api.post('/rooms/create', {
        name: createForm.name.trim(),
        password: createForm.password || undefined,
        maxParticipants: createForm.maxParticipants,
      });

      const createdRoom = createResponse.data.room;
      const joinResponse = await api.post(`/rooms/join/${createdRoom.roomId}`, {
        password: createForm.password || undefined,
      });
      const joinedRoom = joinResponse.data.room;
      const storedRoomIds = JSON.parse(localStorage.getItem(MY_ROOM_IDS_KEY) || '[]');
      if (!storedRoomIds.includes(joinedRoom.roomId || joinedRoom._id)) {
        localStorage.setItem(MY_ROOM_IDS_KEY, JSON.stringify([...storedRoomIds, joinedRoom.roomId || joinedRoom._id]));
      }
      setExtraActiveRooms((prev) => {
        if (prev.some((room) => room._id === joinedRoom._id)) return prev;
        return [...prev, joinedRoom];
      });

      setSuccess('Room created and entered successfully');
      setCreateForm({ name: '', password: '', maxParticipants: 10 });
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (room) => {
    setError('');
    setSuccess('');

    if (room.isPrivate && !joinPassword[room._id]) {
      setActiveJoinId(room._id);
      return;
    }

    try {
      const response = await api.post(`/rooms/join/${room.roomId}`, {
        password: room.isPrivate ? joinPassword[room._id] : undefined,
      });

      const joinedRoom = response.data.room;
      if (joinedRoom.isPrivate || !rooms.some((item) => item._id === joinedRoom._id)) {
        setExtraActiveRooms((prev) => {
          if (prev.some((item) => item._id === joinedRoom._id)) return prev;
          return [...prev, joinedRoom];
        });
      }

      setSuccess(`Joined room “${room.name}” successfully`);
      setJoinPassword((prev) => ({ ...prev, [room._id]: '' }));
      setActiveJoinId(null);
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to join room');
    }
  };

  const handleJoinById = async (roomId, password) => {
    setJoiningById(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post(`/rooms/join/${roomId}`, { password: password || undefined });
      const joinedRoom = response.data.room;
      setExtraActiveRooms((prev) => {
        if (prev.some((room) => room._id === joinedRoom._id)) return prev;
        return [...prev, joinedRoom];
      });
      setSuccess(`Joined room “${joinedRoom.name}” successfully`);
      setJoinDialogOpen(false);
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to join room');
    } finally {
      setJoiningById(false);
    }
  };

  const handleCopyRoomId = async (roomId) => {
    try {
      await navigator.clipboard.writeText(roomId);
      setSuccess('Room ID copied to clipboard');
    } catch {
      setError('Unable to copy room ID');
    }
  };

  const handleLeave = async (room) => {
    setError('');
    setSuccess('');

    try {
      await api.post(`/rooms/leave/${room._id}`);
      setSuccess(`Left room “${room.name}” successfully`);
      setExtraActiveRooms((prev) => prev.filter((item) => item._id !== room._id));
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to leave room');
    }
  };

  const handleDelete = async (roomId) => {
    if (!window.confirm('Delete this room permanently?')) return;
    setError('');
    setSuccess('');

    try {
      await api.delete(`/rooms/${roomId}`);
      setSuccess('Room deleted successfully');
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete room');
    }
  };

  return (
    <div className="dashboard-page min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_25%)]" />
      <div className="dashboard-overlay absolute inset-0 bg-slate-950/80" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.3em] text-cyan-300/70">Welcome</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{getDisplayName(user)}</h1>
          </div>

          <div className="dashboard-menu-wrap">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
              className="dashboard-menu-button"
            >
              <span aria-hidden="true">...</span>
            </button>
            {menuOpen && (
              <nav className="dashboard-menu" aria-label="Main navigation">
                <button type="button" onClick={() => { setJoinDialogOpen(true); setMenuOpen(false); }}>Join a Room</button>
                <button type="button" onClick={() => { navigate('/rooms'); setMenuOpen(false); }}>My Rooms</button>
                <button type="button" onClick={() => { navigate('/profile'); setMenuOpen(false); }}>My Profile</button>
              </nav>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-rose-100">{error}</div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">{success}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <section className="rounded-[30px] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-white">Rooms</h2>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100">
                {activeRooms.length} active
              </span>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-slate-300">Current sessions</h3>
                {activeRooms.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 px-4 py-6 text-slate-300">
                    You are not in any room yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeRooms.map((room) => (
                      <div key={room._id} className="room-row-surface room-row-active rounded-2xl border border-white/10 bg-[#f5f1e9] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-lg font-semibold text-white">{room.name}</span>
                              {room.isPrivate && (
                                <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100">
                                  Private
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-300">Hosted by {room.host?.username || getHostName(room)}</p>
                            {room.host?._id === currentUserId && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                                <span>Room ID: {room.roomId || room._id}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyRoomId(room.roomId || room._id)}
                                  className="font-semibold text-cyan-200 hover:text-cyan-100"
                                >
                                  Copy ID
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              to={`/rooms/${room._id}/chat`}
                              state={{ roomName: room.name }}
                              className="cursor-pointer rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20"
                            >
                              Open
                            </Link>
                            <button
                              onClick={() => handleLeave(room)}
                              className="cursor-pointer rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-rose-500/20 hover:shadow-lg hover:shadow-rose-500/10"
                            >
                              Leave
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-slate-300">Available rooms</h3>
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-6 text-slate-300">Loading rooms…</div>
                ) : rooms.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-6 text-slate-300">
                    No rooms available right now.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rooms.map((room) => (
                      <div key={room._id} className="room-row-surface rounded-2xl border border-white/10 bg-[#f5f1e9] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-lg font-semibold text-white">{room.name}</span>
                              {room.isPrivate && (
                                <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100">
                                  Private
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-300">Hosted by {room.host?.username || 'Unknown'}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {room.participants?.length || 0} / {room.maxParticipants} participants
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {isParticipant(room) ? (
                              <button
                                onClick={() => handleLeave(room)}
                                className="cursor-pointer rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-rose-500/20 hover:shadow-lg hover:shadow-rose-500/10"
                              >
                                Leave
                              </button>
                            ) : (
                              <button
                                onClick={() => handleJoin(room)}
                                className="cursor-pointer rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20"
                              >
                                Join
                              </button>
                            )}
                            {hostRoomIds.has(room._id) && (
                              <button
                                onClick={() => handleDelete(room._id)}
                                className="cursor-pointer rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-rose-500/20 hover:shadow-lg hover:shadow-rose-500/10"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {room.isPrivate && activeJoinId === room._id && (
                          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                            <FormInput
                              label="Room Password"
                              type="password"
                              id={`private-password-${room._id}`}
                              name={room._id}
                              value={joinPassword[room._id] || ''}
                              onChange={(e) => setJoinPassword((prev) => ({ ...prev, [room._id]: e.target.value }))}
                              placeholder="Enter room password"
                              required
                            />
                            <button
                              onClick={() => handleJoin(room)}
                              className="w-full cursor-pointer rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20"
                            >
                              Submit Password
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="rounded-[30px] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-6">
            <div className="mb-5">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-cyan-300/70">Create</p>
              <h2 className="text-2xl font-semibold text-white">New Room</h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <FormInput
                label="Room Name"
                type="text"
                id="name"
                name="name"
                value={createForm.name}
                onChange={handleCreateChange}
                placeholder="Enter room name"
                required
              />

              <FormInput
                label="Password (optional)"
                type="password"
                id="password"
                name="password"
                value={createForm.password}
                onChange={handleCreateChange}
                placeholder="Private room password"
              />

              <div>
                <label htmlFor="maxParticipants" className="mb-2 block text-sm font-medium text-slate-200">
                  Max Participants
                </label>
                <input
                  type="number"
                  id="maxParticipants"
                  name="maxParticipants"
                  min="2"
                  max="20"
                  value={createForm.maxParticipants}
                  onChange={handleCreateChange}
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full cursor-pointer rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? 'Creating room…' : 'Create Room'}
              </button>
            </form>

            <p className="mt-4 text-sm text-slate-400">
              Public rooms are visible to everyone. Add a password to keep a room private.
            </p>
          </aside>
        </div>
      </div>
      <JoinRoomDialog
        open={joinDialogOpen}
        onClose={() => setJoinDialogOpen(false)}
        onSubmit={handleJoinById}
        loading={joiningById}
      />
    </div>
  );
};

export default Dashboard;
