import { useEffect, useState } from 'react';

const JoinRoomDialog = ({ open, onClose, onSubmit, loading = false }) => {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) {
      setRoomId('');
      setPassword('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return;
    await onSubmit(trimmedRoomId, password);
  };

  return (
    <div className="join-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="join-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-room-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="join-dialog-header">
          <div>
            <p className="eyebrow">Enter an invitation</p>
            <h2 id="join-room-title">Join a room</h2>
            <p>Use the room ID shared by the host. A password is only needed for private rooms.</p>
          </div>
          <button type="button" className="join-dialog-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="join-dialog-form">
          <div>
            <label htmlFor="join-room-id" className="form-label">Room ID</label>
            <input
              id="join-room-id"
              className="form-input"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="Paste the room ID"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="join-room-password" className="form-label">Password (optional)</label>
            <input
              id="join-room-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Private room password"
            />
          </div>
          <div className="join-dialog-actions">
            <button type="button" className="join-dialog-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="join-dialog-submit" disabled={loading}>
              {loading ? 'Joining…' : 'Join room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinRoomDialog;
