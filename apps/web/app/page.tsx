export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <nav className="mb-12 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight">FinTrade Secure</div>
          <div className="flex gap-4 text-sm text-slate-300">
            <span>Portfolio</span>
            <span>Investments</span>
            <span>Admin</span>
          </div>
        </nav>

        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.2em] text-cyan-300">Secure fintech platform</p>
            <h1 className="text-5xl font-bold tracking-tight text-white">
              A professional, auditable capital management platform.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Built for account onboarding, KYC, wallet operations, investment allocation, trading performance tracking,
              withdrawal workflows, and admin oversight with strong financial integrity controls.
            </p>
            <div className="mt-8 flex gap-4">
              <button className="rounded-lg bg-cyan-500 px-5 py-3 font-medium text-slate-950">Open Dashboard</button>
              <button className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 font-medium text-slate-100">View API</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-cyan-950/20">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Portfolio overview</h2>
              <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">Demo</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Deposited', '$125,000'],
                ['Invested', '$88,400'],
                ['Current value', '$95,200'],
                ['Withdrawable', '$12,100'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            ['Account Security', 'MFA, RBAC, rate limits, secure session handling.'],
            ['Financial Integrity', 'All balance changes flow through auditable ledger entries.'],
            ['Configurable Strategies', 'Target return language is configurable and not disguised as guaranteed yield.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="mb-3 text-xl font-semibold text-white">{title}</h3>
              <p className="text-slate-300">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
