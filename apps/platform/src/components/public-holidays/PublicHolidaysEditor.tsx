import { useEffect, useMemo, useState } from 'react';
import type {
  CountryConfiguration,
  CountrySummary,
  HolidayDateType,
  HolidayMovingRule,
  HolidayMovingRuleType,
  InheritingTenantsResponse,
  InheritingTenantView,
  PublicHolidayItem,
  PublicHolidayRulePayload,
  PublishRuleVersionInput,
  RuleVersionView,
  StateProvinceView,
} from '@hrm/shared-types';
import {
  calculateEasterRelativeDate,
  calculateEasterSunday,
  calculateMovingHolidayDate,
  calculateNthWeekdayOfMonth,
  calculateObservedDate,
  copyHolidaysToYear,
  getDefaultPublicHolidaysForCountry,
  normalizePublicHolidayPayload,
  parseHolidaysCsv,
  validatePublicHolidayPayload,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit2,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  Info,
  Layers,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  createRuleVersion,
  getInheritingTenants,
  listRuleVersions,
  publishRuleVersion,
  updateRuleVersion,
} from '@/lib/platform-countries-api';
import { RuleVersionDiffModal } from '../rules/RuleVersionDiffModal';
import { RuleVersionSelector } from '../rules/RuleVersionSelector';

interface PublicHolidaysEditorProps {
  country: CountrySummary;
  states?: StateProvinceView[];
  configuration: CountryConfiguration | null;
  completeness: { isComplete: boolean; label: string; tone: 'green' | 'amber' | 'slate' };
  onRefresh: () => Promise<void>;
}

type ViewMode = 'calendar' | 'table' | 'tenants';

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

const WEEKDAY_ABBRS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function PublicHolidaysEditor({
  country,
  states = [],
  configuration,
  completeness,
  onRefresh,
}: PublicHolidaysEditorProps) {
  // Active Year state
  const currentYear = new Date().getUTCFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(2025);

  // Scope and State Province selection
  const [selectedStateId, setSelectedStateId] = useState<string>('');

  // Version management
  const [versions, setVersions] = useState<RuleVersionView[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<'all' | 'national' | 'state'>('all');

  // Payload data
  const [holidays, setHolidays] = useState<PublicHolidayItem[]>([]);
  const [defaultPenaltyMultiplier, setDefaultPenaltyMultiplier] = useState<number>(2.5);
  const [weekendObservationStrategy, setWeekendObservationStrategy] = useState<
    'following_weekday' | 'none' | 'closest_weekday'
  >('following_weekday');
  const [ruleNotes, setRuleNotes] = useState<string>('');

  // Inheriting Tenants state
  const [tenantImpact, setTenantImpact] = useState<InheritingTenantsResponse | null>(null);
  const [loadingTenants, setLoadingTenants] = useState<boolean>(false);
  const [selectedHolidayForTenantModal, setSelectedHolidayForTenantModal] = useState<PublicHolidayItem | null>(null);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHolidayItem | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceYear, setCopySourceYear] = useState<number>(2024);
  const [copyPreviewList, setCopyPreviewList] = useState<PublicHolidayItem[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPreviewList, setImportPreviewList] = useState<Partial<PublicHolidayItem>[]>([]);
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // New Version form inputs
  const [newVersionEffectiveFrom, setNewVersionEffectiveFrom] = useState('');
  const [newVersionEffectiveTo, setNewVersionEffectiveTo] = useState('');
  const [newVersionSourceReference, setNewVersionSourceReference] = useState('');
  const [newVersionChangeNote, setNewVersionChangeNote] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Add/Edit Form inputs
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formObservedDate, setFormObservedDate] = useState('');
  const [formDateType, setFormDateType] = useState<HolidayDateType>('fixed');
  const [formMovingRuleType, setFormMovingRuleType] = useState<HolidayMovingRuleType>('nth_weekday_of_month');
  const [formMovingMonth, setFormMovingMonth] = useState<number>(6);
  const [formMovingWeekday, setFormMovingWeekday] = useState<number>(1); // Monday
  const [formMovingOccurrence, setFormMovingOccurrence] = useState<number>(2); // 2nd Monday
  const [formEasterOffset, setFormEasterOffset] = useState<number>(-2); // Good Friday
  const [formMovingDesc, setFormMovingDesc] = useState<string>('');
  const [formIsHalfDay, setFormIsHalfDay] = useState(false);
  const [formHalfDayStartHour, setFormHalfDayStartHour] = useState<number>(19);
  const [formPenaltyMultiplier, setFormPenaltyMultiplier] = useState<number>(2.5);
  const [formStateCode, setFormStateCode] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formAutoObserve, setFormAutoObserve] = useState(true);

  // Load versions & tenant impact
  const loadVersions = async (targetVersionId?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      const list = await listRuleVersions(country.id, {
        ruleType: 'public_holiday',
        stateProvinceId: selectedStateId || undefined,
      });
      setVersions(list);

      const toSelect = targetVersionId
        ? list.find((v) => v.id === targetVersionId) || list[0]
        : list[0];

      if (toSelect) {
        setSelectedVersionId(toSelect.id);
        applyVersionPayload(toSelect.payload);
      } else {
        setSelectedVersionId(null);
        applyDefaultStatutory();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load rule versions.');
    } finally {
      setLoading(false);
    }
  };

  const loadTenantImpact = async () => {
    try {
      setLoadingTenants(true);
      const res = await getInheritingTenants(country.id);
      setTenantImpact(res);
    } catch (err: any) {
      console.warn('Failed to load inheriting tenants for country:', err?.message);
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    loadVersions();
    loadTenantImpact();
  }, [country.id, selectedStateId]);

  const applyVersionPayload = (rawPayload: unknown) => {
    const normalized = normalizePublicHolidayPayload(rawPayload);
    setHolidays(normalized.holidays);
    setDefaultPenaltyMultiplier(normalized.defaultPenaltyMultiplier ?? 2.5);
    setWeekendObservationStrategy(normalized.weekendObservationStrategy || 'following_weekday');
    setRuleNotes(normalized.notes || '');

    // Set active year to the first year found or default 2025
    if (normalized.calendarYears && normalized.calendarYears.length > 0) {
      if (!normalized.calendarYears.includes(selectedYear)) {
        setSelectedYear(normalized.calendarYears[0]);
      }
    }
  };

  const applyDefaultStatutory = () => {
    const statutory = getDefaultPublicHolidaysForCountry(country.isoCode, selectedYear);
    setHolidays(statutory.holidays);
    setDefaultPenaltyMultiplier(statutory.defaultPenaltyMultiplier ?? 2.5);
    setWeekendObservationStrategy(statutory.weekendObservationStrategy || 'following_weekday');
    setRuleNotes(statutory.notes || '');
  };

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId],
  );

  const isPublishedLocked = selectedVersion?.status === 'published';

  // Build current payload for saving / publishing
  const buildCurrentPayload = (): PublicHolidayRulePayload => {
    const years = Array.from(new Set(holidays.map((h) => parseInt(h.date.slice(0, 4), 10)).filter((y) => !isNaN(y))));
    return {
      holidays,
      defaultPenaltyMultiplier,
      weekendObservationStrategy,
      calendarYears: years.length > 0 ? years : [selectedYear],
      notes: ruleNotes,
    };
  };

  const validation = useMemo(() => {
    const payload = buildCurrentPayload();
    return validatePublicHolidayPayload(payload);
  }, [holidays, defaultPenaltyMultiplier, weekendObservationStrategy]);

  // Holidays for the selected year
  const yearHolidays = useMemo(() => {
    return holidays
      .filter((h) => {
        const hYear = parseInt(h.date.slice(0, 4), 10);
        return isNaN(hYear) || hYear === selectedYear;
      })
      .filter((h) => {
        if (filterScope === 'national') return !h.stateCode;
        if (filterScope === 'state') return Boolean(h.stateCode);
        return true;
      })
      .filter((h) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          h.name.toLowerCase().includes(q) ||
          h.date.includes(q) ||
          (h.stateCode && h.stateCode.toLowerCase().includes(q)) ||
          (h.notes && h.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, selectedYear, filterScope, searchQuery]);

  // Year statistics
  const yearStats = useMemo(() => {
    const allForYear = holidays.filter((h) => {
      const hYear = parseInt(h.date.slice(0, 4), 10);
      return isNaN(hYear) || hYear === selectedYear;
    });
    const nationalCount = allForYear.filter((h) => !h.stateCode).length;
    const stateCount = allForYear.filter((h) => Boolean(h.stateCode)).length;
    const movingCount = allForYear.filter((h) => h.dateType === 'moving').length;
    return {
      total: allForYear.length,
      national: nationalCount,
      state: stateCount,
      moving: movingCount,
    };
  }, [holidays, selectedYear]);

  // Tenant inheritance helper for a holiday
  const getInheritanceForHoliday = (holiday: PublicHolidayItem) => {
    if (!tenantImpact) {
      return { tenantCount: 0, employeeCount: 0, isNational: !holiday.stateCode, tenants: [] };
    }

    if (!holiday.stateCode) {
      // National / Federal holiday: inherited by all tenants in the country
      return {
        tenantCount: tenantImpact.totalTenants,
        employeeCount: tenantImpact.totalEmployees,
        isNational: true,
        tenants: tenantImpact.tenants,
      };
    }

    // State-specific holiday: filter companies/locations matching holiday.stateCode
    const filteredTenants: InheritingTenantView[] = [];
    let stateEmpCount = 0;

    for (const t of tenantImpact.tenants) {
      const matchingCompanies = t.companies.filter((c) => {
        const matchesCompany = c.stateCode?.toUpperCase() === holiday.stateCode?.toUpperCase();
        const matchesLocation = c.locations.some(
          (loc) => loc.stateCode?.toUpperCase() === holiday.stateCode?.toUpperCase(),
        );
        return matchesCompany || matchesLocation;
      });

      if (matchingCompanies.length > 0) {
        const tenantEmps = matchingCompanies.reduce((acc, c) => acc + c.employeeCount, 0);
        stateEmpCount += tenantEmps;
        filteredTenants.push({
          ...t,
          companies: matchingCompanies,
          totalEmployeesInCountry: tenantEmps,
        });
      }
    }

    return {
      tenantCount: filteredTenants.length,
      employeeCount: stateEmpCount,
      isNational: false,
      tenants: filteredTenants,
    };
  };

  // Add / Edit Holiday Handlers
  const openAddHolidayModal = () => {
    setEditingHoliday(null);
    setFormName('');
    setFormDate(`${selectedYear}-01-01`);
    setFormObservedDate(calculateObservedDate(`${selectedYear}-01-01`, weekendObservationStrategy));
    setFormDateType('fixed');
    setFormMovingRuleType('nth_weekday_of_month');
    setFormMovingMonth(6);
    setFormMovingWeekday(1);
    setFormMovingOccurrence(2);
    setFormEasterOffset(-2);
    setFormMovingDesc('');
    setFormIsHalfDay(false);
    setFormHalfDayStartHour(19);
    setFormPenaltyMultiplier(defaultPenaltyMultiplier);
    setFormStateCode(selectedStateId ? states.find((s) => s.id === selectedStateId)?.code || '' : '');
    setFormNotes('');
    setFormAutoObserve(true);
    setIsAddEditModalOpen(true);
  };

  const openEditHolidayModal = (h: PublicHolidayItem) => {
    setEditingHoliday(h);
    setFormName(h.name);
    setFormDate(h.date);
    setFormObservedDate(h.observedDate || h.date);
    setFormDateType(h.dateType);
    if (h.movingRule) {
      setFormMovingRuleType(h.movingRule.ruleType);
      setFormMovingMonth(h.movingRule.month || 6);
      setFormMovingWeekday(h.movingRule.weekday !== undefined ? h.movingRule.weekday : 1);
      setFormMovingOccurrence(h.movingRule.occurrence || 1);
      setFormEasterOffset(h.movingRule.easterOffsetDays ?? -2);
      setFormMovingDesc(h.movingRule.description || '');
    } else {
      setFormMovingRuleType('nth_weekday_of_month');
      setFormMovingMonth(6);
      setFormMovingWeekday(1);
      setFormMovingOccurrence(2);
      setFormEasterOffset(-2);
      setFormMovingDesc('');
    }
    setFormIsHalfDay(Boolean(h.isHalfDay));
    setFormHalfDayStartHour(h.halfDayStartHour || 19);
    setFormPenaltyMultiplier(h.penaltyMultiplier || defaultPenaltyMultiplier);
    setFormStateCode(h.stateCode || '');
    setFormNotes(h.notes || '');
    setFormAutoObserve(false);
    setIsAddEditModalOpen(true);
  };

  // Dynamic date calculation in the form
  const computedFormMovingDate = useMemo(() => {
    if (formDateType !== 'moving') return null;
    const rule: HolidayMovingRule = {
      ruleType: formMovingRuleType,
      month: formMovingMonth,
      weekday: formMovingWeekday,
      occurrence: formMovingOccurrence,
      easterOffsetDays: formEasterOffset,
      description: formMovingDesc,
    };
    return calculateMovingHolidayDate(rule, selectedYear, weekendObservationStrategy);
  }, [
    formDateType,
    formMovingRuleType,
    formMovingMonth,
    formMovingWeekday,
    formMovingOccurrence,
    formEasterOffset,
    formMovingDesc,
    selectedYear,
    weekendObservationStrategy,
  ]);

  const handleSaveHolidaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError('Holiday name is required.');
      return;
    }

    let finalDate = formDate;
    let finalObserved = formObservedDate;
    let movingRule: HolidayMovingRule | null = null;

    if (formDateType === 'moving') {
      if (computedFormMovingDate) {
        finalDate = computedFormMovingDate.dateStr;
        finalObserved = computedFormMovingDate.observedDate;
        movingRule = {
          ruleType: formMovingRuleType,
          month: formMovingMonth,
          weekday: formMovingWeekday,
          occurrence: formMovingOccurrence,
          easterOffsetDays: formEasterOffset,
          description: formMovingDesc || computedFormMovingDate.description,
        };
      }
    } else {
      if (formAutoObserve) {
        finalObserved = calculateObservedDate(finalDate, weekendObservationStrategy);
      }
    }

    const stateObj = formStateCode ? states.find((s) => s.code.toUpperCase() === formStateCode.toUpperCase()) : null;

    const item: PublicHolidayItem = {
      id: editingHoliday ? editingHoliday.id : `hol-${finalDate}-${Math.random().toString(36).slice(2, 7)}`,
      name: formName.trim(),
      date: finalDate,
      observedDate: finalObserved || finalDate,
      dateType: formDateType,
      movingRule,
      isHalfDay: formIsHalfDay,
      halfDayStartHour: formIsHalfDay ? formHalfDayStartHour : null,
      penaltyMultiplier: formPenaltyMultiplier,
      stateProvinceId: stateObj ? stateObj.id : null,
      stateCode: formStateCode ? formStateCode.toUpperCase() : null,
      notes: formNotes.trim() || undefined,
    };

    if (editingHoliday) {
      setHolidays(holidays.map((h) => (h.id === editingHoliday.id ? item : h)));
      setSuccessMessage(`Updated holiday "${item.name}".`);
    } else {
      setHolidays([...holidays, item]);
      setSuccessMessage(`Added holiday "${item.name}".`);
    }

    setIsAddEditModalOpen(false);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeleteHoliday = (id: string, name: string) => {
    if (isPublishedLocked) return;
    if (confirm(`Remove public holiday "${name}"?`)) {
      setHolidays(holidays.filter((h) => h.id !== id));
      setSuccessMessage(`Removed holiday "${name}".`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Bulk Copy Handlers
  const openBulkCopyModal = () => {
    setCopySourceYear(selectedYear - 1);
    const sourceHols = holidays.filter((h) => parseInt(h.date.slice(0, 4), 10) === selectedYear - 1);
    const generated = copyHolidaysToYear(sourceHols, selectedYear, weekendObservationStrategy);
    setCopyPreviewList(generated);
    setIsCopyModalOpen(true);
  };

  const handleSourceYearChange = (srcYear: number) => {
    setCopySourceYear(srcYear);
    const sourceHols = holidays.filter((h) => parseInt(h.date.slice(0, 4), 10) === srcYear);
    const generated = copyHolidaysToYear(sourceHols, selectedYear, weekendObservationStrategy);
    setCopyPreviewList(generated);
  };

  const handleApplyBulkCopy = () => {
    if (copyPreviewList.length === 0) {
      setError(`No holidays found in source year ${copySourceYear} to copy.`);
      return;
    }
    // Remove existing holidays in selectedYear and replace with copied
    const others = holidays.filter((h) => parseInt(h.date.slice(0, 4), 10) !== selectedYear);
    setHolidays([...others, ...copyPreviewList]);
    setSuccessMessage(`Successfully copied ${copyPreviewList.length} holidays from ${copySourceYear} to ${selectedYear}.`);
    setIsCopyModalOpen(false);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // CSV Import Handlers
  const handleDownloadCsvTemplate = () => {
    const templateContent = [
      'name,date,date_type,moving_rule,observed_date,is_half_day,state_code,penalty_multiplier,notes',
      `New Year's Day,${selectedYear}-01-01,fixed,,${selectedYear}-01-01,false,,2.5,National Public Holiday`,
      `Australia Day,${selectedYear}-01-26,fixed,,${selectedYear}-01-27,false,,2.5,Observed on Monday if weekend`,
      `Good Friday,${selectedYear}-04-18,moving,Easter - 2,${selectedYear}-04-18,false,,2.5,Easter relative`,
      `King's Birthday,${selectedYear}-06-09,moving,2nd Monday in June,${selectedYear}-06-09,false,,2.5,National except WA/QLD`,
      `Labour Day,${selectedYear}-10-06,moving,1st Monday in October,${selectedYear}-10-06,false,NSW,2.5,State Public Holiday in NSW`,
      `Christmas Eve,${selectedYear}-12-24,fixed,,${selectedYear}-12-24,true,SA,2.5,Half-day starting 7PM`,
      `Christmas Day,${selectedYear}-12-25,fixed,,${selectedYear}-12-25,false,,2.5,National Public Holiday`,
    ].join('\n');

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `public_holidays_template_${country.isoCode}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseCsvText = (text: string) => {
    setImportCsvText(text);
    const res = parseHolidaysCsv(text);
    setImportPreviewList(res.holidays);
    setImportErrors(res.errors);
  };

  const handleCsvFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      handleParseCsvText(content);
    };
    reader.readAsText(file);
  };

  const handleApplyCsvImport = () => {
    if (importPreviewList.length === 0) {
      setError('No valid holiday records to import.');
      return;
    }

    const importedItems: PublicHolidayItem[] = importPreviewList.map((p, idx) => ({
      id: p.id || `hol-csv-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      name: p.name || 'Public Holiday',
      date: p.date || `${selectedYear}-01-01`,
      observedDate: p.observedDate || p.date || `${selectedYear}-01-01`,
      dateType: p.dateType || 'fixed',
      movingRule: p.movingRule || null,
      isHalfDay: Boolean(p.isHalfDay),
      halfDayStartHour: p.halfDayStartHour || null,
      penaltyMultiplier: p.penaltyMultiplier || 2.5,
      stateProvinceId: p.stateCode ? states.find((s) => s.code.toUpperCase() === p.stateCode?.toUpperCase())?.id || null : null,
      stateCode: p.stateCode || null,
      notes: p.notes,
    }));

    setHolidays([...holidays, ...importedItems]);
    setSuccessMessage(`Successfully imported ${importedItems.length} holidays from CSV.`);
    setIsImportModalOpen(false);
    setImportCsvText('');
    setImportPreviewList([]);
    setImportErrors([]);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Version Management Handlers
  const handleSaveDraft = async () => {
    if (!selectedVersionId) return;
    if (!validation.isValid) {
      setError(validation.summaryError || 'Invalid holiday payload.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = buildCurrentPayload();
      const updated = await updateRuleVersion(country.id, selectedVersionId, {
        payload: payload as unknown as Record<string, unknown>,
      });
      setSuccessMessage(`Version ${updated.version} draft saved successfully.`);
      await loadVersions(updated.id);
      await onRefresh();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to save draft rule version.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (
    targetVersion?: RuleVersionView,
    options?: PublishRuleVersionInput,
  ) => {
    const vToPublish = targetVersion || selectedVersion;
    if (!vToPublish) return;
    if (!validation.isValid) {
      setError(validation.summaryError || 'Invalid holiday payload.');
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      const payload = buildCurrentPayload();
      await updateRuleVersion(country.id, vToPublish.id, {
        payload: payload as unknown as Record<string, unknown>,
      });

      const published = await publishRuleVersion(country.id, vToPublish.id, options);
      setSuccessMessage(`Published Version ${published.version} successfully!`);
      await loadVersions(published.id);
      await loadTenantImpact();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish public holiday rules.');
      throw err;
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionEffectiveFrom) {
      setError('Effective from date is required.');
      return;
    }

    try {
      setCreatingVersion(true);
      setError(null);
      const basePayload = buildCurrentPayload();

      const created = await createRuleVersion(country.id, {
        ruleType: 'public_holiday',
        stateProvinceId: selectedStateId || undefined,
        effectiveFrom: newVersionEffectiveFrom,
        effectiveTo: newVersionEffectiveTo || undefined,
        sourceReference: newVersionSourceReference.trim() || `${country.name} Statutory Public Holidays Gazette`,
        changeNote: newVersionChangeNote.trim() || 'Annual statutory public holidays calendar revision',
        payload: basePayload as unknown as Record<string, unknown>,
        status: 'draft',
      });

      setIsNewVersionModalOpen(false);
      setSuccessMessage(`Created Draft Version ${created.version}.`);
      await loadVersions(created.id);
      await onRefresh();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to create new rule version.');
    } finally {
      setCreatingVersion(false);
    }
  };

  // Calendar rendering helper
  const renderMonthCalendar = (monthIdx: number) => {
    const firstDayOfMonth = new Date(Date.UTC(selectedYear, monthIdx, 1));
    const daysInMonth = new Date(Date.UTC(selectedYear, monthIdx + 1, 0)).getUTCDate();
    const startingDayOfWeek = firstDayOfMonth.getUTCDay(); // 0 = Sunday

    const monthHolidays = yearHolidays.filter((h) => {
      const parts = h.date.split('-').map(Number);
      return parts[1] === monthIdx + 1;
    });

    const holidayMap = new Map<number, PublicHolidayItem>();
    monthHolidays.forEach((h) => {
      const day = parseInt(h.date.split('-')[2], 10);
      holidayMap.set(day, h);
    });

    return (
      <div
        key={monthIdx}
        className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{MONTH_NAMES[monthIdx]}</span>
          {monthHolidays.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {monthHolidays.length} {monthHolidays.length === 1 ? 'holiday' : 'holidays'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mb-1">
          {WEEKDAY_ABBRS.map((abbr) => (
            <span key={abbr}>{abbr}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {Array.from({ length: startingDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-6" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const hol = holidayMap.get(dayNum);
            const isToday =
              currentYear === selectedYear &&
              new Date().getUTCMonth() === monthIdx &&
              new Date().getUTCDate() === dayNum;

            if (hol) {
              const isStateSpecific = Boolean(hol.stateCode);
              return (
                <div
                  key={dayNum}
                  onClick={() => openEditHolidayModal(hol)}
                  className={`group relative flex h-6 items-center justify-center rounded-md font-bold cursor-pointer transition-all ${
                    isStateSpecific
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                      : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                  }`}
                  title={`${hol.name} (${hol.date})${hol.stateCode ? ` - ${hol.stateCode}` : ''}`}
                >
                  <span>{dayNum}</span>
                  <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-white opacity-80" />
                </div>
              );
            }

            return (
              <div
                key={dayNum}
                className={`flex h-6 items-center justify-center rounded text-slate-700 dark:text-slate-300 ${
                  isToday ? 'border border-amber-500 font-bold text-amber-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {dayNum}
              </div>
            );
          })}
        </div>

        {monthHolidays.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5 dark:border-slate-800">
            {monthHolidays.map((h) => {
              const inheritance = getInheritanceForHoliday(h);
              return (
                <div
                  key={h.id}
                  onClick={() => openEditHolidayModal(h)}
                  className="group flex items-center justify-between gap-1.5 rounded-lg p-1 hover:bg-slate-50 cursor-pointer text-[11px] dark:hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        h.stateCode ? 'bg-indigo-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
                      {h.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {h.dateType === 'moving' && (
                      <span className="text-[9px] font-mono font-bold text-purple-600 dark:text-purple-400">
                        MV
                      </span>
                    )}
                    {h.stateCode && (
                      <span className="rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {h.stateCode}
                      </span>
                    )}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHolidayForTenantModal(h);
                      }}
                      className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      title="View inheriting tenants"
                    >
                      {inheritance.tenantCount}T
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER & VERSION BANNER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Public & Statutory Bank Holidays Editor
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                    <Sparkles className="w-3 h-3" /> Stage C.07 • Statutory Calendars
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                      completeness.tone === 'green'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    {completeness.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure national gazetted and state/provincial public holidays, fixed & moving rules, weekend rollovers, and preview tenant inheritance.
                </p>
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Statutory Presets:</span>
            <button
              type="button"
              disabled={isPublishedLocked}
              onClick={() => {
                if (confirm(`Apply official Australian Fair Work statutory public holidays for ${selectedYear}?`)) {
                  const p = getDefaultPublicHolidaysForCountry('AUS', selectedYear);
                  setHolidays(p.holidays);
                  setSuccessMessage(`Loaded Australia statutory public holidays preset for ${selectedYear}.`);
                  setTimeout(() => setSuccessMessage(null), 3000);
                }
              }}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
            >
              🇦🇺 AUS (Fair Work)
            </button>
            <button
              type="button"
              disabled={isPublishedLocked}
              onClick={() => {
                if (confirm(`Apply Bangladesh Labor Act 2006 statutory festival holidays for ${selectedYear}?`)) {
                  const p = getDefaultPublicHolidaysForCountry('BGD', selectedYear);
                  setHolidays(p.holidays);
                  setSuccessMessage(`Loaded Bangladesh statutory festival holidays preset for ${selectedYear}.`);
                  setTimeout(() => setSuccessMessage(null), 3000);
                }
              }}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
            >
              🇧🇩 BGD (Labor Act)
            </button>
          </div>
        </div>

        {/* Scope and Controls Bar */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Scope State Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-600 dark:text-slate-300">Jurisdiction:</span>
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">National / Federal (All States)</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="Previous Year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 dark:text-white px-1 py-0.5 text-sm focus:outline-none"
              >
                {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                  <option key={yr} value={yr} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                    Year {yr}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="Next Year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white shadow-sm text-amber-600 dark:bg-slate-900 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendar Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white shadow-sm text-amber-600 dark:bg-slate-900 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table View ({yearStats.total})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tenants')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'tenants'
                  ? 'bg-white shadow-sm text-amber-600 dark:bg-slate-900 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Tenant Impact ({tenantImpact?.totalTenants ?? 0})
            </button>
          </div>
        </div>
      </div>

      {/* 2. VERSION SELECTOR BAR */}
      <RuleVersionSelector
        versions={versions}
        selectedVersionId={selectedVersionId}
        countryId={country.id}
        onRefresh={() => loadVersions(selectedVersionId || undefined)}
        onSelectVersion={(versionId) => {
          setSelectedVersionId(versionId);
          const v = versions.find((item) => item.id === versionId);
          if (v) {
            applyVersionPayload(v.payload);
          }
        }}
        onCreateNewVersion={() => {
          const nextYear = new Date().getUTCFullYear() + 1;
          setNewVersionEffectiveFrom(`${nextYear}-01-01`);
          setNewVersionEffectiveTo('');
          setNewVersionSourceReference(`${country.name} Statutory Public Holidays Schedule ${nextYear}`);
          setNewVersionChangeNote(`Annual ${nextYear} statutory gazetted holidays schedule revision`);
          setIsNewVersionModalOpen(true);
        }}
        onCompareVersions={() => setIsDiffModalOpen(true)}
        onPublishVersion={(versionId, options) => {
          const v = versions.find((item) => item.id === versionId);
          if (v) return handlePublish(v, options);
        }}
        isPublishing={publishing}
      />

      {/* Published Version Lock Banner */}
      {isPublishedLocked && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Published Version {selectedVersion?.version} is Locked (Immutable).</span> In accordance with compliance governance, published statutory holidays cannot be altered in-place. Click <strong>"New Version"</strong> to clone into a draft revision.
          </div>
        </div>
      )}

      {/* 3. ALERTS & ERROR BANNERS */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div className="space-y-1">
            <span className="font-bold">Operation Blocked</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* 4. ACTIONS & TOOLS BAR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPublishedLocked}
            onClick={openAddHolidayModal}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Holiday
          </button>
          <button
            type="button"
            disabled={isPublishedLocked}
            onClick={openBulkCopyModal}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" /> Bulk Copy from Previous Year
          </button>
          <button
            type="button"
            disabled={isPublishedLocked}
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" /> Import from CSV
          </button>
          <button
            type="button"
            onClick={handleDownloadCsvTemplate}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm flex items-center gap-1.5 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Download Template
          </button>
        </div>

        {/* Summary Chips */}
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {yearStats.total} Total in {selectedYear}
          </span>
          <span className="rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {yearStats.national} National
          </span>
          {yearStats.state > 0 && (
            <span className="rounded-md bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {yearStats.state} State-Specific
            </span>
          )}
          {yearStats.moving > 0 && (
            <span className="rounded-md bg-purple-50 px-2 py-1 font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              {yearStats.moving} Moving Rule
            </span>
          )}
        </div>
      </div>

      {/* 5. MAIN CONTENT AREA (BASED ON VIEW MODE) */}
      {viewMode === 'calendar' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, idx) => renderMonthCalendar(idx))}
          </div>
        </div>
      )}

      {viewMode === 'table' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          {/* Table Search & Filter Bar */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search holidays by name, state code, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Scope Filter:</span>
              <button
                type="button"
                onClick={() => setFilterScope('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  filterScope === 'all'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                All ({yearStats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterScope('national')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  filterScope === 'national'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                National ({yearStats.national})
              </button>
              <button
                type="button"
                onClick={() => setFilterScope('state')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  filterScope === 'state'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                State ({yearStats.state})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Holiday Name</th>
                  <th className="py-2.5 px-3">Calendar Date</th>
                  <th className="py-2.5 px-3">Observed Date</th>
                  <th className="py-2.5 px-3">Date Type</th>
                  <th className="py-2.5 px-3">Moving Rule Formula</th>
                  <th className="py-2.5 px-3">Scope / State</th>
                  <th className="py-2.5 px-3">Penalty OT</th>
                  <th className="py-2.5 px-3">Inheriting Tenants</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {yearHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No public holidays configured for {selectedYear} matching filter. Click <strong>"+ Add Holiday"</strong> or <strong>"Bulk Copy"</strong>.
                    </td>
                  </tr>
                ) : (
                  yearHolidays.map((h) => {
                    const inheritance = getInheritanceForHoliday(h);
                    const dateObj = new Date(h.date + 'T00:00:00Z');
                    const weekdayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                h.stateCode ? 'bg-indigo-500' : 'bg-amber-500'
                              }`}
                            />
                            <span>{h.name}</span>
                            {h.isHalfDay && (
                              <span className="rounded bg-orange-50 px-1 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                1/2 Day
                              </span>
                            )}
                          </div>
                          {h.notes && <p className="text-[10px] text-slate-400 font-normal mt-0.5">{h.notes}</p>}
                        </td>

                        <td className="py-2.5 px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                          {h.date} <span className="text-[10px] text-slate-400">({weekdayName})</span>
                        </td>

                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {h.observedDate && h.observedDate !== h.date ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <RotateCcw className="w-2.5 h-2.5" /> {h.observedDate}
                            </span>
                          ) : (
                            <span>{h.observedDate || h.date}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${
                              h.dateType === 'moving'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {h.dateType === 'moving' ? 'Moving' : 'Fixed Date'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                          {h.movingRule ? (
                            <div className="space-y-0.5">
                              <span className="font-semibold text-purple-700 dark:text-purple-300">
                                {h.movingRule.description || h.movingRule.ruleType}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          {h.stateCode ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">
                              <MapPin className="w-2.5 h-2.5" /> {h.stateCode} Only
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                              <Globe className="w-2.5 h-2.5" /> National (Federal)
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {h.penaltyMultiplier ? `${h.penaltyMultiplier}x` : '2.5x'}
                        </td>

                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => setSelectedHolidayForTenantModal(h)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-amber-400 hover:text-amber-600 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>
                              {inheritance.tenantCount} {inheritance.tenantCount === 1 ? 'Tenant' : 'Tenants'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({inheritance.employeeCount} emp)
                            </span>
                          </button>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isPublishedLocked}
                              onClick={() => openEditHolidayModal(h)}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 transition-colors"
                              title="Edit Holiday"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isPublishedLocked}
                              onClick={() => handleDeleteHoliday(h.id, h.name)}
                              className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 transition-colors"
                              title="Delete Holiday"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'tenants' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  Tenants Inheriting {country.name} Public Holidays
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Understand exactly which customer workspaces and employee headcounts are affected by national and state holiday rules.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                  {tenantImpact?.totalTenants ?? 0} Workspaces Linked
                </span>
                <span className="rounded-md bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">
                  {tenantImpact?.totalEmployees ?? 0} Total Active Staff
                </span>
              </div>
            </div>

            {loadingTenants ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> Loading inheriting tenants...
              </div>
            ) : !tenantImpact || tenantImpact.tenants.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No active tenant companies currently linked to {country.name}.
              </div>
            ) : (
              <div className="space-y-4">
                {tenantImpact.tenants.map((t) => (
                  <div
                    key={t.tenantId}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 pb-3 mb-3 dark:border-slate-700">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{t.tenantName}</span>
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {t.subdomain}
                          </span>
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">
                            Plan: {t.plan}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Inherits all {yearStats.national} National Public Holidays automatically into attendance and payroll rules.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {t.totalEmployeesInCountry} Employees
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {t.companies.map((comp) => (
                        <div
                          key={comp.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{comp.name}</span>
                            <span className="font-mono text-slate-500">{comp.employeeCount} staff</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>
                              Jurisdiction:{' '}
                              <strong>
                                {comp.stateName ? `${comp.stateName} (${comp.stateCode})` : 'National Federal'}
                              </strong>
                            </span>
                          </div>
                          {comp.stateCode && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 text-[10px] text-indigo-600 font-semibold dark:border-slate-700 dark:text-indigo-400">
                              <CheckCircle2 className="w-3 h-3" /> Inherits State holidays for {comp.stateCode}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. BOTTOM ACTIONS BAR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-xs text-slate-500">
          {!validation.isValid ? (
            <span className="text-red-600 font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {validation.summaryError}
            </span>
          ) : (
            <span className="text-emerald-700 font-medium flex items-center gap-1.5 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Public holiday calendar for {selectedYear} is valid ({yearStats.total} total holidays).
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isPublishedLocked}
            onClick={() => {
              if (confirm('Reset holidays to statutory defaults?')) {
                applyDefaultStatutory();
              }
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors flex items-center gap-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>

          <button
            type="button"
            disabled={isPublishedLocked || saving || !validation.isValid}
            onClick={handleSaveDraft}
            className="px-4 py-1.5 text-xs font-bold rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 disabled:opacity-40 transition-colors flex items-center gap-1.5 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Draft Version
          </button>


        </div>
      </div>

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* 1. Add / Edit Holiday Modal */}
      <Modal
        open={isAddEditModalOpen}
        onClose={() => setIsAddEditModalOpen(false)}
        title={editingHoliday ? `Edit Public Holiday: ${editingHoliday.name}` : `Add Public Holiday (${selectedYear})`}
      >
        <form onSubmit={handleSaveHolidaySubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1 dark:text-slate-200">
              Holiday Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Australia Day, Good Friday, King's Birthday"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Date Type Selector (Fixed vs Moving) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 dark:text-slate-200">
              Holiday Date Classification <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormDateType('fixed')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  formDateType === 'fixed'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <div className="text-xs">Fixed-Date Holiday</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">
                  Static calendar date every year (e.g. Dec 25, Jan 26, Jan 1).
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormDateType('moving')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  formDateType === 'moving'
                    ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold dark:bg-purple-950/40 dark:text-purple-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <div className="text-xs">Moving Holiday (with Rule)</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">
                  Calculated dynamically (e.g. Easter-relative, 2nd Mon in June).
                </div>
              </button>
            </div>
          </div>

          {/* Fixed-Date Parameters */}
          {formDateType === 'fixed' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
                    Calendar Date ({selectedYear}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => {
                      setFormDate(e.target.value);
                      if (formAutoObserve) {
                        setFormObservedDate(calculateObservedDate(e.target.value, weekendObservationStrategy));
                      }
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
                    Observed Date (Weekend Rollover)
                  </label>
                  <input
                    type="date"
                    value={formObservedDate}
                    onChange={(e) => {
                      setFormObservedDate(e.target.value);
                      setFormAutoObserve(false);
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoObserveCheck"
                  checked={formAutoObserve}
                  onChange={(e) => {
                    setFormAutoObserve(e.target.checked);
                    if (e.target.checked) {
                      setFormObservedDate(calculateObservedDate(formDate, weekendObservationStrategy));
                    }
                  }}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="autoObserveCheck" className="text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                  Automatically roll over weekend holidays to following Monday ({weekendObservationStrategy})
                </label>
              </div>
            </div>
          )}

          {/* Moving Holiday Rule Parameters */}
          {formDateType === 'moving' && (
            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3 dark:border-purple-800 dark:bg-purple-950/30">
              <div>
                <label className="block font-semibold text-purple-900 dark:text-purple-200 mb-1">
                  Moving Rule Type
                </label>
                <select
                  value={formMovingRuleType}
                  onChange={(e) => setFormMovingRuleType(e.target.value as HolidayMovingRuleType)}
                  className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg dark:border-purple-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="nth_weekday_of_month">Nth Weekday of Month (e.g. 2nd Monday of June)</option>
                  <option value="easter_relative">Easter-Relative (e.g. Good Friday, Easter Monday)</option>
                  <option value="lunar_hijri">Lunar / Islamic Hijri (e.g. Eid-ul-Fitr)</option>
                  <option value="custom_gazette">Custom Gazette Decree / Proclamation</option>
                </select>
              </div>

              {formMovingRuleType === 'nth_weekday_of_month' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Occurrence</label>
                    <select
                      value={formMovingOccurrence}
                      onChange={(e) => setFormMovingOccurrence(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                    >
                      <option value={1}>1st</option>
                      <option value={2}>2nd</option>
                      <option value={3}>3rd</option>
                      <option value={4}>4th</option>
                      <option value={-1}>Last</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Day of Week</label>
                    <select
                      value={formMovingWeekday}
                      onChange={(e) => setFormMovingWeekday(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                    >
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                      <option value={0}>Sunday</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Month</label>
                    <select
                      value={formMovingMonth}
                      onChange={(e) => setFormMovingMonth(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {formMovingRuleType === 'easter_relative' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Days Relative to Easter Sunday
                  </label>
                  <select
                    value={formEasterOffset}
                    onChange={(e) => setFormEasterOffset(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                  >
                    <option value={-2}>Good Friday (Easter - 2 days)</option>
                    <option value={-1}>Holy Saturday (Easter - 1 day)</option>
                    <option value={0}>Easter Sunday (Exact Easter Day)</option>
                    <option value={1}>Easter Monday (Easter + 1 day)</option>
                    <option value={2}>Easter Tuesday (Easter + 2 days)</option>
                  </select>
                </div>
              )}

              {/* Live Evaluated Moving Date Pill */}
              {computedFormMovingDate && (
                <div className="p-2.5 rounded-lg bg-white border border-purple-200 text-xs font-semibold text-purple-900 flex items-center justify-between dark:bg-slate-900 dark:border-purple-800 dark:text-purple-200">
                  <span>Evaluated Date for {selectedYear}:</span>
                  <span className="font-mono bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded text-purple-800 dark:text-purple-300 font-bold">
                    {computedFormMovingDate.dateStr} ({computedFormMovingDate.description})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Scope State & Multiplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
                Jurisdiction Scope
              </label>
              <select
                value={formStateCode}
                onChange={(e) => setFormStateCode(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">National / Federal (All States & Workspaces)</option>
                {states.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name} ({s.code}) - State Specific
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
                Penalty Overtime Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="10.0"
                value={formPenaltyMultiplier}
                onChange={(e) => setFormPenaltyMultiplier(parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Half-Day Settings */}
          <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg dark:border-slate-700 dark:bg-slate-800/40">
            <input
              type="checkbox"
              id="halfDayCheck"
              checked={formIsHalfDay}
              onChange={(e) => setFormIsHalfDay(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="halfDayCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Half-Day Public Holiday (e.g. Christmas Eve from 7:00 PM)
            </label>
            {formIsHalfDay && (
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[10px] text-slate-500">Start Hour:</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={formHalfDayStartHour}
                  onChange={(e) => setFormHalfDayStartHour(Number(e.target.value))}
                  className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-[10px] text-slate-500">:00</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
              Statutory Gazette Reference / Notes
            </label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Public Holidays Act 2010 (NSW) §4"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Tenant impact pill in modal */}
          {tenantImpact && (
            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center justify-between dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-200">
              <span className="flex items-center gap-1.5 font-semibold">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Impact:
              </span>
              <span>
                {formStateCode
                  ? `Applies to entities in ${formStateCode}`
                  : `Inherited by ALL ${tenantImpact.totalTenants} Tenants (${tenantImpact.totalEmployees} employees)`}
              </span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsAddEditModalOpen(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-bold shadow-sm"
            >
              {editingHoliday ? 'Save Changes' : 'Add to Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Bulk Copy Modal */}
      <Modal
        open={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        title={`Bulk Copy Public Holidays to Year ${selectedYear}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500">
            Rolls forward statutory holidays from a prior year into <strong>{selectedYear}</strong>. Fixed dates keep the same month and day with recalculated weekend rollovers; moving dates evaluate their dynamic rules.
          </p>

          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl dark:border-slate-700 dark:bg-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Copy from Source Year:</span>
            <select
              value={copySourceYear}
              onChange={(e) => handleSourceYearChange(Number(e.target.value))}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {[2023, 2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  Year {yr}
                </option>
              ))}
            </select>
            <span className="text-slate-400">&rarr; Target:</span>
            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 dark:bg-amber-950">
              Year {selectedYear}
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3">Holiday Name</th>
                  <th className="py-2 px-3">Calculated Date ({selectedYear})</th>
                  <th className="py-2 px-3">Observed Date</th>
                  <th className="py-2 px-3">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {copyPreviewList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No holidays found in year {copySourceYear} to copy.
                    </td>
                  </tr>
                ) : (
                  copyPreviewList.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{h.name}</td>
                      <td className="py-2 px-3 font-mono">{h.date}</td>
                      <td className="py-2 px-3 font-mono">{h.observedDate || h.date}</td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                          {h.dateType === 'moving' ? 'Moving Rule' : 'Fixed'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsCopyModalOpen(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={copyPreviewList.length === 0}
              onClick={handleApplyBulkCopy}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-bold shadow-sm disabled:opacity-50"
            >
              Apply {copyPreviewList.length} Holidays to {selectedYear}
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Import from CSV Modal */}
      <Modal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Public Holidays from CSV"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500">
            Upload or paste CSV holiday data. Headers supported: <code>name</code>, <code>date</code> (YYYY-MM-DD), <code>date_type</code> (fixed/moving), <code>moving_rule</code>, <code>state_code</code>, <code>penalty_multiplier</code>.
          </p>

          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-700 dark:text-slate-300">CSV File or Paste:</label>
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="text-xs text-amber-600 font-semibold hover:underline flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Download Template CSV
            </button>
          </div>

          {/* File Upload Dropzone */}
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center hover:border-amber-500 transition-colors dark:border-slate-700">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleCsvFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
              id="csvFileInput"
            />
            <label htmlFor="csvFileInput" className="cursor-pointer block space-y-1">
              <Upload className="w-6 h-6 mx-auto text-slate-400" />
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                Click to browse CSV file
              </div>
              <div className="text-[10px] text-slate-400">or paste content directly below</div>
            </label>
          </div>

          <textarea
            rows={5}
            value={importCsvText}
            onChange={(e) => handleParseCsvText(e.target.value)}
            placeholder="name,date,date_type,moving_rule,observed_date,is_half_day,state_code,penalty_multiplier,notes&#10;Australia Day,2025-01-26,fixed,,2025-01-27,false,,2.5,National&#10;King's Birthday,2025-06-09,moving,2nd Monday in June,2025-06-09,false,,2.5,National"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

          {importErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs space-y-1">
              <span className="font-bold">CSV Parse Warnings / Errors:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {importPreviewList.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="py-1.5 px-2">Name</th>
                    <th className="py-1.5 px-2">Date</th>
                    <th className="py-1.5 px-2">Type</th>
                    <th className="py-1.5 px-2">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {importPreviewList.map((p, idx) => (
                    <tr key={idx}>
                      <td className="py-1 px-2 font-semibold">{p.name}</td>
                      <td className="py-1 px-2 font-mono">{p.date}</td>
                      <td className="py-1 px-2">{p.dateType}</td>
                      <td className="py-1 px-2">{p.stateCode || 'National'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={importPreviewList.length === 0}
              onClick={handleApplyCsvImport}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-bold shadow-sm disabled:opacity-50"
            >
              Import {importPreviewList.length} Holidays
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Holiday Tenant Impact Inspector Modal */}
      {selectedHolidayForTenantModal && (
        <Modal
          open={Boolean(selectedHolidayForTenantModal)}
          onClose={() => setSelectedHolidayForTenantModal(null)}
          title={`Tenant Impact: ${selectedHolidayForTenantModal.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedHolidayForTenantModal.name}
                </span>
                <span className="font-mono text-xs font-bold text-amber-600">
                  {selectedHolidayForTenantModal.date}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <span>
                  Classification:{' '}
                  <strong>
                    {selectedHolidayForTenantModal.stateCode
                      ? `State Specific (${selectedHolidayForTenantModal.stateCode})`
                      : 'National / Federal'}
                  </strong>
                </span>
                <span>•</span>
                <span>Penalty: {selectedHolidayForTenantModal.penaltyMultiplier || 2.5}x OT</span>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                Inheriting Workspaces & Headcounts:
              </h5>

              {(() => {
                const info = getInheritanceForHoliday(selectedHolidayForTenantModal);
                if (info.tenants.length === 0) {
                  return (
                    <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                      No customer tenants match this holiday's jurisdiction ({selectedHolidayForTenantModal.stateCode || 'Country'}).
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    {info.tenants.map((t) => (
                      <div
                        key={t.tenantId}
                        className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white">{t.tenantName}</span>
                          <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px] dark:bg-emerald-950">
                            {t.totalEmployeesInCountry} Staff Inherit
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {info.isNational ? (
                            <span className="text-amber-700 font-semibold flex items-center gap-1 dark:text-amber-400">
                              <CheckCircle2 className="w-3 h-3" /> National Statutory Holiday: Applies to all company entities and branches.
                            </span>
                          ) : (
                            <span className="text-indigo-700 font-semibold flex items-center gap-1 dark:text-indigo-400">
                              <CheckCircle2 className="w-3 h-3" /> State Holiday: Applies to {selectedHolidayForTenantModal.stateCode} branches only.
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedHolidayForTenantModal(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold dark:bg-slate-800 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Create New Version Modal */}
      <Modal
        open={isNewVersionModalOpen}
        onClose={() => setIsNewVersionModalOpen(false)}
        title={`Create New Public Holidays Version (v${(versions[0]?.version ?? 0) + 1})`}
      >
        <form onSubmit={handleCreateNewVersion} className="space-y-4 text-xs">
          <p className="text-slate-500">
            A new version will be created as a <strong>DRAFT</strong> cloned from your current settings. Published versions remain locked for historical compliance reproducibility.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
              Effective From (Inclusive) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={newVersionEffectiveFrom}
              onChange={(e) => setNewVersionEffectiveFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
              Effective To (Sunset Date)
            </label>
            <input
              type="date"
              value={newVersionEffectiveTo}
              onChange={(e) => setNewVersionEffectiveTo(e.target.value)}
              placeholder="Leave blank if open-ended"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Leave blank for open-ended version.</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
              Gazette / Statutory Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newVersionSourceReference}
              onChange={(e) => setNewVersionSourceReference(e.target.value)}
              placeholder="e.g. Public Holidays Act 2010 (NSW) Gazette"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 dark:text-slate-300">
              Change Note / Revision Purpose <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newVersionChangeNote}
              onChange={(e) => setNewVersionChangeNote(e.target.value)}
              placeholder="e.g. Annual statutory public holiday calendar revision"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsNewVersionModalOpen(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingVersion}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-semibold flex items-center gap-1.5"
            >
              {creatingVersion && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Draft Version
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. Compare Versions Diff Modal */}
      {isDiffModalOpen && (
        <RuleVersionDiffModal
          open={isDiffModalOpen}
          onClose={() => setIsDiffModalOpen(false)}
          countryId={country.id}
          versions={versions}
          initialBaseVersionId={versions[1]?.id || versions[0]?.id}
          initialCompareVersionId={versions[0]?.id}
        />
      )}
    </div>
  );
}
