import { BarChart3, Banknote, CreditCard, FileText, LogIn, Settings, ShieldCheck, TrendingUp, Users } from 'lucide-react';
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

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <aside className="fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 p-5">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">SF</div>
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
