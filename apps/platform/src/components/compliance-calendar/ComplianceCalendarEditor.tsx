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
  PreviewComplianceNoticeTenantsInput,
  StateProvinceView,
  UpdateComplianceEventInput,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  List,
  Loader2,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Table as TableIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  createComplianceEvent,
  deleteComplianceEvent,
  listComplianceEvents,
  retireComplianceEvent,
  runComplianceNoticeJob,
  updateComplianceEvent,
} from '@/lib/platform-countries-api';
import { TenantNoticePreviewModal } from './TenantNoticePreviewModal';

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
  statutory_reporting: {
    label: 'Statutory Reporting',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
    text: 'text-cyan-700 dark:text-cyan-300',
    icon: FileText,
  },
  license_renewal: {
    label: 'License & Permit Renewal',
    bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
    icon: Shield,
  },
  general: {
    label: 'General Compliance',
    bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    icon: CalendarClock,
  },
};

const RECURRENCE_LABELS: Record<ComplianceRecurrence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  fixed_date: 'Fixed Date',
};

const MONTH_NAMES = [
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
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const AVAILABLE_PLANS = ['starter', 'professional', 'enterprise'];

export function ComplianceCalendarEditor({
  country,
  states = [],
  onRefresh,
}: ComplianceCalendarEditorProps) {
  const [events, setEvents] = useState<ComplianceEventView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'month' or 'list'
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');

  // Month View State
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState<number>(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(today.getMonth()); // 0-11

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStateId, setSelectedStateId] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');

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

  // Tenant Preview Modal
  const [previewEvent, setPreviewEvent] = useState<ComplianceEventView | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [draftPreviewInput, setDraftPreviewInput] = useState<PreviewComplianceNoticeTenantsInput | null>(null);

  // Notice Job Modal
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [jobAsOfDate, setJobAsOfDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [isJobRunning, setIsJobRunning] = useState(false);
  const [jobResult, setJobResult] = useState<ComplianceNoticeJobRunResult | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Quick Action feedback
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);

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

  // Flash message timeout
  useEffect(() => {
    if (!actionSuccessMsg) return;
    const t = setTimeout(() => setActionSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [actionSuccessMsg]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesDesc = (ev.description || '').toLowerCase().includes(q);
        const matchesSource = (ev.sourceReference || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesSource) return false;
      }
      if (statusFilter !== 'all' && ev.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && ev.category !== categoryFilter) {
        return false;
      }
      if (recurrenceFilter !== 'all' && ev.recurrence !== recurrenceFilter) {
        return false;
      }
      return true;
    });
  }, [events, searchQuery, statusFilter, categoryFilter, recurrenceFilter]);

  // Calendar Days Calculation for Month View
  const calendarDays = useMemo(() => {
    const totalDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7; // Monday = 0
    const prevMonthDays = new Date(calendarYear, calendarMonth, 0).getDate();

    const days: Array<{
      dateNumber: number;
      isCurrentMonth: boolean;
      fullDateStr: string;
      events: ComplianceEventView[];
    }> = [];

    // Pad previous month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const m = calendarMonth === 0 ? 11 : calendarMonth - 1;
      const y = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dateNumber: dNum,
        isCurrentMonth: false,
        fullDateStr: dStr,
        events: [],
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      // Find events matching this day in this month
      const matchingEvents = filteredEvents.filter((ev) => {
        if (ev.status === 'archived' && statusFilter === 'active') return false;

        const rule = ev.dueDateRule || {};
        if (ev.recurrence === 'monthly') {
          if (rule.lastDayOfMonth) {
            return d === totalDaysInMonth;
          }
          const targetDay = rule.dayOfMonth || 21;
          const clampedDay = Math.min(targetDay, totalDaysInMonth);
          return d === clampedDay;
        }

        if (ev.recurrence === 'quarterly') {
          const offsets = rule.quarterMonthOffsets?.length ? rule.quarterMonthOffsets : [1, 4, 7, 10];
          const isQuarterMonth = offsets.includes(calendarMonth + 1);
          if (!isQuarterMonth) return false;
          if (rule.lastDayOfMonth) {
            return d === totalDaysInMonth;
          }
          const targetDay = rule.dayOfMonth || 28;
          const clampedDay = Math.min(targetDay, totalDaysInMonth);
          return d === clampedDay;
        }

        if (ev.recurrence === 'yearly') {
          const targetMonth = rule.month || 12;
          if (calendarMonth + 1 !== targetMonth) return false;
          if (rule.lastDayOfMonth) {
            return d === totalDaysInMonth;
          }
          const targetDay = rule.dayOfMonth || 31;
          const clampedDay = Math.min(targetDay, totalDaysInMonth);
          return d === clampedDay;
        }

        if (ev.recurrence === 'fixed_date') {
          return rule.specificDate === dStr;
        }

        return false;
      });

      days.push({
        dateNumber: d,
        isCurrentMonth: true,
        fullDateStr: dStr,
        events: matchingEvents,
      });
    }

    // Pad remaining trailing days to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
      const m = calendarMonth === 11 ? 0 : calendarMonth + 1;
      const y = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
      days.push({
        dateNumber: j,
        isCurrentMonth: false,
        fullDateStr: dStr,
        events: [],
      });
    }

    return days;
  }, [calendarYear, calendarMonth, filteredEvents, statusFilter]);

  // Events occurring in current month
  const currentMonthEvents = useMemo(() => {
    return calendarDays
      .filter((d) => d.isCurrentMonth && d.events.length > 0)
      .flatMap((d) => d.events.map((ev) => ({ event: ev, dateStr: d.fullDateStr, dayNum: d.dateNumber })));
  }, [calendarDays]);

  const resetForm = (eventToEdit?: ComplianceEventView | null, prefillDay?: number) => {
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      setFormTitle(eventToEdit.title);
      setFormCategory(eventToEdit.category);
      setFormDescription(eventToEdit.description || '');
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
      setFormDayOfMonth(prefillDay || 21);
      setFormMonth(calendarMonth + 1);
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

  const handleOpenAdd = (prefillDay?: number) => {
    resetForm(null, prefillDay);
    setIsEventModalOpen(true);
  };

  const handleOpenEdit = (event: ComplianceEventView) => {
    resetForm(event);
    setIsEventModalOpen(true);
  };

  const handleOpenTenantPreview = (event: ComplianceEventView) => {
    setPreviewEvent(event);
    setDraftPreviewInput(null);
    setIsPreviewModalOpen(true);
  };

  const handleOpenDraftPreview = () => {
    const dueDateRule: ComplianceDueDateRule = {};
    if (formRecurrence === 'monthly') {
      if (formLastDayOfMonth) dueDateRule.lastDayOfMonth = true;
      else dueDateRule.dayOfMonth = Number(formDayOfMonth);
    } else if (formRecurrence === 'quarterly') {
      dueDateRule.dayOfMonth = Number(formDayOfMonth);
      dueDateRule.quarterMonthOffsets = [1, 4, 7, 10];
    } else if (formRecurrence === 'yearly') {
      dueDateRule.month = Number(formMonth);
      if (formLastDayOfMonth) dueDateRule.lastDayOfMonth = true;
      else dueDateRule.dayOfMonth = Number(formDayOfMonth);
    } else if (formRecurrence === 'fixed_date') {
      dueDateRule.specificDate = formSpecificDate;
    }

    setPreviewEvent(null);
    setDraftPreviewInput({
      countryId: country.id,
      stateProvinceId: formStateProvinceId || null,
      category: formCategory,
      recurrence: formRecurrence,
      dueDateRule,
      applicablePlans: formApplicablePlans,
      companyType: formCompanyType.trim() || null,
      noticeDaysBefore: Number(formNoticeDaysBefore),
    });
    setIsPreviewModalOpen(true);
  };

  const handleRetireToggle = async (event: ComplianceEventView) => {
    const isRetiring = event.status !== 'archived';
    const confirmPrompt = isRetiring
      ? `Retire statutory event "${event.title}"? Automated notices will be paused.`
      : `Reactivate statutory event "${event.title}"? Automated notices will resume.`;

    if (!window.confirm(confirmPrompt)) return;

    setRetiringId(event.id);
    try {
      await retireComplianceEvent(event.id, isRetiring);
      setActionSuccessMsg(
        isRetiring
          ? `Event "${event.title}" has been retired. Automated notices are paused.`
          : `Event "${event.title}" has been reactivated.`,
      );
      await fetchEvents();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to update event status');
    } finally {
      setRetiringId(null);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (
      !window.confirm(
        'Permanently delete this compliance event? Historical notices will remain for statutory audit.',
      )
    ) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteComplianceEvent(id);
      setActionSuccessMsg('Compliance event deleted successfully.');
      await fetchEvents();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete compliance event');
    } finally {
      setDeletingId(null);
    }
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
      if (formLastDayOfMonth) dueDateRule.lastDayOfMonth = true;
      else dueDateRule.dayOfMonth = Number(formDayOfMonth);
    } else if (formRecurrence === 'quarterly') {
      dueDateRule.dayOfMonth = Number(formDayOfMonth);
      dueDateRule.quarterMonthOffsets = [1, 4, 7, 10];
    } else if (formRecurrence === 'yearly') {
      dueDateRule.month = Number(formMonth);
      if (formLastDayOfMonth) dueDateRule.lastDayOfMonth = true;
      else dueDateRule.dayOfMonth = Number(formDayOfMonth);
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
        setActionSuccessMsg(`Event "${formTitle}" updated successfully.`);
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
        setActionSuccessMsg(`Event "${formTitle}" created successfully.`);
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

  const prevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setCalendarYear(today.getFullYear());
    setCalendarMonth(today.getMonth());
  };

  const activeCount = events.filter((e) => e.status === 'active').length;
  const retiredCount = events.filter((e) => e.status === 'archived').length;
  const upcomingCount = events.filter((e) => e.isNoticeWindowActive).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Card */}
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
                Track statutory payroll tax lodgements, labor returns, and workplace inspections for {country.name}.
                Preview matching tenants, mark obsolete rules retired, and dispatch automated advance notices via Notification Engine (Phase 1 Stage 9).
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Switcher Tabs */}
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'month'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Month Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>

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
              onClick={() => handleOpenAdd()}
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
            <span className="text-[11px] font-semibold text-slate-500 block">Active Statutory Events</span>
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {activeCount} active
            </span>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 border border-indigo-100 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 block">Notice Window Active</span>
            <span className={`text-lg font-black ${upcomingCount > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
              {upcomingCount} Due Soon
            </span>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 border border-indigo-100 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 block">Retired Events</span>
            <span className="text-lg font-black text-slate-500 dark:text-slate-400">
              {retiredCount} retired
            </span>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3 border border-indigo-100 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 block">Automated Dispatch</span>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5" />
              Daily 06:00 UTC
            </span>
          </div>
        </div>
      </div>

      {/* 2. Success Alert Message */}
      {actionSuccessMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-3 flex items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)}>
            <X className="w-3.5 h-3.5 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {/* 3. Filters & Month Navigation Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, law reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* State / Province Filter */}
          {states.length > 0 && (
            <select
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All States / Federal</option>
              {states.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="active">Active Events Only</option>
            <option value="archived">Retired Events Only</option>
            <option value="all">All Statuses</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="tax_filing">Tax Filing & Withholding</option>
            <option value="labor_audit">Labor Standards & Audit</option>
            <option value="safety_inspection">Workplace Safety</option>
            <option value="social_security_remittance">Social Security Remittance</option>
            <option value="annual_return">Annual Return</option>
            <option value="corporate_filing">Corporate Filing</option>
          </select>

          {/* Recurrence Filter */}
          <select
            value={recurrenceFilter}
            onChange={(e) => setRecurrenceFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Recurrences</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="fixed_date">Fixed Date</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchEvents}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4. Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-4 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 5. VIEW A: MONTH CALENDAR VIEW */}
      {viewMode === 'month' && (
        <div className="space-y-4">
          {/* Month & Year Navigation Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{MONTH_NAMES[calendarMonth]}</span>
                <span className="text-indigo-600 dark:text-indigo-400">{calendarYear}</span>
              </h3>

              <button
                type="button"
                onClick={goToToday}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={calendarYear}
                onChange={(e) => setCalendarYear(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider py-2.5">
              {DAYS_OF_WEEK.map((dName) => (
                <div key={dName}>{dName}</div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
              {calendarDays.map((day, idx) => {
                const isToday =
                  day.isCurrentMonth &&
                  day.dateNumber === today.getDate() &&
                  calendarMonth === today.getMonth() &&
                  calendarYear === today.getFullYear();

                return (
                  <div
                    key={`${day.fullDateStr}-${idx}`}
                    className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors group relative ${
                      day.isCurrentMonth
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        : 'bg-slate-50/50 dark:bg-slate-950/40 text-slate-300 dark:text-slate-600'
                    }`}
                  >
                    {/* Date Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-black inline-flex items-center justify-center h-6 w-6 rounded-full ${
                          isToday
                            ? 'bg-indigo-600 text-white font-bold'
                            : day.isCurrentMonth
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {day.dateNumber}
                      </span>

                      {/* Quick Add Button on Hover for Current Month */}
                      {day.isCurrentMonth && (
                        <button
                          type="button"
                          onClick={() => handleOpenAdd(day.dateNumber)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                          title={`Add event on ${day.fullDateStr}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Events List on this Day */}
                    <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px] pr-0.5">
                      {day.events.map((ev) => {
                        const badgeInfo = CATEGORY_BADGES[ev.category] || CATEGORY_BADGES.general;
                        const isRetired = ev.status === 'archived';

                        return (
                          <div
                            key={ev.id}
                            className={`group/item rounded-lg p-1.5 border text-[11px] leading-tight transition shadow-xs ${
                              isRetired
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                                : `${badgeInfo.bg} ${badgeInfo.text}`
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-bold truncate block">{ev.title}</span>
                            </div>

                            <div className="flex items-center justify-between gap-1 mt-1 text-[9px] opacity-80">
                              <span className="uppercase font-semibold tracking-wider">
                                {ev.recurrence}
                              </span>

                              {/* Interactive actions */}
                              <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenTenantPreview(ev);
                                  }}
                                  className="hover:text-indigo-600"
                                  title="Preview Notified Tenants"
                                >
                                  <Users className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(ev);
                                  }}
                                  className="hover:text-slate-900 dark:hover:text-white"
                                  title="Edit Event"
                                >
                                  <FileText className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agenda of this Month */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>
                  Statutory Deadlines Agenda for {MONTH_NAMES[calendarMonth]} {calendarYear} ({currentMonthEvents.length})
                </span>
              </h4>
            </div>

            {currentMonthEvents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No statutory compliance events scheduled for {MONTH_NAMES[calendarMonth]} {calendarYear}.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentMonthEvents.map(({ event: ev, dateStr, dayNum }) => {
                  const badgeInfo = CATEGORY_BADGES[ev.category] || CATEGORY_BADGES.general;
                  const IconComp = badgeInfo.icon;
                  const isRetired = ev.status === 'archived';

                  return (
                    <div
                      key={`${ev.id}-${dateStr}`}
                      className={`rounded-xl p-3 border flex items-start justify-between gap-3 text-xs transition ${
                        isRetired
                          ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-70'
                          : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 p-2 shrink-0 min-w-[48px]">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block">
                            {MONTH_NAMES[calendarMonth].slice(0, 3)}
                          </span>
                          <span className="text-base font-black text-indigo-700 dark:text-indigo-300 block">
                            {dayNum}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {ev.title}
                            </span>
                            {isRetired ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Retired
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {ev.description || ev.sourceReference}
                          </p>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                            Advance warning: {ev.noticeDaysBefore} days before
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenTenantPreview(ev)}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          <span>Preview Tenants</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(ev)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. VIEW B: LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-4">
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
                {searchQuery || categoryFilter !== 'all' || recurrenceFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters or search keywords.'
                  : 'Add statutory tax, safety, or audit deadlines for this jurisdiction.'}
              </p>
              <button
                onClick={() => handleOpenAdd()}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Compliance Event</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map((ev) => {
                const catBadge = CATEGORY_BADGES[ev.category] || CATEGORY_BADGES.general;
                const IconComponent = catBadge.icon;
                const isDeleting = deletingId === ev.id;
                const isRetiring = retiringId === ev.id;
                const isRetired = ev.status === 'archived';

                return (
                  <div
                    key={ev.id}
                    className={`rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md ${
                      isRetired
                        ? 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/50 dark:bg-slate-900/50'
                        : ev.isNoticeWindowActive
                        ? 'border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
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

                          {isRetired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                              <Archive className="w-2.5 h-2.5" />
                              Retired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Active
                            </span>
                          )}

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

                        {/* Event Row Menu */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenTenantPreview(ev)}
                            className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                            title="Preview Notified Tenants"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRetireToggle(ev)}
                            disabled={isRetiring}
                            className={`p-1.5 rounded-lg transition ${
                              isRetired
                                ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={isRetired ? 'Reactivate Event' : 'Mark Event as Retired'}
                          >
                            {isRetiring ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isRetired ? (
                              <ArchiveRestore className="w-4 h-4" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ev)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Edit Event"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(ev.id)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
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
                        <h3
                          className={`text-base font-bold leading-snug ${
                            isRetired
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {ev.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {ev.description}
                        </p>
                      </div>

                      {/* Due Date & Countdown Banner */}
                      <div
                        className={`rounded-xl p-3 flex items-center justify-between gap-3 text-xs border ${
                          isRetired
                            ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                            : ev.isNoticeWindowActive
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <div>
                            <span className="font-semibold block">Next Statutory Deadline</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {ev.nextDueDate || 'Periodic'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] block text-slate-400">Countdown</span>
                          <span
                            className={`font-black font-mono ${
                              isRetired
                                ? 'text-slate-400'
                                : (ev.daysUntilDue || 0) <= ev.noticeDaysBefore
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isRetired
                              ? 'Retired / Paused'
                              : `${ev.daysUntilDue} days remaining`}
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

                      {/* Card Footer CTAs */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => handleOpenTenantPreview(ev)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Preview Notified Tenants</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRetireToggle(ev)}
                            className={`text-xs font-semibold hover:underline ${
                              isRetired ? 'text-emerald-600' : 'text-slate-500'
                            }`}
                          >
                            {isRetired ? 'Reactivate' : 'Mark Retired'}
                          </button>

                          {ev.filingPortalUrl && (
                            <a
                              href={ev.filingPortalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 text-[11px]"
                            >
                              <span>Gov Portal</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 7. ADD / EDIT COMPLIANCE EVENT MODAL */}
      <Modal
        open={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title={editingEvent ? 'Edit Statutory Compliance Event' : 'Add Statutory Compliance Event'}
        size="lg"
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
                <option value="statutory_reporting">Statutory Reporting</option>
                <option value="license_renewal">License & Permit Renewal</option>
                <option value="general">General Compliance</option>
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
                  Recurrence Cycle
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
                  Quarterly cycle defaults to Jan, Apr, Jul, Oct (e.g. Australian BAS).
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
                    {MONTH_NAMES.map((mName, idx) => (
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

          {/* Status selector */}
          <div className="flex items-center gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Event Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as ComplianceEventStatus)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active (Automated Notices Enabled)</option>
                <option value="archived">Retired (Automated Notices Paused)</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex-1 text-right mt-5">
              <button
                type="button"
                onClick={handleOpenDraftPreview}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Matching Tenants</span>
              </button>
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

      {/* 8. PREVIEW NOTIFIED TENANTS MODAL */}
      <TenantNoticePreviewModal
        open={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        eventId={previewEvent?.id || null}
        countryId={country.id}
        draftInput={draftPreviewInput}
        eventTitle={previewEvent?.title}
      />

      {/* 9. NOTICE GENERATION JOB MODAL */}
      <Modal
        open={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        title="Test Compliance Notice Job (Phase 1 Stage 9)"
        size="lg"
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
