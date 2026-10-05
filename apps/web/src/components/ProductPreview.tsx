import { CalendarCheck, Clock, Users, Wallet } from 'lucide-react';

const kpis = [
  { icon: Users, label: 'Headcount', value: '842', delta: '+12 this month' },
  { icon: Clock, label: 'Present today', value: '96.4%', delta: '31 on leave' },
  { icon: CalendarCheck, label: 'Pending approvals', value: '18', delta: '6 leave · 12 OT' },
  { icon: Wallet, label: 'October payroll', value: '৳2.14 Cr', delta: 'Ready to approve' },
];

const bars = [62, 74, 70, 81, 77, 88, 84, 92, 86, 95, 90, 97];

const activity = [
  { name: 'Ayesha Rahman', action: 'requested 2 days annual leave', tone: 'bg-amber-400' },
  { name: 'Payroll', action: 'October run calculated for 842 employees', tone: 'bg-emerald-500' },
  { name: 'Tanvir Hasan', action: 'clocked in at Chattogram site', tone: 'bg-brand-500' },
];

/** Decorative dashboard mock for the landing page hero. */
export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-5xl" aria-hidden>
      <div className="absolute -inset-x-10 -top-10 bottom-0 rounded-[2.5rem] bg-gradient-to-b from-brand-200/50 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-elevated">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-300" />
          <span className="h-3 w-3 rounded-full bg-amber-300" />
          <span className="h-3 w-3 rounded-full bg-emerald-300" />
          <span className="ml-3 rounded-md bg-white px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-200">
            app.cmsnbd.com/dashboard
          </span>
        </div>

        <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
          <div className="hidden border-r border-slate-100 p-4 sm:block">
            {['Dashboard', 'Employees', 'Attendance', 'Leave', 'Roster', 'Payroll', 'Reports'].map((item, i) => (
              <div
                key={item}
                className={`mb-1 rounded-md px-3 py-2 text-xs font-medium ${
                  i === 0 ? 'bg-brand-50 text-brand-700' : 'text-slate-500'
                }`}
              >
                {item}
              </div>
            ))}
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {kpis.map(({ icon: Icon, label, value, delta }) => (
                <div key={label} className="rounded-xl border border-slate-100 p-3.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Icon className="h-3.5 w-3.5 text-brand-500" />
                    {label}
                  </div>
                  <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
                  <p className="text-[11px] text-slate-400">{delta}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-700">Attendance rate · last 12 weeks</p>
                <div className="mt-4 flex h-28 items-end gap-1.5">
                  {bars.map((height, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t ${i === bars.length - 1 ? 'bg-brand-600' : 'bg-brand-200'}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-700">Recent activity</p>
                <ul className="mt-3 space-y-3">
                  {activity.map((item) => (
                    <li key={item.name} className="flex gap-2.5 text-[11px] leading-snug text-slate-500">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.tone}`} />
                      <span>
                        <span className="font-semibold text-slate-700">{item.name}</span> {item.action}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
