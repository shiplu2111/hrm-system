import { useState } from 'react';
import {
  CreditCard,
  Check,
  Zap,
  Building,
  ShieldCheck,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Form';
import { billingPlans, tenantBillings, type TenantBilling } from '@/data/payrollData';

export function BillingPage() {
  const [tenants, setTenants] = useState<TenantBilling[]>(tenantBillings);
  const [search, setSearch] = useState('');
  const [annualBilling, setAnnualBilling] = useState(false);

  const filteredTenants = tenants.filter(
    (t) =>
      t.companyName.toLowerCase().includes(search.toLowerCase()) ||
      t.domain.toLowerCase().includes(search.toLowerCase()) ||
      t.plan.toLowerCase().includes(search.toLowerCase())
  );

  const totalMrr = tenants.reduce((s, t) => s + t.mrr, 0);
  const totalSeats = tenants.reduce((s, t) => s + t.seats, 0);

  return (
    <div className="p-4 lg:p-6 space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Subscription & Tenant Billing</h1>
          <p className="text-sm text-secondary mt-0.5">
            Super admin multi-tenant licensing, plan tiers, and recurring billing management.
          </p>
        </div>

        {/* Annual / Monthly Billing Switch */}
        <div className="flex items-center gap-2 surface border border-base px-3 py-1.5 rounded-xl">
          <span className={`text-xs font-semibold ${!annualBilling ? 'text-primary' : 'text-secondary'}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnualBilling(!annualBilling)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
              annualBilling ? 'bg-accent-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                annualBilling ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-xs font-semibold ${annualBilling ? 'text-primary' : 'text-secondary'}`}>
            Annual (Save 20%)
          </span>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{tenants.length}</div>
            <div className="text-xs text-secondary">Active Tenant Organizations</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">${totalMrr.toLocaleString()}</div>
            <div className="text-xs text-secondary">Monthly Recurring Revenue (MRR)</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{totalSeats.toLocaleString()}</div>
            <div className="text-xs text-secondary">Total Billed Employee Seats</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">Business Pro</div>
            <div className="text-xs text-secondary">Current Acme Tenant Tier</div>
          </div>
        </div>
      </div>

      {/* Plan Comparison Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-primary">Available Subscription Plans</h2>
            <p className="text-xs text-secondary">Scalable pricing based on active headcount and feature scope.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {billingPlans.map((plan) => {
            const price = annualBilling
              ? Math.round(plan.pricePerUser * 0.8)
              : plan.pricePerUser;

            const isCurrentPlan = plan.id === 'plan-business';

            return (
              <Card
                key={plan.id}
                className={`flex flex-col justify-between transition-all ${
                  plan.popular
                    ? 'border-2 border-accent-500 shadow-lg relative'
                    : 'border-base hover:border-strong'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-600 text-white px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow">
                    Most Popular
                  </div>
                )}

                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">{plan.name}</CardTitle>
                  <p className="text-xs text-secondary mt-1">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-primary">${price}</span>
                    <span className="text-xs text-muted">/ employee / mo</span>
                  </div>
                </CardHeader>

                <CardBody className="pt-0 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5 pt-4 border-t border-base">
                    {plan.features.map((feat) => (
                      <div key={feat.name} className="flex items-start gap-2 text-xs">
                        <Check
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            feat.included
                              ? 'text-success-600 dark:text-success-400'
                              : 'text-muted opacity-40'
                          }`}
                        />
                        <span className={feat.included ? 'text-primary' : 'text-muted line-through'}>
                          {feat.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-base">
                    {isCurrentPlan ? (
                      <Button variant="secondary" className="w-full" disabled>
                        ✓ Current Active Plan
                      </Button>
                    ) : (
                      <Button
                        variant={plan.popular ? 'primary' : 'secondary'}
                        className="w-full"
                        onClick={() => alert(`Upgrading to ${plan.name}...`)}
                      >
                        {price === 0 ? 'Downgrade' : 'Upgrade Plan'}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tenant Billing Overview Table (Super Admin) */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Multi-Tenant Invoicing & Accounts</CardTitle>
            <p className="text-xs text-secondary mt-0.5">
              Live subscription status, payment methods, and automated billing renewal dates.
            </p>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies, domains..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Company / Tenant
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Subscribed Plan
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Active Seats
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Monthly MRR
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Next Billing Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-primary">
                      {tenant.companyName}
                      <div className="text-xs text-muted font-normal">{tenant.domain}</div>
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      <Badge
                        tone={
                          tenant.plan === 'Enterprise'
                            ? 'accent'
                            : tenant.plan === 'Business'
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {tenant.plan}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-secondary font-medium">
                      {tenant.seats} seats
                    </td>

                    <td className="px-5 py-3.5 font-bold text-primary text-xs">
                      ${tenant.mrr.toLocaleString()} / mo
                    </td>

                    <td className="px-5 py-3.5 text-xs text-secondary font-mono">
                      {tenant.paymentMethod}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-primary font-medium">
                      {tenant.nextBillingDate}
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge
                        tone={
                          tenant.status === 'Paid'
                            ? 'success'
                            : tenant.status === 'Pending'
                            ? 'warning'
                            : 'error'
                        }
                        dot
                      >
                        {tenant.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => alert(`Downloading invoice for ${tenant.companyName}...`)}
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

