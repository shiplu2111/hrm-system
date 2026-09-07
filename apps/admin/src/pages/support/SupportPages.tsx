import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  MessageSquare,
  Plus,
  Ticket,
} from 'lucide-react';
import type {
  KbCategoryRecord,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@hrm/shared-types';
import {
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
} from '@/lib/support-labels';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  addSupportTicketMessage,
  createKbArticle,
  createKbCategory,
  deleteKbArticle,
  getSupportTicket,
  listKbArticles,
  listKbCategories,
  listSupportTickets,
  updateKbArticle,
  updateSupportTicket,
} from '@/lib/support-api';
import { ApiError } from '@/lib/tenant-api-client';

export function KnowledgeBaseAdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<KbCategoryRecord[]>([]);
  const [articles, setArticles] = useState<
    Awaited<ReturnType<typeof listKbArticles>>
  >([]);
  const [categoryModal, setCategoryModal] = useState(false);
  const [articleModal, setArticleModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleCategoryId, setArticleCategoryId] = useState('');
  const [articleSummary, setArticleSummary] = useState('');
  const [articleBody, setArticleBody] = useState('');
  const [articlePublished, setArticlePublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, arts] = await Promise.all([
        listKbCategories(),
        listKbArticles(),
      ]);
      setCategories(cats);
      setArticles(arts);
      if (cats[0] && !articleCategoryId) {
        setArticleCategoryId(cats[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }, [articleCategoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) return;
    setSaving(true);
    try {
      await createKbCategory({ name: categoryName.trim() });
      setCategoryName('');
      setCategoryModal(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateArticle = async () => {
    if (!articleTitle.trim() || !articleCategoryId) return;
    setSaving(true);
    try {
      await createKbArticle({
        categoryId: articleCategoryId,
        title: articleTitle.trim(),
        summary: articleSummary.trim() || articleTitle.trim(),
        body: articleBody.trim() || articleSummary.trim(),
        published: articlePublished,
      });
      setArticleTitle('');
      setArticleSummary('');
      setArticleBody('');
      setArticleModal(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create article');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (articleId: string, published: boolean) => {
    try {
      await updateKbArticle(articleId, { published: !published });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update article');
    }
  };

  const handleDelete = async (articleId: string) => {
    if (!window.confirm('Delete this article?')) return;
    try {
      await deleteKbArticle(articleId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete article');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Knowledge Base</h1>
          <p className="text-sm text-secondary">
            Create and publish help articles for admins and employees.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCategoryModal(true)}>
            <Plus className="h-3.5 w-3.5" /> Category
          </Button>
          <Button variant="primary" size="sm" onClick={() => setArticleModal(true)}>
            <Plus className="h-3.5 w-3.5" /> Article
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Categories ({categories.length})</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Badge key={cat.id} tone="accent">
              {cat.name} · {cat.articleCount ?? 0}
            </Badge>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-secondary">No categories yet.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Articles ({articles.length})</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="divide-y divide-[rgb(var(--border-base))]">
            {articles.map((article) => (
              <div
                key={article.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-primary">{article.title}</p>
                    <Badge tone={article.published ? 'success' : 'neutral'}>
                      {article.published ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-secondary">{article.categoryName}</p>
                  <p className="mt-1 text-sm text-muted">{article.summary}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void togglePublished(article.id, article.published)}
                  >
                    {article.published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDelete(article.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {articles.length === 0 && (
              <p className="p-6 text-center text-sm text-secondary">No articles yet.</p>
            )}
          </div>
        </CardBody>
      </Card>

      <Modal open={categoryModal} onClose={() => setCategoryModal(false)} title="New category">
        <div className="space-y-3">
          <div>
            <Label htmlFor="kb-cat-name">Name</Label>
            <Input
              id="kb-cat-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </div>
          <Button variant="primary" disabled={saving} onClick={() => void handleCreateCategory()}>
            {saving ? 'Saving…' : 'Create category'}
          </Button>
        </div>
      </Modal>

      <Modal open={articleModal} onClose={() => setArticleModal(false)} title="New article">
        <div className="space-y-3">
          <div>
            <Label htmlFor="kb-art-title">Title</Label>
            <Input
              id="kb-art-title"
              value={articleTitle}
              onChange={(e) => setArticleTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="kb-art-cat">Category</Label>
            <Select
              id="kb-art-cat"
              value={articleCategoryId}
              onChange={(e) => setArticleCategoryId(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="kb-art-summary">Summary</Label>
            <Textarea
              id="kb-art-summary"
              rows={2}
              value={articleSummary}
              onChange={(e) => setArticleSummary(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="kb-art-body">Body</Label>
            <Textarea
              id="kb-art-body"
              rows={6}
              value={articleBody}
              onChange={(e) => setArticleBody(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={articlePublished}
              onChange={(e) => setArticlePublished(e.target.checked)}
            />
            Publish immediately
          </label>
          <Button variant="primary" disabled={saving} onClick={() => void handleCreateArticle()}>
            {saving ? 'Saving…' : 'Create article'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

const statusTone: Record<
  SupportTicketStatus,
  'neutral' | 'accent' | 'warning' | 'success'
> = {
  open: 'accent',
  in_progress: 'warning',
  waiting: 'neutral',
  resolved: 'success',
  closed: 'neutral',
};

export function SupportTicketsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<
    Awaited<ReturnType<typeof listSupportTickets>>
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<
    Awaited<ReturnType<typeof getSupportTicket>> | null
  >(null);
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSupportTickets();
      setTickets(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const openTicket = async (ticketId: string) => {
    setSelectedId(ticketId);
    try {
      const row = await getSupportTicket(ticketId);
      setDetail(row);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load ticket');
    }
  };

  const updateStatus = async (status: SupportTicketStatus) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateSupportTicket(selectedId, { status });
      await openTicket(selectedId);
      await loadTickets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update ticket');
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSaving(true);
    try {
      const updated = await addSupportTicketMessage(selectedId, {
        body: reply.trim(),
        isInternal: internalNote,
      });
      setDetail(updated);
      setReply('');
      await loadTickets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send reply');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-bold text-primary">Support Tickets</h1>
        <p className="text-sm text-secondary">
          Tenant help requests from admins and employees.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-4 w-4" /> Queue ({tickets.length})
            </CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))] p-0">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => void openTicket(ticket.id)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-[rgb(var(--bg-hover))] ${
                  selectedId === ticket.id ? 'bg-accent-50/60 dark:bg-accent-950/20' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted">{ticket.ticketNumber}</span>
                  <Badge tone={statusTone[ticket.status]}>
                    {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-primary">{ticket.subject}</p>
                <p className="mt-1 text-xs text-secondary">
                  {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority as SupportTicketPriority]} ·{' '}
                  {new Date(ticket.updatedAt).toLocaleString()}
                </p>
              </button>
            ))}
            {tickets.length === 0 && (
              <p className="p-6 text-center text-sm text-secondary">No tickets yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Ticket detail
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {!detail ? (
              <p className="text-sm text-secondary">Select a ticket from the queue.</p>
            ) : (
              <>
                <div>
                  <p className="font-mono text-xs text-muted">{detail.ticketNumber}</p>
                  <h2 className="text-lg font-semibold text-primary">{detail.subject}</h2>
                  <p className="mt-2 text-sm text-secondary whitespace-pre-wrap">
                    {detail.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['in_progress', 'waiting', 'resolved'] as SupportTicketStatus[]).map(
                    (status) => (
                      <Button
                        key={status}
                        variant="secondary"
                        size="sm"
                        disabled={saving || detail.status === status}
                        onClick={() => void updateStatus(status)}
                      >
                        {SUPPORT_TICKET_STATUS_LABELS[status]}
                      </Button>
                    ),
                  )}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        message.isInternal
                          ? 'border-warning-200 bg-warning-50/50'
                          : 'border-base bg-[rgb(var(--bg-muted))]/40'
                      }`}
                    >
                      {message.isInternal && (
                        <Badge tone="warning" className="mb-1">
                          Internal
                        </Badge>
                      )}
                      <p className="whitespace-pre-wrap text-primary">{message.body}</p>
                      <p className="mt-1 text-[10px] text-muted">
                        {new Date(message.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-base pt-4">
                  <Textarea
                    rows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to requester…"
                  />
                  <label className="flex items-center gap-2 text-xs text-secondary">
                    <input
                      type="checkbox"
                      checked={internalNote}
                      onChange={(e) => setInternalNote(e.target.checked)}
                    />
                    Internal note (not visible to employee)
                  </label>
                  <Button variant="primary" size="sm" disabled={saving} onClick={() => void sendReply()}>
                    Send reply
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
