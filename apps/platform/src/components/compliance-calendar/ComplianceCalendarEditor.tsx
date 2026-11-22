import { useEffect, useMemo, useState } from 'react';
import type {
  ComplianceDueDateRule,
  ComplianceEventCategory,
  ComplianceEventStatus,
  ComplianceEventView,
  ComplianceNoticeJobRunResult,
  ComplianceRecurrence,
  CountryConfigStatusView,
  CountrySummary,
  CreateComplianceEventInput,
  StateProvinceView,
  UpdateComplianceEventInput,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  Loader2,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  createComplianceEvent,
  deleteComplianceEvent,
  listComplianceEvents,
  runComplianceNoticeJob,
  updateComplianceEvent,
} from '@/lib/platform-countries-api';

interface ComplianceCalendarEditorProps {
  country: CountrySummary;
  states?: StateProvinceView[];
  completeness?: CountryConfigStatusView['tabs'][keyof CountryConfigStatusView['tabs']];
  onRefresh?: () => void;
}

const CATEGORY_BADGES: Record<
  ComplianceEventCategory,
  { label: string; bg: string; text: string; icon: any }
> = {
  tax_filing: {
    label: 'Tax Filing & Withholding',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: FileSpreadsheet,
  },
  labor_audit: {
    label: 'Labor Standards & Audit',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    text: 'text-indigo-700 dark:text-indigo-300',
    icon: Shield,
  },
  safety_inspection: {
    label: 'Workplace Safety & Inspection',
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    icon: ShieldAlert,
  },
  social_security_remittance: {
    label: 'Social Security Remittance',
    bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    icon: FileCheck,
  },
  annual_return: {
    label: 'Annual Statutory Return',
    bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    icon: Calendar,
  },
  corporate_filing: {
    label: 'Corporate Entity Filing',
    bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    icon: Building2,
  },
};

const RECURRENCE_LABELS: Record<ComplianceRecurrence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  fixed_date: 'Fixed Date',
};

const AVAILABLE_PLANS = ['starter', 'professional', 'enterprise'];

export function ComplianceCalendarEditor({
  country,
  states = [],
  onRefresh,
}: ComplianceCalendarEditorProps) {
  const [events, setEvents] = useState<ComplianceEventView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStateId, setSelectedStateId] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState<string>('all');

  // Add / Edit Modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ComplianceEventView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ComplianceEventCategory>('tax_filing');
  const [formDescription, setFormDescription] = useState('');
  const [formStateProvinceId, setFormStateProvinceId] = useState<string>('');
  const [formRecurrence, setFormRecurrence] = useState<ComplianceRecurrence>('monthly');
  const [formDayOfMonth, setFormDayOfMonth] = useState<number>(21);
  const [formMonth, setFormMonth] = useState<number>(12);
  const [formSpecificDate, setFormSpecificDate] = useState<string>('');
  const [formLastDayOfMonth, setFormLastDayOfMonth] = useState<boolean>(false);
  const [formNoticeDaysBefore, setFormNoticeDaysBefore] = useState<number>(14);
  const [formApplicablePlans, setFormApplicablePlans] = useState<string[]>([]);
  const [formCompanyType, setFormCompanyType] = useState<string>('');
  const [formSourceReference, setFormSourceReference] = useState<string>('');
  const [formActionRequired, setFormActionRequired] = useState<string>('');
  const [formPenaltiesSummary, setFormPenaltiesSummary] = useState<string>('');
  const [formFilingPortalUrl, setFormFilingPortalUrl] = useState<string>('');
  const [formStatus, setFormStatus] = useState<ComplianceEventStatus>('active');

  // Notice Job Modal
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [jobAsOfDate, setJobAsOfDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [isJobRunning, setIsJobRunning] = useState(false);
  const [jobResult, setJobResult] = useState<ComplianceNoticeJobRunResult | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Delete Action
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stateParam = selectedStateId === 'all' ? undefined : selectedStateId || undefined;
      const data = await listComplianceEvents(country.id, stateParam);
      setEvents(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load compliance events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [country.id, selectedStateId]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesDesc = ev.description.toLowerCase().includes(q);
        const matchesSource = ev.sourceReference.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesSource) return false;
      }
      if (categoryFilter !== 'all' && ev.category !== categoryFilter) {
        return false;
      }
      if (recurrenceFilter !== 'all' && ev.recurrence !== recurrenceFilter) {
        return false;
      }
      return true;
    });
  }, [events, searchQuery, categoryFilter, recurrenceFilter]);

  const resetForm = (eventToEdit?: ComplianceEventView | null) => {
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      setFormTitle(eventToEdit.title);
      setFormCategory(eventToEdit.category);
      setFormDescription(eventToEdit.description);
      setFormStateProvinceId(eventToEdit.stateProvinceId || '');
      setFormRecurrence(eventToEdit.recurrence);
      setFormDayOfMonth(eventToEdit.dueDateRule.dayOfMonth || 21);
      setFormMonth(eventToEdit.dueDateRule.month || 12);
      setFormSpecificDate(eventToEdit.dueDateRule.specificDate || '');
      setFormLastDayOfMonth(!!eventToEdit.dueDateRule.lastDayOfMonth);
      setFormNoticeDaysBefore(eventToEdit.noticeDaysBefore || 14);
      setFormApplicablePlans(eventToEdit.applicablePlans || []);
      setFormCompanyType(eventToEdit.companyType || '');
      setFormSourceReference(eventToEdit.sourceReference || '');
      setFormActionRequired(eventToEdit.actionRequired || '');
      setFormPenaltiesSummary(eventToEdit.penaltiesSummary || '');
      setFormFilingPortalUrl(eventToEdit.filingPortalUrl || '');
      setFormStatus(eventToEdit.status);
    } else {
      setEditingEvent(null);
      setFormTitle('');
      setFormCategory('tax_filing');
      setFormDescription('');
      setFormStateProvinceId(selectedStateId !== 'all' ? selectedStateId : '');
      setFormRecurrence('monthly');
      setFormDayOfMonth(21);
      setFormMonth(12);
      setFormSpecificDate('');
      setFormLastDayOfMonth(false);
      setFormNoticeDaysBefore(14);
      setFormApplicablePlans([]);
      setFormCompanyType('');
      setFormSourceReference('');
      setFormActionRequired('');
      setFormPenaltiesSummary('');
      setFormFilingPortalUrl('');
      setFormStatus('active');
    }
    setFormError(null);
  };

  const handleOpenAdd = () => {
    resetForm(null);
    setIsEventModalOpen(true);
  };

  const handleOpenEdit = (event: ComplianceEventView) => {
    resetForm(event);
    setIsEventModalOpen(true);
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Event title is required');
      return;
    }
    if (!formSourceReference.trim()) {
      setFormError('Source reference (statutory law/section) is required');
      return;
    }

    const dueDateRule: ComplianceDueDateRule = {};
    if (formRecurrence === 'monthly') {
      if (formLastDayOfMonth) {
        dueDateRule.lastDayOfMonth = true;
      } else {
        dueDateRule.dayOfMonth = Number(formDayOfMonth);
      }
    } else if (formRecurrence === 'quarterly') {
      dueDateRule.dayOfMonth = Number(formDayOfMonth);
      dueDateRule.quarterMonthOffsets = [1, 4, 7, 10];
    } else if (formRecurrence === 'yearly') {
      dueDateRule.month = Number(formMonth);
      if (formLastDayOfMonth) {
        dueDateRule.lastDayOfMonth = true;
      } else {
        dueDateRule.dayOfMonth = Number(formDayOfMonth);
      }
    } else if (formRecurrence === 'fixed_date') {
      if (!formSpecificDate) {
        setFormError('Fixed date (YYYY-MM-DD) is required for fixed_date recurrence');
        return;
      }
      dueDateRule.specificDate = formSpecificDate;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingEvent) {
        const updateInput: UpdateComplianceEventInput = {
          title: formTitle.trim(),
          category: formCategory,
          description: formDescription.trim(),
          stateProvinceId: formStateProvinceId || null,
          recurrence: formRecurrence,
          dueDateRule,
          noticeDaysBefore: Number(formNoticeDaysBefore),
          applicablePlans: formApplicablePlans,
          companyType: formCompanyType.trim() || null,
          sourceReference: formSourceReference.trim(),
          actionRequired: formActionRequired.trim() || null,
          penaltiesSummary: formPenaltiesSummary.trim() || null,
          filingPortalUrl: formFilingPortalUrl.trim() || null,
          status: formStatus,
        };
        await updateComplianceEvent(editingEvent.id, updateInput);
      } else {
        const createInput: CreateComplianceEventInput = {
          title: formTitle.trim(),
          category: formCategory,
          description: formDescription.trim(),
          stateProvinceId: formStateProvinceId || null,
          recurrence: formRecurrence,
          dueDateRule,
          noticeDaysBefore: Number(formNoticeDaysBefore),
          applicablePlans: formApplicablePlans,
          companyType: formCompanyType.trim() || null,
          sourceReference: formSourceReference.trim(),
          actionRequired: formActionRequired.trim() || null,
          penaltiesSummary: formPenaltiesSummary.trim() || null,
          filingPortalUrl: formFilingPortalUrl.trim() || null,
          status: formStatus,
        };
        await createComplianceEvent(country.id, createInput);
      }

      setIsEventModalOpen(false);
      await fetchEvents();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save compliance event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this compliance event? Existing notices will be preserved for audit.')) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteComplianceEvent(id);
      await fetchEvents();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete compliance event');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRunNoticeJob = async () => {
    setIsJobRunning(true);
    setJobError(null);
    try {
      const result = await runComplianceNoticeJob({
        asOfDate: jobAsOfDate,
        countryId: country.id,
      });
      setJobResult(result);
      await fetchEvents();
    } catch (err: any) {
      setJobError(err?.message || 'Failed to execute compliance notice job');
    } finally {
      setIsJobRunning(false);
    }
  };

  const togglePlan = (plan: string) => {
    setFormApplicablePlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan],
    );
  };

  const upcomingCount = events.filter((e) => e.isNoticeWindowActive).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Card */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                  MODULES.md §02
                </span>
                <span className="text-xs font-semibold text-slate-400">•</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Compliance Calendar Engine
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                Statutory Compliance Calendar & Tenant Notice Engine
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Configure country and state statutory events (tax filings, labor audits, safety inspections).
                Automated scheduler evaluates upcoming due dates and broadcasts advance notices to tenant inboxes via Notification Engine (Phase 1 Stage 9) $N$ days before due date.
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setJobResult(null);
                setJobError(null);
                setIsJobModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
              <span>Test Notice Job</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-indigo-100 dark:border-slate-800">
          <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 border border-indigo-100 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 block">Total Events</span>
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {events.length}
            </span>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 border border-indigo-100 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 block">Active Notice Window</span>
            <span className={`text-lg font-black ${upcomingCount > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
              {upcomingCount} Due Soon
            </span>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 border border-indigo-100 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 block">Jurisdiction Level</span>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
              {country.name} ({country.isoCode})
            </span>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 border border-indigo-100 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 block">Auto-Job Schedule</span>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5" />
              Daily 06:00 UTC
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, law reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {states.length > 0 && (
            <select
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All States / Federal</option>
              {states.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          )}

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="tax_filing">Tax Filing & Withholding</option>
            <option value="labor_audit">Labor Standards & Audit</option>
            <option value="safety_inspection">Workplace Safety</option>
            <option value="social_security_remittance">Social Security Remittance</option>
            <option value="annual_return">Annual Return</option>
            <option value="corporate_filing">Corporate Filing</option>
          </select>

          <select
            value={recurrenceFilter}
            onChange={(e) => setRecurrenceFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Recurrences</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="fixed_date">Fixed Date</option>
          </select>
        </div>

        <button
          onClick={fetchEvents}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-4 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Events Listing */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
            Loading statutory compliance events...
          </p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <CalendarClock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No compliance events found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {searchQuery || categoryFilter !== 'all' || recurrenceFilter !== 'all'
              ? 'Try adjusting your filters or search keywords.'
              : 'Add statutory tax, safety, or audit deadlines for this jurisdiction.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Compliance Event</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((ev) => {
            const catBadge = CATEGORY_BADGES[ev.category];
            const IconComponent = catBadge.icon;
            const isDeleting = deletingId === ev.id;

            return (
              <div
                key={ev.id}
                className={`rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md ${
                  ev.isNoticeWindowActive
                    ? 'border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Card Header */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${catBadge.bg} ${catBadge.text}`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                        <span>{catBadge.label}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {RECURRENCE_LABELS[ev.recurrence]}
                      </span>

                      {ev.stateProvinceCode ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <MapPin className="w-2.5 h-2.5" />
                          {ev.stateProvinceCode}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-400">
                          Federal / National
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(ev)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Event"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Delete Event"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {ev.description}
                    </p>
                  </div>

                  {/* Due Date & Notice Banner */}
                  <div
                    className={`rounded-xl p-3 flex items-center justify-between gap-3 text-xs border ${
                      ev.isNoticeWindowActive
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <span className="font-semibold block">Next Statutory Deadline</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {ev.nextDueDate}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] block text-slate-400">Countdown</span>
                      <span
                        className={`font-black font-mono ${
                          ev.daysUntilDue <= ev.noticeDaysBefore
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {ev.daysUntilDue} days remaining
                      </span>
                    </div>
                  </div>

                  {/* Rule Details Breakdown */}
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <div>
                      <span className="font-semibold text-slate-400 block">Due Date Rule:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {ev.recurrence === 'monthly' &&
                          (ev.dueDateRule.lastDayOfMonth
                            ? 'Last day of month'
                            : `${ev.dueDateRule.dayOfMonth}th of each month`)}
                        {ev.recurrence === 'quarterly' &&
                          `Quarterly (${ev.dueDateRule.dayOfMonth}th of Jan, Apr, Jul, Oct)`}
                        {ev.recurrence === 'yearly' &&
                          `${ev.dueDateRule.dayOfMonth || 'End of'} Month ${ev.dueDateRule.month}`}
                        {ev.recurrence === 'fixed_date' &&
                          `Fixed: ${ev.dueDateRule.specificDate}`}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block">Notice Advance:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {ev.noticeDaysBefore} days before deadline
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block">Statutory Reference:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1">
                        {ev.sourceReference}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block">Applicable Plans:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {ev.applicablePlans.length > 0
                          ? ev.applicablePlans.join(', ')
                          : 'All Tenant Plans'}
                      </span>
                    </div>
                  </div>

                  {/* Penalties & Portals */}
                  {(ev.penaltiesSummary || ev.filingPortalUrl) && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      {ev.penaltiesSummary ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium line-clamp-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {ev.penaltiesSummary}
                        </span>
                      ) : <span />}

                      {ev.filingPortalUrl && (
                        <a
                          href={ev.filingPortalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                        >
                          <span>Gov Portal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. ADD / EDIT COMPLIANCE EVENT MODAL */}
      <Modal
        open={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title={editingEvent ? 'Edit Statutory Compliance Event' : 'Add Statutory Compliance Event'}
      >
        <form onSubmit={handleSubmitEvent} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-3 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Monthly PAYG Withholding Statement (IAS)"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ComplianceEventCategory)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="tax_filing">Tax Filing & Withholding</option>
                <option value="labor_audit">Labor Standards & Audit</option>
                <option value="safety_inspection">Workplace Safety & Inspection</option>
                <option value="social_security_remittance">Social Security Remittance</option>
                <option value="annual_return">Annual Statutory Return</option>
                <option value="corporate_filing">Corporate Entity Filing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                State / Province (Optional)
              </label>
              <select
                value={formStateProvinceId}
                onChange={(e) => setFormStateProvinceId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Federal / National (All States)</option>
                {states.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Explain statutory requirement, scope, and obligations..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Recurrence & Due Date Rule */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Recurrence & Due Date Rule</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Recurrence
                </label>
                <select
                  value={formRecurrence}
                  onChange={(e) => setFormRecurrence(e.target.value as ComplianceRecurrence)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="monthly">Monthly Cycle</option>
                  <option value="quarterly">Quarterly Cycle</option>
                  <option value="yearly">Yearly Cycle</option>
                  <option value="fixed_date">Fixed Date</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Advance Notice Window (N days before) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={formNoticeDaysBefore}
                  onChange={(e) => setFormNoticeDaysBefore(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Recurrence-specific Inputs */}
            {formRecurrence === 'monthly' && (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Day of the Month (1-31)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    disabled={formLastDayOfMonth}
                    value={formDayOfMonth}
                    onChange={(e) => setFormDayOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <label className="flex items-center gap-2 mt-4 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formLastDayOfMonth}
                    onChange={(e) => setFormLastDayOfMonth(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Last day of month</span>
                </label>
              </div>
            )}

            {formRecurrence === 'quarterly' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Due Day of Target Quarter Month (1-31)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formDayOfMonth}
                  onChange={(e) => setFormDayOfMonth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Quarterly cycle defaults to Jan, Apr, Jul, Oct 28th (e.g. Australian BAS).
                </span>
              </div>
            )}

            {formRecurrence === 'yearly' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Month of Year (1-12)
                  </label>
                  <select
                    value={formMonth}
                    onChange={(e) => setFormMonth(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  >
                    {[
                      'January',
                      'February',
                      'March',
                      'April',
                      'May',
                      'June',
                      'July',
                      'August',
                      'September',
                      'October',
                      'November',
                      'December',
                    ].map((mName, idx) => (
                      <option key={mName} value={idx + 1}>
                        {mName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Day of Month
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formDayOfMonth}
                    onChange={(e) => setFormDayOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {formRecurrence === 'fixed_date' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Specific Statutory Date (YYYY-MM-DD) *
                </label>
                <input
                  type="date"
                  required
                  value={formSpecificDate}
                  onChange={(e) => setFormSpecificDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Statutory References & Legal Requirements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Source Reference (Act / Tax Section) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tax Administration Act 1953 Sch 1"
                value={formSourceReference}
                onChange={(e) => setFormSourceReference(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Company Type Filter (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Pty Ltd, LLC, Corporation (or blank for all)"
                value={formCompanyType}
                onChange={(e) => setFormCompanyType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Applicable Plans (Leave empty to apply to all tenant subscription plans)
            </label>
            <div className="flex items-center gap-2">
              {AVAILABLE_PLANS.map((plan) => (
                <button
                  type="button"
                  key={plan}
                  onClick={() => togglePlan(plan)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize border transition-all ${
                    formApplicablePlans.includes(plan)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {plan}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Action Required Checklist
            </label>
            <input
              type="text"
              placeholder="e.g. Reconcile monthly withholdings in Payroll and lodge IAS statement"
              value={formActionRequired}
              onChange={(e) => setFormActionRequired(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Penalties Summary
              </label>
              <input
                type="text"
                placeholder="e.g. Fines of up to $2,500 + statutory interest"
                value={formPenaltiesSummary}
                onChange={(e) => setFormPenaltiesSummary(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Filing Portal URL
              </label>
              <input
                type="url"
                placeholder="https://ato.gov.au/business-portal"
                value={formFilingPortalUrl}
                onChange={(e) => setFormFilingPortalUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEventModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editingEvent ? 'Update Event' : 'Create Event'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. NOTICE GENERATION JOB MODAL */}
      <Modal
        open={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        title="Test Compliance Notice Job (Phase 1 Stage 9)"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3.5 text-xs text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-2 font-bold mb-1">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span>Automated Background Job Simulation</span>
            </div>
            <p className="leading-relaxed text-[11px] text-indigo-700 dark:text-indigo-300">
              The compliance notification job evaluates all active statutory events in {country.name}.
              If the target date is within $N$ days of due date, it generates notices for matching tenants and broadcasts notifications via the Notification Engine.
              <strong> Idempotency is guaranteed:</strong> running repeatedly on the same date will skip previously dispatched notices without duplicates.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Authoritative As-Of Evaluation Date
            </label>
            <input
              type="date"
              value={jobAsOfDate}
              onChange={(e) => setJobAsOfDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Target Jurisdiction: <strong>{country.name}</strong>
            </span>
            <button
              onClick={handleRunNoticeJob}
              disabled={isJobRunning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition-all"
            >
              {isJobRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Notices...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Execute Job Run</span>
                </>
              )}
            </button>
          </div>

          {jobError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-3 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{jobError}</span>
            </div>
          )}

          {jobResult && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-semibold text-slate-500 block">Scanned Events</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {jobResult.scannedEventsCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-semibold text-slate-500 block">Eligible Tenants</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {jobResult.eligibleTenantsCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] font-semibold text-emerald-600 block">Notices Dispatched</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                    {jobResult.noticesGeneratedCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] font-semibold text-amber-600 block">Skipped Idempotent</span>
                  <span className="text-sm font-black text-amber-700 dark:text-amber-300">
                    {jobResult.skippedExistingCount}
                  </span>
                </div>
              </div>

              {jobResult.generatedNotices.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                    Dispatched Tenant Notices ({jobResult.generatedNotices.length})
                  </h5>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {jobResult.generatedNotices.map((n, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {n.tenantName} ({n.companyName})
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {n.eventTitle}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold block">
                            Due {n.dueDate}
                          </span>
                          <span className="text-[10px] text-amber-600 font-semibold">
                            {n.daysRemaining} days remaining
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
