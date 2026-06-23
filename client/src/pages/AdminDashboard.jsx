import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_20%)]" />

      <div className="relative z-10 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/10 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_30%,rgba(255,255,255,0.03)_60%,transparent_100%)]" />
            <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-center gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-300/70 mb-2">Administration</p>
                  <h1 className="text-3xl font-semibold text-white mb-2">Admin Panel</h1>
                  <p className="text-slate-300">Manage users and system settings</p>
                </div>
                <div className="flex gap-3 flex-wrap justify-end">
                  <Link to="/admin/users" className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400">User Management</Link>
                  <Link to="/dashboard" className="rounded-2xl bg-slate-700/50 border border-white/20 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700/70">Back</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
