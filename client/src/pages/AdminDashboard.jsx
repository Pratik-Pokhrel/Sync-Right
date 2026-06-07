import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm border border-amber-200 rounded-lg shadow-lg p-8 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-serif text-amber-900 mb-2">Admin Panel</h1>
              <p className="text-amber-700">Manage users and system settings</p>
            </div>
            <div className="space-x-2">
              <Link to="/admin/users" className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded">User Management</Link>
              <Link to="/dashboard" className="bg-gray-200 hover:bg-gray-300 text-amber-800 py-2 px-4 rounded">Back</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
