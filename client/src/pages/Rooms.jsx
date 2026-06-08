import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { tokenStorage } from '../utils/tokenStorage';
import FormInput from '../components/FormInput';

const Rooms = () => {
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
      const response = await api.get('/rooms');
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
      const joinResponse = await api.post(`/rooms/join/${createdRoom._id}`, {
        password: createForm.password || undefined,
      });

      const joinedRoom = joinResponse.data.room;
      if (joinedRoom.isPrivate || !rooms.some((item) => item._id === joinedRoom._id)) {
        setExtraActiveRooms((prev) => {
          if (prev.some((room) => room._id === joinedRoom._id)) return prev;
          return [...prev, joinedRoom];
        });
      }

      setSuccess(`Room created and entered successfully`);
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
      const response = await api.post(`/rooms/join/${room._id}`, {
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

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-serif text-amber-900">Rooms</h1>
            <p className="text-amber-700">Create or join public rooms and manage your own hosted rooms.</p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-md bg-white px-4 py-2 text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">{success}</div>
        )}

        <div className="rounded-xl border border-amber-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-amber-900 mb-4">Active Room Session</h2>
          {activeRooms.length === 0 ? (
            <p className="text-amber-700">You are not currently in any active room. Create or join a room to start a session.</p>
          ) : (
            <div className="space-y-4">
              {activeRooms.map((room) => (
                <div key={room._id} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-lg font-semibold text-amber-900">
                        <span>{room.name}</span>
                        {room.isPrivate && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                            Private
                          </span>
                        )}
                      </div>
                      <p className="text-amber-700">Hosted by {getHostName(room)}</p>
                      <p className="text-sm text-amber-700">
                        Participants: {room.participants?.length || 0} / {room.maxParticipants}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLeave(room)}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                      Leave Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-xl border border-amber-200 bg-white/90 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-amber-900 mb-4">Available Rooms</h2>
            {loading ? (
              <div className="text-amber-700">Loading rooms…</div>
            ) : rooms.length === 0 ? (
              <div className="text-amber-700">No rooms found yet. Create one to get started.</div>
            ) : (
              <div className="space-y-4">
                {rooms.map((room) => (
                  <div key={room._id} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-lg font-semibold text-amber-900">
                          <span>{room.name}</span>
                          {room.isPrivate && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                              Private
                            </span>
                          )}
                        </div>
                        <p className="text-amber-700">Hosted by {room.host?.username || 'Unknown'}</p>
                        <p className="text-sm text-amber-700">
                          Participants: {room.participants?.length || 0} / {room.maxParticipants}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {isParticipant(room) ? (
                          <button
                            onClick={() => handleLeave(room)}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                          >
                            Leave
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoin(room)}
                            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                          >
                            Join
                          </button>
                        )}
                        {hostRoomIds.has(room._id) && (
                          <button
                            onClick={() => handleDelete(room._id)}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
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
                          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
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

          <div className="rounded-xl border border-amber-200 bg-white/90 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-amber-900 mb-4">Create a Room</h2>
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
                <label htmlFor="maxParticipants" className="block text-sm font-medium text-amber-800 mb-2">
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
                  className="w-full rounded-md border border-amber-300 bg-amber-50/50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-md bg-amber-600 px-4 py-3 text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? 'Creating room…' : 'Create Room'}
              </button>
            </form>
            <p className="mt-4 text-sm text-amber-700">
              Rooms are protected by password only if you set one. Public rooms are discoverable and joinable by anyone with access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rooms;
