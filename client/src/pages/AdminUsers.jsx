import { useEffect, useState } from 'react';
import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchUsers = async (p = 1) => {
    try {
      const token = tokenStorage.getToken();
      const res = await axios.get(`http://localhost:8000/admin/users?page=${p}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data.data.users || []);
      setTotal(res.data.data.total || 0);
      setPage(p);
    } catch (e) {
      console.error('Failed to fetch users', e);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, []);

  const toggleActive = async (id, isActive) => {
    try {
      const token = tokenStorage.getToken();
      await axios.patch(
        `http://localhost:8000/admin/users/${id}/status`,
        { isActive },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      fetchUsers(page);
    } catch (e) {
      console.error('Failed to update status', e);
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user permanently?')) return;
    try {
      const token = tokenStorage.getToken();
      await axios.delete(`http://localhost:8000/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers(page);
    } catch (e) {
      console.error('Failed to delete user', e);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm border border-amber-200 rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-serif text-amber-900 mb-2">User Management</h1>
          <p className="text-amber-700 mb-4">View, activate/deactivate, and delete users.</p>

          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left text-amber-800">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-t">
                    <td className="py-3">{u.name || '—'}</td>
                    <td className="py-3">{u.email}</td>
                    <td className="py-3">{u.role}</td>
                    <td className="py-3">{u.isActive ? 'Active' : 'Disabled'}</td>
                    <td className="py-3 space-x-2">
                      <button
                        onClick={() => toggleActive(u._id, !u.isActive)}
                        className="bg-amber-500 hover:bg-amber-600 text-white py-1 px-3 rounded"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteUser(u._id)}
                        className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-amber-700">Total users: {total}</div>
            <div className="space-x-2">
              <button
                onClick={() => fetchUsers(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-2">{page} / {pages}</span>
              <button
                onClick={() => fetchUsers(Math.min(pages, page + 1))}
                disabled={page >= pages}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
