import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Headphones,
  LifeBuoy,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';

type CategoryId = 'all' | 'payroll' | 'attendance' | 'leave' | 'people' | 'billing' | 'security';

interface HelpCategory {
  id: Exclude<CategoryId, 'all'>;
  title: string;
  description: string;
  articles: number;
  icon: typeof Wallet;
}

interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  category: Exclude<CategoryId, 'all'>;
  views: number;
  popular: boolean;
}

const categories: HelpCategory[] = [
  { id: 'payroll', title: 'Payroll', description: 'Runs, payslips, and tax profiles for your company.', articles: 18, icon: Wallet },
  { id: 'attendance', title: 'Attendance', description: 'Punches, devices, geofence, and regularization.', articles: 14, icon: CalendarClock },
  { id: 'leave', title: 'Leave', description: 'Balances, policies, and holiday calendars.', articles: 11, icon: BookOpen },
  { id: 'people', title: 'People & org', description: 'Directory, contracts, onboarding, and roles.', articles: 22, icon: Users },
  { id: 'billing', title: 'Plan & billing', description: 'Seats, invoices, and your company subscription.', articles: 7, icon: CreditCard },
  { id: 'security', title: 'Access & security', description: 'SSO, 2FA, and who can administer this tenant.', articles: 9, icon: ShieldCheck },
];

const articles: HelpArticle[] = [
  { id: 'a1', title: 'Start and lock a monthly payroll run', summary: 'Walk through validation, exceptions, and approval before funds move.', category: 'payroll', views: 4821, popular: true },
  { id: 'a2', title: 'Export employee payslips as PDF', summary: 'Bulk-download for a cycle or share a single slip from the employee profile.', category: 'payroll', views: 3104, popular: true },
  { id: 'a3', title: 'Correct a missed biometric punch', summary: 'File a regularization request and attach a screenshot from the device.', category: 'attendance', views: 2750, popular: true },
  { id: 'a4', title: 'Build a weekly roster from shift templates', summary: 'Assign shifts, publish to employees, and handle swap requests.', category: 'attendance', views: 1688, popular: false },
  { id: 'a5', title: 'Configure leave types and accrual rules', summary: 'Set carry-forward, waiting periods, and manager approval chains.', category: 'leave', views: 2210, popular: true },
  { id: 'a6', title: 'Import the company holiday calendar', summary: 'CSV mapping for regional calendars used in leave calculations.', category: 'leave', views: 940, popular: false },
  { id: 'a7', title: 'Invite a department HR administrator', summary: 'Grant scoped Company Admin access without platform-operator rights.', category: 'people', views: 1902, popular: true },
  { id: 'a8', title: 'Track contract expiry and renewals', summary: 'Alerts, e-sign status, and linking documents to the employee file.', category: 'people', views: 1344, popular: false },
  { id: 'a9', title: 'Understand your seat usage this month', summary: 'How billed seats map to active employees in this tenant.', category: 'billing', views: 812, popular: false },
  { id: 'a10', title: 'Require SSO for all company admins', summary: 'Enforce identity provider login for this organization only.', category: 'security', views: 1205, popular: false },
];

const categoryLabel: Record<Exclude<CategoryId, 'all'>, string> = {
  payroll: 'Payroll',
  attendance: 'Attendance',
  leave: 'Leave',
  people: 'People',
  billing: 'Billing',
  security: 'Security',
};

function formatViews(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

export function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId>('all');
  const [contactOpen, setContactOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [sent, setSent] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesCategory = category === 'all' || article.category === category;
      const matchesQuery =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        categoryLabel[article.category].toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const popular = useMemo(
    () => [...articles].filter((article) => article.popular).sort((a, b) => b.views - a.views),
    [],
  );

  const openContact = (preset?: string) => {
    if (preset) setSubject(preset);
    setSent(false);
    setContactOpen(true);
  };

  const submitContact = (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !details.trim()) return;
    setSent(true);
    setSubject('');
    setDetails('');
    setPriority('Medium');
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 p-4 lg:p-6">
      <section className="relative overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-600 via-accent-700 to-accent-900 px-6 py-10 text-white shadow-elevated dark:border-accent-800 sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative max-w-2xl space-y-4">
          <Badge className="border-white/20 bg-white/15 text-white">
            <LifeBuoy className="h-3.5 w-3.5" />
            Company help center
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">How can we help your team today?</h1>
          <p className="text-sm text-white/80">
            Guides for this tenant’s HR, payroll, and attendance tools. Platform-wide incident queues live in a
            separate operator console.
          </p>
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-accent-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles, e.g. payroll run or missed punch"
              className="h-12 w-full rounded-xl border border-white/15 bg-white/95 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/70 dark:bg-slate-950 dark:text-slate-50"
              aria-label="Search help articles"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-primary">Browse by topic</h2>
            <p className="text-sm text-secondary">FAQ collections tailored to company administrators.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((item) => {
            const Icon = item.icon;
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(active ? 'all' : item.id)}
                className={`rounded-xl border p-4 text-left shadow-card transition-all ${
                  active
                    ? 'border-accent-300 bg-accent-50 shadow-card-hover dark:border-accent-700 dark:bg-accent-950/40'
                    : 'surface hover:border-accent-200 hover:shadow-card-hover dark:hover:border-accent-800'
                }`}
              >
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-300">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-primary">{item.title}</p>
                <p className="mt-1 text-xs text-secondary">{item.description}</p>
                <p className="mt-3 text-[11px] font-medium text-accent-700 dark:text-accent-300">
                  {item.articles} articles
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-primary">
              {category === 'all' ? 'All articles' : categoryLabel[category]}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {category !== 'all' && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCategory('all')}>
                  Clear category
                </Button>
              )}
              <span className="text-xs text-muted">{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <Card>
              <CardBody className="py-12 text-center">
                <p className="text-sm font-medium text-primary">No articles match this search</p>
                <p className="mt-1 text-sm text-secondary">Try another keyword or reach company support.</p>
                <Button type="button" className="mt-4" onClick={() => openContact(query)}>
                  Contact support
                </Button>
              </CardBody>
            </Card>
          ) : (
            <ul className="space-y-3">
              {filtered.map((article) => (
                <li key={article.id}>
                  <article className="surface flex flex-col gap-3 rounded-xl border p-4 shadow-card transition-shadow hover:shadow-card-hover sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone="accent">{categoryLabel[article.category]}</Badge>
                        {article.popular && (
                          <Badge tone="warning">
                            <Sparkles className="h-3 w-3" />
                            Popular
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-primary">{article.title}</h3>
                      <p className="mt-1 text-sm text-secondary">{article.summary}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {formatViews(article.views)} views
                      </span>
                      <FileText className="h-4 w-4 text-accent-500" />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-semibold text-primary">Popular articles</h2>
              <ul className="space-y-2">
                {popular.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCategory(article.category);
                        setQuery('');
                      }}
                      className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-[rgb(var(--bg-hover))]"
                    >
                      <span className="text-sm font-medium text-primary">{article.title}</span>
                      <span className="shrink-0 text-[11px] text-muted">{formatViews(article.views)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="border-accent-200 dark:border-accent-800">
            <CardBody className="space-y-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-300">
                <Headphones className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-primary">Still stuck?</h2>
                <p className="mt-1 text-xs text-secondary">
                  Open a ticket with your company support team. This does not create a platform operator case.
                </p>
              </div>
              <Button type="button" className="w-full" onClick={() => openContact()}>
                Contact support
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Contact company support"
        description="Your request stays with this tenant. It is not the platform support queue."
        footer={
          sent ? (
            <Button type="button" onClick={() => setContactOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => setContactOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="help-center-contact">
                Send request
              </Button>
            </>
          )
        }
      >
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600 dark:bg-success-950/40 dark:text-success-300">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-primary">Request sent</p>
            <p className="text-sm text-secondary">We’ll follow up in this workspace. Check the help widget for ticket status.</p>
          </div>
        ) : (
          <form id="help-center-contact" className="space-y-3" onSubmit={submitContact}>
            <div>
              <Label htmlFor="hc-subject">Subject</Label>
              <Input
                id="hc-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What do you need help with?"
                required
              />
            </div>
            <div>
              <Label htmlFor="hc-details">Details</Label>
              <Textarea
                id="hc-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={4}
                placeholder="Include steps, expected result, and who is affected."
                required
              />
            </div>
            <div>
              <Label htmlFor="hc-priority">Priority</Label>
              <Select id="hc-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Urgent</option>
              </Select>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
