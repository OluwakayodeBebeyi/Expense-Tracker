import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, BarChart3, Banknote, BadgeCheck, CreditCard, FileText, LogIn, LogOut, Settings, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { buildEmptyFinancialSummary, formatCurrency } from './lib/finance';

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const emptySummary = buildEmptyFinancialSummary();

const summary = [
  { label: 'Total Income', value: formatCurrency(emptySummary.totalIncome), icon: TrendingUp, tone: 'blue' },
  { label: 'Total Expenditure', value: formatCurrency(emptySummary.totalExpenditure), icon: CreditCard, tone: 'slate' },
  { label: 'Current Balance', value: formatCurrency(emptySummary.currentBalance), icon: Banknote, tone: 'emerald' },
  { label: 'Transactions', value: String(emptySummary.transactionCount), icon: BarChart3, tone: 'amber' },
];

const quickStats = [
  { title: 'Today Income', value: formatCurrency(emptySummary.todayIncome) },
  { title: 'Today Expenditure', value: formatCurrency(emptySummary.todayExpenditure) },
  { title: 'Current Month Balance', value: formatCurrency(emptySummary.currentMonthBalance) },
  { title: 'Financial Year Income', value: formatCurrency(emptySummary.financialYearIncome) },
];

const menu = [
  { label: 'Dashboard', icon: BarChart3 },
  { label: 'Transactions', icon: FileText },
  { label: 'Reports', icon: FileText },
  { label: 'Accounts', icon: Banknote },
  { label: 'Users & Roles', icon: Users },
  { label: 'Settings', icon: Settings },
  { label: 'Security', icon: ShieldCheck },
];

const landingFeatures = [
  { title: 'Smart budget monitoring', description: 'Track income, expenditure and balances in real time.', icon: TrendingUp },
  { title: 'Secure school finance', description: 'Keep all approvals, records and audit trails organized.', icon: ShieldCheck },
  { title: 'Easy reporting', description: 'Generate clean summaries for school leadership and parents.', icon: FileText },
];

function ProtectedRoute({ user, isLoading, children }: { user: SessionUser | null; isLoading: boolean; children: ReactNode }) {
  const location = useLocation();

  if (isLoading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">Checking your session…</main>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message ?? 'Sign in failed. Check your details and try again.');
      }

      onAuthenticated(result.user as SessionUser);
      const returnTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(returnTo ?? '/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
      <section className="relative hidden overflow-hidden bg-blue-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-15" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(135deg, transparent 0 48%, rgba(255,255,255,.18) 48% 49%, transparent 49%), linear-gradient(45deg, transparent 0 48%, rgba(255,255,255,.12) 48% 49%, transparent 49%)', backgroundSize: '64px 64px' }} />
        <Link to="/" className="relative z-10 flex w-fit items-center gap-3 text-white">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-white font-bold text-blue-800">SF</span>
          <span>
            <span className="block text-xs uppercase tracking-[0.18em] text-blue-100">School</span>
            <span className="block text-lg font-semibold">Finance Portal</span>
          </span>
        </Link>
        <div className="relative z-10 max-w-xl pb-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-blue-200">School financial management</p>
          <h1 className="text-4xl font-bold leading-tight">Clear records. Confident decisions.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-blue-100">Sign in to access your school’s financial records, reporting and account controls.</p>
          <div className="mt-8 h-1 w-16 rounded-full bg-red-400" />
        </div>
        <p className="relative z-10 text-sm text-blue-200">Secure access for authorized school personnel</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-12 inline-flex items-center gap-3 text-slate-900 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-700 font-bold text-white">SF</span>
            <span className="font-semibold">School Finance Portal</span>
          </Link>
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Administrator access</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-600">Sign in with your school account to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-slate-800">Email address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                placeholder="name@school.edu"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-slate-800">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                placeholder="Enter your password"
              />
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={17} />
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-xs leading-5 text-slate-500">Access is limited to active accounts authorized by your school administrator.</p>
          <div className="mt-10 border-t border-slate-200 pt-5">
            <Link to="/" className="text-sm font-medium text-blue-700 hover:text-blue-900">Back to home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 font-bold text-white">SF</div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-blue-200">School</p>
            <p className="text-lg font-semibold text-white">Finance Portal</p>
          </div>
        </div>

        <nav className="hidden items-center gap-8 text-sm text-slate-200 md:flex">
          <a href="#features" className="transition hover:text-white">Features</a>
          <a href="#benefits" className="transition hover:text-white">Benefits</a>
          <a href="#contact" className="transition hover:text-white">Contact</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-500">
            Open dashboard
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-20 pt-8 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
              <BadgeCheck size={14} />
              Trusted by school administrators
            </div>

            <h1 className="max-w-xl text-4xl font-black tracking-tight text-white md:text-6xl">
              Smart school finance management
            </h1>

            <p className="mt-6 max-w-lg text-lg text-slate-300">
              Manage school income, payments, cash flow and financial reporting from one secure dashboard built for modern education institutions.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400">
                Get started
                <ArrowRight size={18} />
              </Link>
              <a href="#features" className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-100 transition hover:border-slate-500">
                Explore features
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-8 text-sm text-slate-300">
              <div>
                <p className="text-2xl font-bold text-white">₦0.00</p>
                <p>Annual income</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">0</p>
                <p>Transactions</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">24/7</p>
                <p>Monitoring</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-blue-950/50">
            <div className="rounded-2xl bg-slate-950 p-5">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-300">School financial overview</p>
                <span className="rounded-full bg-rose-500/15 px-2 py-1 text-xs font-medium text-rose-300">No records</span>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Current balance</p>
                  <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(emptySummary.currentBalance)}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Income</p>
                    <p className="mt-2 text-xl font-semibold text-blue-300">{formatCurrency(emptySummary.totalIncome)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Expenditure</p>
                    <p className="mt-2 text-xl font-semibold text-rose-300">{formatCurrency(emptySummary.totalExpenditure)}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Budget health</span>
                    <span className="font-semibold text-slate-400">No activity</span>
                  </div>
                  <p className="text-sm text-slate-400">Financial summaries will appear after transactions are recorded.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">Features</p>
            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Everything your finance office needs</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {landingFeatures.map(({ title, description, icon: Icon }) => (
              <div key={title} className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                  <Icon size={22} />
                </div>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="mt-3 text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="benefits" className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
          <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-600/20 to-slate-900 p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Why schools choose us</p>
                <h3 className="mt-3 text-2xl font-bold text-white md:text-3xl">Build stronger financial oversight without the admin overhead.</h3>
              </div>
              <Link to="/dashboard" className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-200">
                View dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-slate-800 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-400 md:flex-row lg:px-8">
          <p>© 2026 School Finance Portal</p>
          <p>support@school-portal.edu</p>
        </div>
      </footer>
    </div>
  );
}

function DashboardPage({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <aside className="fixed inset-y-0 left-0 w-72 border-r border-slate-200 bg-white p-5">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">SF</div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">School</p>
            <h1 className="text-lg font-bold text-slate-900">Finance Portal</h1>
          </div>
        </div>

        <nav className="space-y-2">
          {menu.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">System Status</p>
          <p className="mt-2 text-sm text-slate-700">No financial records yet. Create the first transaction to begin tracking school finances.</p>
        </div>
      </aside>

      <main className="ml-72 p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Financial Overview</p>
            <h2 className="mt-1 text-3xl font-bold text-slate-900">School Financial Management Dashboard</h2>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-2 shadow-soft">
            <div className="rounded-full bg-blue-100 p-2 text-blue-600">
              <LogIn size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Logged in as</p>
              <p className="font-semibold text-slate-800">{user.name} · {user.role}</p>
            </div>
            <button onClick={onLogout} type="button" title="Sign out" aria-label="Sign out" className="ml-2 rounded-lg p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-blue-600">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div className={`rounded-lg p-2 ${tone === 'blue' ? 'bg-blue-100 text-blue-600' : tone === 'slate' ? 'bg-slate-100 text-slate-600' : tone === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  <Icon size={20} />
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Live</span>
              </div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <p className="text-sm text-slate-500">{item.title}</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-900">Income vs Expenditure</h3>
            <div className="mt-6 h-64 rounded-xl bg-slate-50 p-4">
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No monthly transactions to chart yet.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-900">Expenditure by Category</h3>
            <div className="mt-6 flex min-h-48 items-center justify-center text-sm text-slate-500">
              No expenditure categories to display yet.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (isMounted) setUser(result?.user ?? null);
      })
      .catch(() => {
        if (isMounted) setUser(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSession(false);
      });

    return () => { isMounted = false; };
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      setUser(null);
      navigate('/login', { replace: true });
    }
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage onAuthenticated={setUser} />} />
      <Route path="/dashboard" element={<ProtectedRoute user={user} isLoading={isLoadingSession}><DashboardPage user={user!} onLogout={handleLogout} /></ProtectedRoute>} />
    </Routes>
  );
}
