import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../utils/socket';
import { tokenStorage } from '../utils/tokenStorage';

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = tokenStorage.getToken();
    if (token) {
      connectSocket(token);
    }
  }, []);

  const handleLogout = () => {
    disconnectSocket();
    tokenStorage.removeToken();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm border border-amber-200 rounded-lg shadow-lg p-8 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-serif text-amber-900 mb-2">Welcome to Sync-Right</h1>
              <p className="text-amber-700">You are successfully logged in</p>
            </div>
            <div className="space-x-2">
              <Link
                to="/rooms"
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md"
              >
                Rooms
              </Link>
              {(() => {
                const user = tokenStorage.getUser();
                if (user && user.role === 'admin') {
                  return (
                    <Link to="/admin" className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md">
                      Admin Panel
                    </Link>
                  );
                }
                return null;
              })()}

              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-amber-200 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-serif text-amber-900 mb-4">Features</h2>
          <ul className="space-y-2 text-amber-700">
            <li>• Real-time Chat</li>
            <li>• WebRTC Video/Audio</li>
            <li>• Collaborative Whiteboard</li>
            <li>• Multiple Chat Rooms</li>
            <li>• Admin Management</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
