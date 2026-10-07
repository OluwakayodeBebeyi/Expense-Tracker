import { ArrowRight, BarChart3, Banknote, BadgeCheck, CreditCard, FileText, LogIn, Settings, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { Link, Route, Routes } from 'react-router-dom';
import { formatCurrency } from './lib/finance';

const summary = [
  { label: 'Total Income', value: formatCurrency(1250000), icon: TrendingUp, tone: 'blue' },
  { label: 'Total Expenditure', value: formatCurrency(820000), icon: CreditCard, tone: 'slate' },
  { label: 'Current Balance', value: formatCurrency(430000), icon: Banknote, tone: 'emerald' },
  { label: 'Transactions', value: '126', icon: BarChart3, tone: 'amber' },
];

const quickStats = [
  { title: 'Today Income', value: formatCurrency(68000) },
  { title: 'Today Expenditure', value: formatCurrency(35000) },
  { title: 'Current Month Balance', value: formatCurrency(540000) },
  { title: 'Financial Year Income', value: formatCurrency(4300000) },
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
                <p className="text-2xl font-bold text-white">₦4.3M</p>
                <p>Annual income</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">126</p>
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
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">Operating</span>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Current balance</p>
                  <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(430000)}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Income</p>
                    <p className="mt-2 text-xl font-semibold text-blue-300">{formatCurrency(1250000)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Expenditure</p>
                    <p className="mt-2 text-xl font-semibold text-rose-300">{formatCurrency(820000)}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Budget health</span>
                    <span className="font-semibold text-emerald-300">84%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full w-[84%] rounded-full bg-gradient-to-r from-blue-500 to-emerald-400" />
                  </div>
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

function DashboardPage() {
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
          <p className="mt-2 text-sm text-slate-700">All financial records are synchronized and ready for reporting.</p>
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
              <p className="font-semibold text-slate-800">Administrator</p>
            </div>
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
              <div className="flex h-full items-end gap-3">
                {[50, 65, 75, 48, 92, 76, 88, 70, 95, 80, 102, 120].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-xl bg-blue-500/80" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-900">Expenditure by Category</h3>
            <div className="mt-6 space-y-4">
              {[
                ['Salaries', 48],
                ['Utilities', 18],
                ['School Supplies', 12],
                ['Maintenance', 9],
                ['ICT', 8],
                ['Security', 5],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                    <span>{label}</span>
                    <span>{value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}
