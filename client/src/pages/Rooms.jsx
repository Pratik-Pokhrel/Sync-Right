import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { tokenStorage } from '../utils/tokenStorage';
import FormInput from '../components/FormInput';
import JoinRoomDialog from '../components/JoinRoomDialog';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [joinPassword, setJoinPassword] = useState({});
  const [activeJoinId, setActiveJoinId] = useState(null);
  const [extraActiveRooms, setExtraActiveRooms] = useState([]);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joiningById, setJoiningById] = useState(false);

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

  const fetchRooms = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/rooms/mine');
      setRooms(response.data.rooms || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

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
          if (prev.some((room) => room._id === joinedRoom._id)) return prev;
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

  const hostRoomIds = useMemo(() => {
    return new Set(rooms.filter((room) => room.host?._id === currentUser?.id).map((room) => room._id));
  }, [rooms, currentUser]);

  const myRooms = useMemo(() => {
    const ownedRooms = [
      ...rooms.filter((room) => room.host?._id === currentUserId),
      ...extraActiveRooms.filter((room) => room.host?._id === currentUserId),
    ];
    const seen = new Set();
    return ownedRooms.filter((room) => {
      if (seen.has(room._id)) return false;
      seen.add(room._id);
      return true;
    });
  }, [rooms, extraActiveRooms, currentUserId]);

  return (
    <div className="rooms-page min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_20%)]" />

      <div className="relative z-10 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-300/70 mb-2">Workspace</p>
              <h1 className="text-3xl font-semibold text-white">My Rooms</h1>
              <p className="text-slate-300">Your public and private rooms, with an ID ready to share.</p>
            </div>
            <Link
              to="/dashboard"
              className="rooms-back-link inline-flex items-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
            >
              ← Back to Dashboard
            </Link>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-rose-100">{error}</div>
          )}
          {success && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">{success}</div>
          )}

          <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-white mb-6">Active Room Session</h2>
              {activeRooms.length === 0 ? (
                <p className="text-slate-300">You are not currently in any active room. Create or join a room to start a session.</p>
              ) : (
                <div className="space-y-4">
                  {activeRooms.map((room) => (
                    <div key={room._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                            <span>{room.name}</span>
                            {room.isPrivate && (
                              <span className="rounded-full bg-violet-500/20 border border-violet-400/50 px-2 py-1 text-xs font-semibold text-violet-100">
                                Private
                              </span>
                            )}
                          </div>
                          <p className="text-slate-300 mb-2">Hosted by {room.host?.username || getHostName(room)}</p>
                          {room.host?._id === currentUserId && (
                            <p className="mb-2 text-xs text-slate-400">Room ID: {room.roomId || room._id}</p>
                          )}
                          <p className="text-sm text-slate-300 mb-2">
                            Participants: {room.participants?.length || 0} / {room.maxParticipants}
                          </p>
                          {room.participants && room.participants.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {room.participants.map((participant) => (
                                <span
                                  key={participant._id}
                                  className="inline-block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100"
                                >
                                  {participant.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Link
                            to={`/rooms/${room._id}/chat`}
                            state={{ roomName: room.name }}
                            className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                          >
                            Open Chat
                          </Link>
                          <button
                            onClick={() => handleLeave(room)}
                            className="rounded-2xl bg-rose-500/20 border border-rose-400/50 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
                          >
                            Leave Room
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        <div className="rooms-list-panel relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-white mb-6">Rooms you host</h2>
              {loading ? (
                <div className="text-slate-300">Loading rooms…</div>
              ) : myRooms.length === 0 ? (
                <div className="text-slate-300">You have not created any rooms yet.</div>
              ) : (
                <div className="space-y-4">
                  {myRooms.map((room) => (
                    <div key={room._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                            <span>{room.name}</span>
                            {room.isPrivate && (
                              <span className="rounded-full bg-violet-500/20 border border-violet-400/50 px-2 py-1 text-xs font-semibold text-violet-100">
                                Private
                              </span>
                            )}
                          </div>
                          <p className="text-slate-300 mb-2">Hosted by {room.host?.username || 'Unknown'}</p>
                          <p className="text-xs text-slate-400">Room ID: {room.roomId || room._id}</p>
                          <p className="text-sm text-slate-300 mb-2">
                            Participants: {room.participants?.length || 0} / {room.maxParticipants}
                          </p>
                          {room.participants && room.participants.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {room.participants.map((participant) => (
                                <span
                                  key={participant._id}
                                  className="inline-block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100"
                                >
                                  {participant.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:ml-4">
                          {isParticipant(room) ? (
                            <button
                              onClick={() => handleLeave(room)}
                              className="rounded-2xl bg-rose-500/20 border border-rose-400/50 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
                            >
                              Leave
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoin(room)}
                              className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                            >
                              Join
                            </button>
                          )}
                          {hostRoomIds.has(room._id) && (
                            <button
                              onClick={() => handleDelete(room._id)}
                              className="rounded-2xl bg-rose-500/20 border border-rose-400/50 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {room.isPrivate && activeJoinId === room._id && (
                        <div className="mt-4 space-y-3">
                          <FormInput
                            label="Room Password"
                            type="password"
                            id={`private-password-${room._id}`}
                            name={room._id}
                            value={joinPassword[room._id] || ''}
                            onChange={(e) =>
                              setJoinPassword((prev) => ({ ...prev, [room._id]: e.target.value }))
                            }
                            placeholder="Enter room password"
                            required
                          />
                          <button
                            onClick={() => handleJoin(room)}
                            className="w-full rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
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

export default Rooms;
