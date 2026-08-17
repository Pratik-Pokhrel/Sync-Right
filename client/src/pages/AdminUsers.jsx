import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import { tokenStorage } from '../utils/tokenStorage';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchUsers = async (p = 1) => {
    try {
      const token = tokenStorage.getToken();
      const res = await axios.get(`${API_BASE_URL}/admin/users?page=${p}&limit=${limit}`, {
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
        `${API_BASE_URL}/admin/users/${id}/status`,
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
      await axios.delete(`${API_BASE_URL}/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers(page);
    } catch (e) {
      console.error('Failed to delete user', e);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_20%)]" />

      <div className="relative z-10 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="relative z-10">
              <h1 className="text-2xl font-semibold text-white mb-2">User Management</h1>
              <p className="text-slate-300 mb-6">View, activate/deactivate, and delete users.</p>

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-slate-200">
                      <th className="px-6 py-3 font-semibold">Name</th>
                      <th className="px-6 py-3 font-semibold">Email</th>
                      <th className="px-6 py-3 font-semibold">Role</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id} className="border-t border-white/10 hover:bg-white/5 transition">
                        <td className="px-6 py-3 text-slate-300">{u.name || '—'}</td>
                        <td className="px-6 py-3 text-slate-300">{u.email}</td>
                        <td className="px-6 py-3">
                          <span className="inline-block rounded-full bg-violet-500/20 border border-violet-400/50 px-3 py-1 text-xs font-medium text-violet-100">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                            u.isActive
                              ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-100'
                              : 'bg-rose-500/20 border border-rose-400/50 text-rose-100'
                          }`}>
                            {u.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-3 space-x-2">
                          <button
                            onClick={() => toggleActive(u._id, !u.isActive)}
                            className="rounded-lg bg-cyan-500/20 border border-cyan-400/50 px-3 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/30"
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteUser(u._id)}
                            className="rounded-lg bg-rose-500/20 border border-rose-400/50 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-500/30"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="text-slate-300">Total users: {total}</div>
                <div className="space-x-2 flex items-center">
                  <button
                    onClick={() => fetchUsers(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="px-4 py-2 text-slate-300 font-medium">{page} / {pages}</span>
                  <button
                    onClick={() => fetchUsers(Math.min(pages, page + 1))}
                    disabled={page >= pages}
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
