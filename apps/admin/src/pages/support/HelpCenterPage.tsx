import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Search,
} from 'lucide-react';
import type { KbArticleListItem, KbArticleRecord, KbCategoryRecord } from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useNav } from '@/context/NavContext';
import {
  createSupportTicket,
  getKbArticle,
  listKbArticles,
  listKbCategories,
} from '@/lib/support-api';
import { ApiError } from '@/lib/tenant-api-client';

export function HelpCenterPage() {
  const { navigate } = useNav();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [categories, setCategories] = useState<KbCategoryRecord[]>([]);
  const [articles, setArticles] = useState<KbArticleListItem[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<KbArticleRecord | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, arts] = await Promise.all([
        listKbCategories(),
        listKbArticles({
          search: query.trim() || undefined,
          categoryId: categoryId === 'all' ? undefined : categoryId,
        }),
      ]);
      setCategories(cats);
      setArticles(arts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load help center');
    } finally {
      setLoading(false);
    }
  }, [categoryId, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const popular = useMemo(
    () => [...articles].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5),
    [articles],
  );

  const openArticle = async (articleId: string) => {
    try {
      const article = await getKbArticle(articleId);
      setSelectedArticle(article);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load article');
    }
  };

  const submitContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !details.trim()) return;
    setSubmitting(true);
    try {
      await createSupportTicket({
        subject: subject.trim(),
        description: details.trim(),
        priority,
      });
      setSent(true);
      setSubject('');
      setDetails('');
      setPriority('medium');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && articles.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 p-4 lg:p-6">
      <section className="relative overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-600 via-accent-700 to-accent-900 px-6 py-10 text-white shadow-elevated dark:border-accent-800 sm:px-10">
        <div className="relative max-w-2xl space-y-4">
          <Badge className="border-white/20 bg-white/15 text-white">
            <LifeBuoy className="h-3.5 w-3.5" />
            Company help center
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            How can we help your team today?
          </h1>
          <p className="text-sm text-white/80">
            Searchable guides for HR, payroll, and attendance. Submit a ticket if you need more help.
          </p>
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-accent-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles, e.g. payroll run or leave request"
              className="h-12 w-full rounded-xl border border-white/15 bg-white/95 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/70 dark:bg-slate-950 dark:text-slate-50"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="bg-white/15 text-white border-white/20 hover:bg-white/25"
              onClick={() => navigate('support-kb-admin')}
            >
              Manage articles
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="bg-white/15 text-white border-white/20 hover:bg-white/25"
              onClick={() => navigate('support-tickets')}
            >
              Support queue
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-base font-semibold text-primary">Browse by topic</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={categoryId === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCategoryId('all')}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              variant={categoryId === cat.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setCategoryId(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-primary">
            {articles.length} article{articles.length === 1 ? '' : 's'}
          </h2>
          {articles.map((article) => (
            <Card key={article.id}>
              <CardBody className="flex items-start justify-between gap-4 p-4">
                <div>
                  <Badge tone="accent" className="mb-2">
                    {article.categoryName}
                  </Badge>
                  <button
                    type="button"
                    className="text-left text-sm font-semibold text-primary hover:text-accent-700"
                    onClick={() => void openArticle(article.id)}
                  >
                    {article.title}
                  </button>
                  <p className="mt-1 text-xs text-secondary">{article.summary}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void openArticle(article.id)}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardBody>
            </Card>
          ))}
          {articles.length === 0 && (
            <p className="text-sm text-secondary">No articles match your search.</p>
          )}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardBody className="space-y-3 p-4">
              <h3 className="text-sm font-semibold text-primary">Popular articles</h3>
              {popular.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  className="block w-full text-left text-xs text-accent-700 hover:underline dark:text-accent-300"
                  onClick={() => void openArticle(article.id)}
                >
                  {article.title}
                </button>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-3 p-4">
              <BookOpen className="h-5 w-5 text-accent-600" />
              <p className="text-sm font-semibold text-primary">Still stuck?</p>
              <p className="text-xs text-secondary">
                Open a support ticket and our HR team will follow up.
              </p>
              <Button variant="primary" size="sm" onClick={() => setContactOpen(true)}>
                Contact support
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Modal
        open={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.title ?? 'Article'}
      >
        {selectedArticle && (
          <div className="space-y-3 text-sm">
            <Badge tone="accent">{selectedArticle.categoryName}</Badge>
            <p className="text-secondary">{selectedArticle.summary}</p>
            <div className="whitespace-pre-wrap text-primary">{selectedArticle.body}</div>
          </div>
        )}
      </Modal>

      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="Contact support">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-success-600" />
            <p className="text-sm font-semibold text-primary">Ticket submitted</p>
            <Button variant="secondary" size="sm" onClick={() => { setSent(false); setContactOpen(false); navigate('support-tickets'); }}>
              View tickets
            </Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void submitContact(e)}>
            <div>
              <Label htmlFor="help-subject">Subject</Label>
              <Input id="help-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="help-priority">Priority</Label>
              <Select id="help-priority" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="help-details">Details</Label>
              <Textarea id="help-details" rows={5} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit ticket'}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
