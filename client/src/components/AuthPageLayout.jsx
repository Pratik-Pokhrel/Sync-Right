const AuthPageLayout = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -right-32 top-[25%] h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_20%)]" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl">
          <div className="relative overflow-hidden rounded-4xl border border-white/20 bg-white/10 shadow-[0_40px_120px_rgba(15,23,42,0.3)] backdrop-blur-3xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.10),transparent_22%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_35%,rgba(255,255,255,0.02)_70%,rgba(255,255,255,0.00)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_0%,transparent_20%,transparent_80%,rgba(255,255,255,0.06)_100%)]" />
            <div className="relative grid gap-0 lg:grid-cols-[1.05fr_1.35fr]">
              <div className="hidden lg:flex flex-col justify-between rounded-l-4xl border-r border-white/12 bg-slate-950/30 p-12 text-white backdrop-blur-2xl">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-300/70">Sync-Right</p>
                  <h2 className="mt-6 text-4xl font-semibold leading-tight">Secure team collaboration</h2>
                  <p className="mt-4 max-w-sm text-slate-300">Connect with your workspace, manage rooms, and chat securely with a polished interface built for teams.</p>
                </div>
                <div className="mt-8 space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-[0_24px_70px_-32px_rgba(255,255,255,0.4)]">
                    <p className="text-sm text-slate-300">Enjoy a fast login experience with soft glassmorphism and thoughtful spacing.</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-[0_24px_70px_-32px_rgba(255,255,255,0.3)]">
                    <p className="text-sm text-slate-300">Your credentials stay secure, and your session stays seamless.</p>
                  </div>
                </div>
              </div>
              <div className="p-8 sm:p-10 lg:p-12">
                <div className="mb-8 space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300/80">Welcome</p>
                  <h1 className="text-3xl font-semibold text-white">{title}</h1>
                  <p className="text-sm text-slate-300">{subtitle}</p>
                </div>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPageLayout;
