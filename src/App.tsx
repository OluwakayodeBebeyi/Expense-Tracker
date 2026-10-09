import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { ArrowRight, BarChart3, BadgeCheck, FileText, KeyRound, LogIn, LogOut, Search, ShieldCheck, TrendingUp, UserPlus, Users } from 'lucide-react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { formatCurrency } from './lib/finance';

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin?: boolean;
  permissions: string[];
}

const menu = [
  { label: 'Dashboard', icon: BarChart3 },
];

function scrollToSection(event: MouseEvent<HTMLAnchorElement>, sectionId: string) {
  event.preventDefault();
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
}

const landingFeatures = [
  { title: 'Live dashboard totals', description: 'Review approved income, expenditure and balances from your database.', icon: TrendingUp },
  { title: 'Protected account access', description: 'Sign in with an administrator-created account and an expiring session.', icon: ShieldCheck },
  { title: 'School finance overview', description: 'See transaction totals and current balances in one place.', icon: FileText },
];

interface DashboardSummary {
  totalIncome: number;
  totalExpenditure: number;
  currentBalance: number;
  transactionCount: number;
}

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
                maxLength={72}
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

          <p className="mt-5 text-sm text-slate-600">Have a reset token from your administrator? <Link to="/reset-password" className="font-semibold text-blue-700 hover:underline">Reset your password</Link></p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Access is limited to active accounts authorized by your school administrator.</p>
          <div className="mt-10 border-t border-slate-200 pt-5">
            <Link to="/" className="text-sm font-medium text-blue-700 hover:text-blue-900">Back to home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function PasswordResetPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try {
      const response = await fetch('/api/auth/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ token, password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? 'Password reset failed.');
      setComplete(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Password reset failed.'); }
  }
  return <main className="grid min-h-screen place-items-center bg-slate-100 px-4"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-7 shadow-soft"><Link to="/login" className="text-sm font-semibold text-blue-700">← Sign in</Link><h1 className="text-2xl font-bold">Set a new password</h1><p className="text-sm text-slate-600">Use the one-time token supplied by your administrator. The token expires after 30 minutes.</p><label className="block text-sm font-medium">Reset token<input required autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="block text-sm font-medium">New password<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{complete && <p role="status" className="text-sm text-emerald-700">Password changed. Redirecting to sign in…</p>}<button disabled={complete} className="w-full rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">Change password</button></form></main>;
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
              <a href="#features" onClick={(event) => scrollToSection(event, 'features')} className="transition hover:text-white">Features</a>
              <a href="#benefits" onClick={(event) => scrollToSection(event, 'benefits')} className="transition hover:text-white">Benefits</a>
              <a href="#contact" onClick={(event) => scrollToSection(event, 'contact')} className="transition hover:text-white">Contact</a>
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
              Secure administrator access
            </div>

            <h1 className="max-w-xl text-4xl font-black tracking-tight text-white md:text-6xl">
              Smart school finance management
            </h1>

            <p className="mt-6 max-w-lg text-lg text-slate-300">
              Review approved income, expenditure and balances from one secure dashboard. Transaction entry and detailed reporting tools are not available yet.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-400">
                Get started
                <ArrowRight size={18} />
              </Link>
              <a href="#features" onClick={(event) => scrollToSection(event, 'features')} className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-100 transition hover:border-slate-500">
                Explore features
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-8 text-sm text-slate-300">
              <p>Session protected</p>
              <p>Database backed</p>
              <p>Administrator managed</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-blue-950/50">
            <div className="rounded-2xl bg-slate-950 p-5">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-300">School financial overview</p>
                <span className="rounded-full bg-blue-500/15 px-2 py-1 text-xs font-medium text-blue-200">Sign in to view</span>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Current balance</p>
                  <p className="mt-2 text-sm font-medium text-white">Your current balance appears in the dashboard after sign in.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Income</p>
                    <p className="mt-2 text-sm font-semibold text-blue-300">Available after sign in</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Expenditure</p>
                    <p className="mt-2 text-sm font-semibold text-rose-300">Available after sign in</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Budget health</span>
                    <span className="font-semibold text-slate-400">No activity</span>
                  </div>
                  <p className="text-sm text-slate-400">The dashboard shows totals for approved transactions stored by your school.</p>
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
          <p>© {new Date().getFullYear()} School Finance Portal</p>
          <p>Portal for authorized school personnel</p>
        </div>
      </footer>
    </div>
  );
}

function DashboardPage({ user, onLogout, onSessionExpired }: { user: SessionUser; onLogout: () => Promise<boolean>; onSessionExpired: () => void }) {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [dashboardError, setDashboardError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/dashboard', { credentials: 'same-origin' })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) {
          if (isMounted) onSessionExpired();
          throw new Error('Your session has expired. Please sign in again.');
        }
        if (!response.ok) throw new Error(result.message ?? 'Dashboard data could not be loaded.');
        return result as { summary: DashboardSummary };
      })
      .then((result) => { if (isMounted) setDashboard(result.summary); })
      .catch((error: unknown) => {
        if (isMounted) setDashboardError(error instanceof Error ? error.message : 'Dashboard data could not be loaded.');
      })
      .finally(() => { if (isMounted) setIsLoadingDashboard(false); });

    return () => { isMounted = false; };
  }, [onSessionExpired]);

  const dashboardCards = [
    { label: 'Total Income', value: dashboard ? formatCurrency(dashboard.totalIncome) : '—', icon: TrendingUp, tone: 'blue' },
    { label: 'Total Expenditure', value: dashboard ? formatCurrency(dashboard.totalExpenditure) : '—', icon: FileText, tone: 'slate' },
    { label: 'Current Balance', value: dashboard ? formatCurrency(dashboard.currentBalance) : '—', icon: BarChart3, tone: 'emerald' },
    { label: 'Approved Transactions', value: dashboard ? String(dashboard.transactionCount) : '—', icon: BadgeCheck, tone: 'amber' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <aside className="hidden border-r border-slate-200 bg-white p-5 lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-72">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">SF</div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">School</p>
            <h1 className="text-lg font-bold text-slate-900">Finance Portal</h1>
          </div>
        </div>

        <nav className="space-y-2">
          {menu.map(({ label, icon: Icon }) => (
            <Link
              to="/dashboard"
              aria-current="page"
              key={label}
              className="flex w-full items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          {(user.permissions.includes('users.view') || user.permissions.includes('roles.view') || user.permissions.includes('accounts.view') || user.permissions.includes('categories.view') || user.permissions.includes('payment_methods.view')) && (
            <Link to="/admin" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              <Users size={16} /> User & access management
            </Link>
          )}
        </nav>

        <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Available module</p>
          <p className="mt-2 text-sm text-slate-700">Dashboard summaries are available. Transaction entry and reports are not implemented yet.</p>
        </div>
      </aside>

      <main className="p-4 sm:p-8 lg:ml-72">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <button onClick={async () => { setLogoutError(''); if (!(await onLogout())) setLogoutError('Could not sign out. Check your connection and try again.'); }} type="button" title="Sign out" aria-label="Sign out" className="ml-2 rounded-lg p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-blue-600">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {logoutError && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{logoutError}</p>}
        {dashboardError && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dashboardError}</p>}
        {isLoadingDashboard && <p role="status" className="mb-5 text-sm text-slate-500">Loading dashboard totals…</p>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardCards.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div className={`rounded-lg p-2 ${tone === 'blue' ? 'bg-blue-100 text-blue-600' : tone === 'slate' ? 'bg-slate-100 text-slate-600' : tone === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  <Icon size={20} />
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-400">{dashboard ? 'Live' : '—'}</span>
              </div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-lg font-semibold text-slate-900">Reports</h3>
          <p className="mt-2 text-sm text-slate-600">Monthly charts and category reports are not available yet.</p>
        </section>
      </main>
    </div>
  );
}

interface AdminPermission { key: string; module: string; name: string; description: string; sensitive: boolean }
interface AdminRole { id: string; name: string; description: string; accessLevel: number; status: string; isSystem: boolean; grants: { permission: AdminPermission }[]; _count: { users: number } }
interface AdminUser { id: string; name: string; email: string; status: string; roleId: string; isSuperAdmin?: boolean; role: { name: string; accessLevel: number } }
interface EffectivePermissions { role: string; effectivePermissions: string[]; overrides: { permission: string; granted: boolean }[] }
interface SetupAccount { id: string; name: string; type: string; currentBalance: string; status: string }
interface SetupCategory { id: string; name: string; type: string; status: string }
interface SetupPaymentMethod { id: string; name: string; status: string }

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin${path}`, { credentials: 'same-origin', ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message ?? 'Administrative request failed.');
  return result as T;
}

function AdminPage({ user }: { user: SessionUser }) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [overview, setOverview] = useState<{ totalUsers: number; activeUsers: number; suspendedUsers: number; totalRoles: number; recentActions: { action: string; entity: string | null; outcome: string; createdAt: string }[] } | null>(null);
  const [accounts, setAccounts] = useState<SetupAccount[]>([]);
  const [categories, setCategories] = useState<SetupCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<SetupPaymentMethod[]>([]);
  const [accountForm, setAccountForm] = useState({ name: '', type: 'BANK', bankName: '', openingBalance: '0.00' });
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'INCOME' });
  const [paymentMethodName, setPaymentMethodName] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermissions | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [roleLevel, setRoleLevel] = useState(10);
  const [roleStatus, setRoleStatus] = useState('active');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', roleId: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const canUsers = user.isSuperAdmin || user.permissions.includes('users.view');
  const canRoles = user.isSuperAdmin || user.permissions.includes('roles.view');
  const canViewAccounts = user.isSuperAdmin || user.permissions.includes('accounts.view');
  const canManageAccounts = user.isSuperAdmin || user.permissions.includes('accounts.manage');
  const canViewCategories = user.isSuperAdmin || user.permissions.includes('categories.view');
  const canManageCategories = user.isSuperAdmin || user.permissions.includes('categories.manage');
  const canViewPaymentMethods = user.isSuperAdmin || user.permissions.includes('payment_methods.view');
  const canManagePaymentMethods = user.isSuperAdmin || user.permissions.includes('payment_methods.manage');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [rolesResult, permissionResult, overviewResult, usersResult, accountsResult, categoriesResult, paymentMethodsResult] = await Promise.all([
        canRoles ? adminRequest<{ roles: AdminRole[] }>('/roles?status=all&pageSize=100') : Promise.resolve({ roles: [] }),
        canRoles ? adminRequest<{ permissions: AdminPermission[] }>('/permissions') : Promise.resolve({ permissions: [] }),
        canUsers ? adminRequest<{ overview: NonNullable<typeof overview> }>('/overview') : Promise.resolve({ overview: null }),
        canUsers ? adminRequest<{ users: AdminUser[]; pagination: { totalPages: number } }>(`/users?page=${page}&pageSize=20&status=${statusFilter}&search=${encodeURIComponent(appliedSearch)}${roleFilter ? `&roleId=${encodeURIComponent(roleFilter)}` : ''}`) : Promise.resolve({ users: [], pagination: { totalPages: 1 } }),
        canViewAccounts ? adminRequest<{ accounts: SetupAccount[] }>('/accounts?pageSize=100') : Promise.resolve({ accounts: [] }),
        canViewCategories ? adminRequest<{ categories: SetupCategory[] }>('/categories?pageSize=100') : Promise.resolve({ categories: [] }),
        canViewPaymentMethods ? adminRequest<{ paymentMethods: SetupPaymentMethod[] }>('/payment-methods') : Promise.resolve({ paymentMethods: [] }),
      ]);
      setRoles(rolesResult.roles);
      setPermissions(permissionResult.permissions);
      setOverview(overviewResult.overview);
      setUsers(usersResult.users);
      setTotalPages(Math.max(1, usersResult.pagination.totalPages));
      setAccounts(accountsResult.accounts);
      setCategories(categoriesResult.categories);
      setPaymentMethods(paymentMethodsResult.paymentMethods);
      setNewUser((current) => ({ ...current, roleId: current.roleId || rolesResult.roles.find((role) => role.status === 'active' && role.name !== 'Super Admin')?.id || '' }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Administrative data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [page, appliedSearch, statusFilter, roleFilter]);

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    try {
      await adminRequest('/users', { method: 'POST', body: JSON.stringify(newUser) });
      setNewUser({ name: '', email: '', password: '', roleId: roles.find((role) => role.status === 'active' && role.name !== 'Super Admin')?.id ?? '' });
      setMessage('User created.'); await refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'User could not be created.'); }
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const canAssign = user.isSuperAdmin || user.permissions.includes('permissions.assign');
    const body = { name: roleName, description: roleDescription, accessLevel: roleLevel, status: roleStatus, ...(canAssign ? { permissions: rolePermissions } : {}) };
    try {
      if (editingRole) await adminRequest(`/roles/${editingRole.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await adminRequest('/roles', { method: 'POST', body: JSON.stringify(body) });
      setEditingRole(null); setRoleName(''); setRoleDescription(''); setRolePermissions([]);
      setMessage(editingRole ? 'Role updated.' : 'Role created.'); await refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Role could not be saved.'); }
  }

  async function changeUserRole(target: AdminUser, roleId: string) {
    try { await adminRequest(`/users/${target.id}`, { method: 'PATCH', body: JSON.stringify({ roleId }) }); setMessage('Role assignment updated; the user’s sessions were revoked.'); await refresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Role assignment failed.'); }
  }

  async function deleteRole(role: AdminRole) {
    if (!window.confirm(`Delete the unused role “${role.name}”?`)) return;
    try { await adminRequest(`/roles/${role.id}`, { method: 'DELETE' }); setMessage('Role deleted.'); await refresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Role could not be deleted.'); }
  }

  function duplicateRole(role: AdminRole) {
    setEditingRole(null); setRoleName(`${role.name} copy`); setRoleDescription(role.description); setRoleLevel(Math.max(1, Math.min(role.accessLevel, (user.isSuperAdmin ? 99 : user.permissions.includes('roles.create') ? 79 : 1)))); setRoleStatus('active'); setRolePermissions(role.grants.map((grant) => grant.permission.key));
  }

  async function saveOverrides() {
    if (!selectedUser) return;
    const values = Object.entries(overrides).filter(([, value]) => value !== 'inherit').map(([permission, value]) => ({ permission, granted: value === 'allow' }));
    try { await adminRequest(`/users/${selectedUser.id}/permissions`, { method: 'PATCH', body: JSON.stringify({ overrides: values }) }); setMessage('Individual permission overrides saved.'); await refresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Permission overrides failed.'); }
  }

  async function inspectPermissions(target: AdminUser) {
    setSelectedUser(target); setOverrides({}); setEffectivePermissions(null);
    try {
      const result = await adminRequest<EffectivePermissions>(`/users/${target.id}/permissions`);
      setEffectivePermissions(result);
      setOverrides(Object.fromEntries(result.overrides.map((override) => [override.permission, override.granted ? 'allow' : 'deny'])));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Permissions could not be loaded.'); }
  }

  async function userAction(target: AdminUser, action: 'suspend' | 'activate' | 'sessions/revoke' | 'password-reset') {
    try {
      const result = await adminRequest<{ resetToken?: string }>(`/users/${target.id}/${action}`, { method: 'POST' });
      setMessage(action === 'password-reset' ? `One-time reset token (send through your approved secure channel): ${result.resetToken}` : action === 'sessions/revoke' ? 'Active sessions revoked.' : `User ${action}d.`);
      await refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'User action failed.'); }
  }

  async function deleteUser(target: AdminUser) {
    if (!window.confirm(`Permanently delete ${target.name} only if they have no finance or audit history?`)) return;
    try { await adminRequest(`/users/${target.id}`, { method: 'DELETE' }); setMessage('User deleted.'); await refresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'User could not be deleted.'); }
  }

  async function createFinancialSetup(event: FormEvent<HTMLFormElement>, kind: 'account' | 'category' | 'payment-method') {
    event.preventDefault(); setError(''); setMessage('');
    const path = kind === 'account' ? '/accounts' : kind === 'category' ? '/categories' : '/payment-methods';
    const body = kind === 'account' ? accountForm : kind === 'category' ? categoryForm : { name: paymentMethodName };
    try {
      await adminRequest(path, { method: 'POST', body: JSON.stringify(body) });
      if (kind === 'account') setAccountForm({ name: '', type: 'BANK', bankName: '', openingBalance: '0.00' });
      if (kind === 'category') setCategoryForm({ name: '', type: 'INCOME' });
      if (kind === 'payment-method') setPaymentMethodName('');
      setMessage(`${kind === 'payment-method' ? 'Payment method' : kind[0].toUpperCase() + kind.slice(1)} created.`);
      await refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Financial setup could not be saved.'); }
  }

  async function toggleSetupStatus(kind: 'accounts' | 'categories' | 'payment-methods', item: SetupAccount | SetupCategory | SetupPaymentMethod) {
    try {
      const result = await adminRequest<{ account?: SetupAccount; category?: SetupCategory; paymentMethod?: SetupPaymentMethod }>(`/${kind}/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: item.status === 'active' ? 'inactive' : 'active' }) });
      setMessage(`${'name' in item ? item.name : 'Item'} ${result.account?.status ?? result.category?.status ?? result.paymentMethod?.status}.`);
      await refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Status could not be changed.'); }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div><Link to="/dashboard" className="text-sm font-medium text-blue-700 hover:underline">← Dashboard</Link><h1 className="mt-2 text-3xl font-bold text-slate-950">User & access management</h1><p className="mt-1 text-sm text-slate-600">Signed in as {user.name} · {user.role}</p></div>
          <button onClick={() => void refresh()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Refresh</button>
        </header>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mb-4 break-all rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
        {loading && <p role="status" className="mb-4 text-sm text-slate-500">Loading administration data…</p>}
        {overview && <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Total users', overview.totalUsers], ['Active users', overview.activeUsers], ['Suspended', overview.suspendedUsers], ['Active roles', overview.totalRoles]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</section>}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
          {canUsers && <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2"><Users size={19} className="text-blue-700"/><h2 className="text-xl font-bold">Users</h2></div>
              <form onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedSearch(search); }} className="mb-4 flex flex-wrap gap-2">
                <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3"><Search size={16} className="text-slate-400"/><input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full py-2 text-sm outline-none" placeholder="Search name or email"/></label>
                <select aria-label="Filter user status" value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option><option value="all">All statuses</option></select>
                <select aria-label="Filter by role" value={roleFilter} onChange={(event) => { setPage(1); setRoleFilter(event.target.value); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All roles</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Search</button>
              </form>
              <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-2">User</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {users.map((target) => <tr key={target.id} className="border-b border-slate-100 align-top"><td className="py-3"><p className="font-semibold">{target.name}</p><p className="text-slate-500">{target.email}</p></td><td className="py-3">{user.permissions.includes('users.update') || user.isSuperAdmin ? <select aria-label={`Role for ${target.name}`} value={target.roleId} onChange={(event) => void changeUserRole(target, event.target.value)} className="max-w-48 rounded border border-slate-300 px-2 py-1" disabled={target.id === user.id || target.isSuperAdmin}>{roles.filter((role) => role.status === 'active' && role.name !== 'Super Admin').map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select> : target.role.name}</td><td className="py-3">{target.status}</td><td className="py-3"><div className="flex flex-wrap gap-1">{target.isSuperAdmin || target.id === user.id ? <span className="text-xs text-slate-500">Protected account</span> : <>{(user.isSuperAdmin || user.permissions.includes('users.update')) && <button onClick={() => { const name = window.prompt('User name', target.name); if (name === null) return; const email = window.prompt('User email', target.email); if (email === null) return; void adminRequest(`/users/${target.id}`, { method: 'PATCH', body: JSON.stringify({ name, email }) }).then(() => refresh()).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'User update failed.')); }} className="rounded border px-2 py-1 text-xs">Edit</button>}{(user.isSuperAdmin || user.permissions.includes('users.suspend')) && <button onClick={() => void userAction(target, target.status === 'active' ? 'suspend' : 'activate')} className="rounded border px-2 py-1 text-xs">{target.status === 'active' ? 'Suspend' : 'Activate'}</button>}{(user.isSuperAdmin || user.permissions.includes('sessions.manage')) && <button onClick={() => void userAction(target, 'sessions/revoke')} className="rounded border px-2 py-1 text-xs">Revoke sessions</button>}{(user.isSuperAdmin || user.permissions.includes('users.update')) && <button onClick={() => void userAction(target, 'password-reset')} className="rounded border px-2 py-1 text-xs">Reset password</button>}{(user.isSuperAdmin || user.permissions.includes('permissions.assign')) && <button onClick={() => void inspectPermissions(target)} className="rounded border px-2 py-1 text-xs">Permissions</button>}{(user.isSuperAdmin || user.permissions.includes('users.delete')) && <button onClick={() => void deleteUser(target)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700">Delete</button>}</>}</div></td></tr>)}
                {users.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-500">No users found.</td></tr>}
              </tbody></table></div>
              <div className="mt-4 flex items-center justify-between text-sm"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></div>
            </div>

            {selectedUser && <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Permissions · {selectedUser.name}</h2><button onClick={() => { setSelectedUser(null); setEffectivePermissions(null); }} className="text-sm text-slate-500">Close</button></div><p className="mb-3 text-sm text-slate-600">Primary role: {effectivePermissions?.role ?? selectedUser.role.name}. Effective permissions: {effectivePermissions?.effectivePermissions.join(', ') || 'Loading…'}</p><p className="mb-3 text-sm text-slate-500">Choose inherit, allow, or deny for each permission. Grants must be within your own authority.</p><div className="grid gap-2 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.key} className="flex items-center justify-between gap-3 rounded border p-2 text-sm"><span>{permission.name}{permission.sensitive && <span className="ml-1 text-amber-700">· sensitive</span>}</span><select value={overrides[permission.key] ?? 'inherit'} onChange={(event) => setOverrides((current) => ({ ...current, [permission.key]: event.target.value }))} className="rounded border px-2 py-1"><option value="inherit">Inherit</option><option value="allow">Allow</option><option value="deny">Deny</option></select></label>)}</div><button onClick={() => void saveOverrides()} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Save overrides</button></div>}

            <details className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-bold"><UserPlus size={18}/> Create a user</summary><form onSubmit={submitUser} className="mt-4 grid gap-3 sm:grid-cols-2"><input required maxLength={120} aria-label="Full name" placeholder="Full name" value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} className="rounded-lg border px-3 py-2"/><input required type="email" maxLength={254} aria-label="Email" placeholder="Email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} className="rounded-lg border px-3 py-2"/><input required type="password" minLength={12} maxLength={72} aria-label="Temporary password" placeholder="Temporary password (12+ characters)" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} className="rounded-lg border px-3 py-2"/><select required aria-label="Initial role" value={newUser.roleId} onChange={(event) => setNewUser({ ...newUser, roleId: event.target.value })} className="rounded-lg border px-3 py-2">{roles.filter((role) => role.status === 'active' && role.name !== 'Super Admin').map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white sm:col-span-2">Create user</button></form></details>
          </section>}

          {canRoles && <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center gap-2"><KeyRound size={19} className="text-blue-700"/><h2 className="text-xl font-bold">Roles & permissions</h2></div><div className="space-y-3">{roles.map((role) => <article key={role.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{role.name}{role.isSystem && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Template</span>}</h3><p className="text-xs text-slate-500">Level {role.accessLevel} · {role._count.users} users · {role.status}</p><p className="mt-1 text-sm text-slate-600">{role.description}</p></div><div className="flex gap-2">{(user.isSuperAdmin || user.permissions.includes('roles.create')) && <button onClick={() => duplicateRole(role)} className="rounded border px-3 py-1 text-sm">Duplicate</button>}{(user.isSuperAdmin || user.permissions.includes('roles.update')) && <button onClick={() => { setEditingRole(role); setRoleName(role.name); setRoleDescription(role.description); setRoleLevel(role.accessLevel); setRoleStatus(role.status); setRolePermissions(role.grants.map((grant) => grant.permission.key)); }} className="rounded border px-3 py-1 text-sm" disabled={role.name === 'Super Admin' || (role.isSystem && !user.isSuperAdmin)}>Edit</button>}{(user.isSuperAdmin || user.permissions.includes('roles.delete')) && !role.isSystem && role._count.users === 0 && <button onClick={() => void deleteRole(role)} className="rounded border border-red-200 px-3 py-1 text-sm text-red-700">Delete</button>}</div></div><p className="mt-2 text-xs text-slate-500">{role.grants.map((grant) => grant.permission.key).join(' · ') || 'No permissions assigned'}</p></article>)}</div></div>
            {((user.isSuperAdmin || user.permissions.includes('roles.create')) && !editingRole || (user.isSuperAdmin || user.permissions.includes('roles.update')) && editingRole) && <form onSubmit={saveRole} className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold">{editingRole ? `Edit ${editingRole.name}` : 'Create custom role'}</h2><div className="grid gap-3 sm:grid-cols-2"><input required maxLength={80} aria-label="Role name" placeholder="Role name" value={roleName} onChange={(event) => setRoleName(event.target.value)} className="rounded-lg border px-3 py-2"/><input maxLength={500} aria-label="Role description" placeholder="Description" value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} className="rounded-lg border px-3 py-2"/><label className="text-sm">Access level (1–99)<input type="number" min={1} max={99} value={roleLevel} onChange={(event) => setRoleLevel(Number(event.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2"/></label><select aria-label="Role status" value={roleStatus} onChange={(event) => setRoleStatus(event.target.value)} className="rounded-lg border px-3 py-2"><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{[...new Set(permissions.map((permission) => permission.module))].map((module) => <fieldset key={module} className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold capitalize">{module.replace('_', ' ')}</legend><div className="grid gap-2 sm:grid-cols-2">{permissions.filter((permission) => permission.module === module).map((permission) => <label key={permission.key} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!user.isSuperAdmin && !user.permissions.includes('permissions.assign')} checked={rolePermissions.includes(permission.key)} onChange={(event) => setRolePermissions((current) => event.target.checked ? [...current, permission.key] : current.filter((key) => key !== permission.key))}/>{permission.name}{permission.sensitive && <span className="text-amber-700">(sensitive)</span>}</label>)}</div></fieldset>)}</div><div className="mt-4 flex gap-2"><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Save role</button>{editingRole && <button type="button" onClick={() => { setEditingRole(null); setRoleName(''); setRoleDescription(''); setRolePermissions([]); }} className="rounded-lg border px-4 py-2">Cancel</button>}</div></form>}
            {overview?.recentActions && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-3 font-bold">Recent administrative activity</h2><ul className="space-y-2 text-sm">{overview.recentActions.map((action, index) => <li key={`${action.action}-${index}`} className="flex justify-between gap-3 border-b pb-2"><span>{action.action} · {action.entity ?? 'System'}</span><time className="shrink-0 text-slate-500">{new Date(action.createdAt).toLocaleString()}</time></li>)}</ul></div>}
          </section>}

          {(canViewAccounts || canViewCategories || canViewPaymentMethods) && <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-xl font-bold">Financial setup</h2>
              {canViewAccounts && <div className="mb-5"><h3 className="font-semibold">Accounts</h3><ul className="mt-2 space-y-2 text-sm">{accounts.map((account) => <li key={account.id} className="flex items-center justify-between gap-3 border-b pb-2"><span>{account.name} · {account.type} · {formatCurrency(Number(account.currentBalance))} · {account.status}</span>{canManageAccounts && <button onClick={() => void toggleSetupStatus('accounts', account)} className="rounded border px-2 py-1 text-xs">{account.status === 'active' ? 'Deactivate' : 'Activate'}</button>}</li>)}</ul>{canManageAccounts && <form onSubmit={(event) => void createFinancialSetup(event, 'account')} className="mt-3 grid gap-2 sm:grid-cols-2"><input required maxLength={120} aria-label="Account name" placeholder="Account name" value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} className="rounded border px-3 py-2 text-sm"/><select aria-label="Account type" value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })} className="rounded border px-3 py-2 text-sm"><option value="BANK">Bank</option><option value="CASH">Cash</option><option value="PETTY_CASH">Petty cash</option></select><input maxLength={120} aria-label="Bank name" placeholder="Bank name (optional)" value={accountForm.bankName} onChange={(event) => setAccountForm({ ...accountForm, bankName: event.target.value })} className="rounded border px-3 py-2 text-sm"/><input required pattern="\d{1,15}(\.\d{1,2})?" aria-label="Opening balance" placeholder="Opening balance" value={accountForm.openingBalance} onChange={(event) => setAccountForm({ ...accountForm, openingBalance: event.target.value })} className="rounded border px-3 py-2 text-sm"/><button className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white sm:col-span-2">Add account</button></form>}</div>}
              {canViewCategories && <div className="mb-5"><h3 className="font-semibold">Categories</h3><ul className="mt-2 space-y-2 text-sm">{categories.map((category) => <li key={category.id} className="flex items-center justify-between gap-3 border-b pb-2"><span>{category.name} · {category.type} · {category.status}</span>{canManageCategories && <button onClick={() => void toggleSetupStatus('categories', category)} className="rounded border px-2 py-1 text-xs">{category.status === 'active' ? 'Deactivate' : 'Activate'}</button>}</li>)}</ul>{canManageCategories && <form onSubmit={(event) => void createFinancialSetup(event, 'category')} className="mt-3 flex flex-wrap gap-2"><input required maxLength={120} aria-label="Category name" placeholder="Category name" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} className="min-w-36 flex-1 rounded border px-3 py-2 text-sm"/><select aria-label="Category type" value={categoryForm.type} onChange={(event) => setCategoryForm({ ...categoryForm, type: event.target.value })} className="rounded border px-3 py-2 text-sm"><option value="INCOME">Income</option><option value="EXPENDITURE">Expenditure</option></select><button className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Add category</button></form>}</div>}
              {canViewPaymentMethods && <div><h3 className="font-semibold">Payment methods</h3><ul className="mt-2 space-y-2 text-sm">{paymentMethods.map((method) => <li key={method.id} className="flex items-center justify-between gap-3 border-b pb-2"><span>{method.name} · {method.status}</span>{canManagePaymentMethods && <button onClick={() => void toggleSetupStatus('payment-methods', method)} className="rounded border px-2 py-1 text-xs">{method.status === 'active' ? 'Deactivate' : 'Activate'}</button>}</li>)}</ul>{canManagePaymentMethods && <form onSubmit={(event) => void createFinancialSetup(event, 'payment-method')} className="mt-3 flex gap-2"><input required maxLength={80} aria-label="Payment method name" placeholder="Payment method" value={paymentMethodName} onChange={(event) => setPaymentMethodName(event.target.value)} className="min-w-0 flex-1 rounded border px-3 py-2 text-sm"/><button className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Add</button></form>}</div>}
            </div>
          </section>}
        </div>
      </div>
    </main>
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
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) return false;
      setUser(null);
      navigate('/login', { replace: true });
      return true;
    } catch {
      return false;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage onAuthenticated={setUser} />} />
      <Route path="/reset-password" element={<PasswordResetPage />} />
      <Route path="/dashboard" element={<ProtectedRoute user={user} isLoading={isLoadingSession}><DashboardPage user={user!} onLogout={handleLogout} onSessionExpired={() => setUser(null)} /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute user={user} isLoading={isLoadingSession}>{user && (user.permissions.includes('users.view') || user.permissions.includes('roles.view') || user.permissions.includes('accounts.view') || user.permissions.includes('categories.view') || user.permissions.includes('payment_methods.view')) ? <AdminPage user={user} /> : <Navigate to="/dashboard" replace />}</ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
