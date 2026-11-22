import { useEffect, useMemo, useState } from 'react';
import type {
  CountryConfiguration,
  CountrySummary,
  OvertimeCalculationResult,
  OvertimeCapBreachAction,
  RuleVersionView,
  StateProvinceView,
  WorkingHoursOtRulePayload,
} from '@hrm/shared-types';
import {
  calculateOvertimePayBreakdown,
  getDefaultWorkingHoursOtForCountry,
  normalizeWorkingHoursOtPayload,
  validateWorkingHoursOtPayload,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  ExternalLink,
  Flame,
  Info,
  Layers,
  Loader2,
  Lock,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  Zap,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  createRuleVersion,
  listRuleVersions,
  publishRuleVersion,
  updateRuleVersion,
} from '@/lib/platform-countries-api';
import { RuleVersionDiffModal } from '../rules/RuleVersionDiffModal';
import { RuleVersionSelector } from '../rules/RuleVersionSelector';

interface WorkingHoursOtRulesEditorProps {
  country: CountrySummary;
  states?: StateProvinceView[];
  configuration: CountryConfiguration | null;
  completeness: { isComplete: boolean; label: string; tone: 'green' | 'amber' | 'slate' };
  onRefresh: () => Promise<void>;
  defaultRuleType?: 'ot' | 'working_hours';
}

export function WorkingHoursOtRulesEditor({
  country,
  states = [],
  configuration,
  completeness,
  onRefresh,
  defaultRuleType = 'ot',
}: WorkingHoursOtRulesEditorProps) {
  // Scope and Rule Type selection
  const [activeRuleType, setActiveRuleType] = useState<'ot' | 'working_hours'>(defaultRuleType);
  const [selectedStateId, setSelectedStateId] = useState<string>('');

  useEffect(() => {
    setActiveRuleType(defaultRuleType);
  }, [defaultRuleType]);

  // Version management
  const [versions, setVersions] = useState<RuleVersionView[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Core Working Hours & Overtime State
  const defaultStatutory = useMemo(
    () => getDefaultWorkingHoursOtForCountry(country.isoCode),
    [country.isoCode],
  );

  // Section 1: Standard Hours & Ceilings
  const [standardDailyHours, setStandardDailyHours] = useState<number>(defaultStatutory.standardDailyHours);
  const [standardWeeklyHours, setStandardWeeklyHours] = useState<number>(defaultStatutory.standardWeeklyHours);
  const [maxDailyHours, setMaxDailyHours] = useState<number>(defaultStatutory.maxDailyHours ?? 10);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState<number>(defaultStatutory.maxWeeklyHours ?? 48);
  const [maxConsecutiveDays, setMaxConsecutiveDays] = useState<number>(defaultStatutory.maxConsecutiveDays ?? 6);

  // Section 2: Rest Breaks & Rest Periods
  const [restBreakRequiredAfterHours, setRestBreakRequiredAfterHours] = useState<number>(
    defaultStatutory.restBreakRequiredAfterHours ?? 5,
  );
  const [minimumRestBreakMinutes, setMinimumRestBreakMinutes] = useState<number>(
    defaultStatutory.minimumRestBreakMinutes ?? 30,
  );
  const [dailyRestPeriodHours, setDailyRestPeriodHours] = useState<number>(
    defaultStatutory.dailyRestPeriodHours ?? 11,
  );
  const [paidBreakMinutes, setPaidBreakMinutes] = useState<number>(
    defaultStatutory.paidBreakMinutes ?? 0,
  );

  // Section 3: Overtime Multipliers & Night Windows
  const [weekdayMultiplier, setWeekdayMultiplier] = useState<number>(
    defaultStatutory.weekdayMultiplier ?? 1.5,
  );
  const [enableWeekdayTiers, setEnableWeekdayTiers] = useState<boolean>(
    defaultStatutory.enableWeekdayTiers ?? false,
  );
  const [weekdayTier1HoursCap, setWeekdayTier1HoursCap] = useState<number | null>(
    defaultStatutory.weekdayTier1HoursCap ?? null,
  );
  const [weekdayTier2Multiplier, setWeekdayTier2Multiplier] = useState<number | null>(
    defaultStatutory.weekdayTier2Multiplier ?? null,
  );

  const [weekendMultiplier, setWeekendMultiplier] = useState<number>(
    defaultStatutory.weekendMultiplier ?? 2.0,
  );
  const [separateSaturdaySunday, setSeparateSaturdaySunday] = useState<boolean>(
    defaultStatutory.separateSaturdaySunday ?? false,
  );
  const [saturdayMultiplier, setSaturdayMultiplier] = useState<number>(
    defaultStatutory.saturdayMultiplier ?? 1.5,
  );
  const [sundayMultiplier, setSundayMultiplier] = useState<number>(
    defaultStatutory.sundayMultiplier ?? 2.0,
  );

  const [holidayMultiplier, setHolidayMultiplier] = useState<number>(
    defaultStatutory.holidayMultiplier ?? 2.5,
  );

  const [nightMultiplier, setNightMultiplier] = useState<number>(
    defaultStatutory.nightMultiplier ?? 1.15,
  );
  const [nightShiftWindowStart, setNightShiftWindowStart] = useState<string>(
    defaultStatutory.nightShiftWindowStart ?? '18:00',
  );
  const [nightShiftWindowEnd, setNightShiftWindowEnd] = useState<string>(
    defaultStatutory.nightShiftWindowEnd ?? '06:00',
  );

  // Section 4: Overtime Caps & Breach Governance
  const [maxDailyOvertimeHours, setMaxDailyOvertimeHours] = useState<number | null>(
    defaultStatutory.maxDailyOvertimeHours ?? null,
  );
  const [maxWeeklyOvertimeHours, setMaxWeeklyOvertimeHours] = useState<number | null>(
    defaultStatutory.maxWeeklyOvertimeHours ?? null,
  );
  const [maxMonthlyOvertimeHours, setMaxMonthlyOvertimeHours] = useState<number | null>(
    defaultStatutory.maxMonthlyOvertimeHours ?? null,
  );
  const [actionOnCapBreach, setActionOnCapBreach] = useState<OvertimeCapBreachAction>(
    defaultStatutory.actionOnCapBreach ?? 'flag',
  );
  const [requireManagerApproval, setRequireManagerApproval] = useState<boolean>(
    defaultStatutory.requireManagerApproval ?? true,
  );
  const [timeOffInLieuAllowed, setTimeOffInLieuAllowed] = useState<boolean>(
    defaultStatutory.timeOffInLieuAllowed ?? true,
  );
  const [notes, setNotes] = useState<string>(defaultStatutory.notes || '');

  // Version Metadata Form
  const [effectiveFrom, setEffectiveFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [changeNote, setChangeNote] = useState('');

  // Modals state
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [newVersionEffectiveFrom, setNewVersionEffectiveFrom] = useState(
    `${new Date().getFullYear() + 1}-01-01`,
  );
  const [newVersionEffectiveTo, setNewVersionEffectiveTo] = useState('');
  const [newVersionSourceReference, setNewVersionSourceReference] = useState(
    country.isoCode === 'AUS'
      ? 'Fair Work Act 2009 (NES) - Working Hours & Overtime'
      : `${country.name} Statutory Labor Standards Act`,
  );
  const [newVersionChangeNote, setNewVersionChangeNote] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Active section tab in editor
  const [editorSection, setEditorSection] = useState<'hours' | 'multipliers' | 'caps' | 'simulator'>('hours');

  // Interactive What-If Simulator State
  const [simWorkedHours, setSimWorkedHours] = useState<number>(10.0);
  const [simDayType, setSimDayType] = useState<'weekday' | 'saturday' | 'sunday' | 'holiday'>('weekday');
  const [simNightHours, setSimNightHours] = useState<number>(0);

  // Active version derived
  const currentVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId],
  );

  const isPublished = currentVersion?.status === 'published';
  const selectedState = states.find((s) => s.id === selectedStateId);

  // Load versions from API
  const loadVersions = async (selectId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await listRuleVersions(country.id, {
        ruleType: activeRuleType,
        stateProvinceId: selectedStateId || undefined,
      });
      setVersions(data);

      if (data.length > 0) {
        const target = selectId ? data.find((v) => v.id === selectId) : data[0];
        const active = target || data[0];
        setSelectedVersionId(active.id);
        populateFromVersion(active);
      } else {
        setSelectedVersionId(null);
        resetToDefaults();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load working hours & overtime rule versions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVersions();
  }, [country.id, selectedStateId, activeRuleType]);

  const resetToDefaults = () => {
    const d = getDefaultWorkingHoursOtForCountry(country.isoCode);
    setStandardDailyHours(d.standardDailyHours);
    setStandardWeeklyHours(d.standardWeeklyHours);
    setMaxDailyHours(d.maxDailyHours ?? 10);
    setMaxWeeklyHours(d.maxWeeklyHours ?? 48);
    setMaxConsecutiveDays(d.maxConsecutiveDays ?? 6);

    setRestBreakRequiredAfterHours(d.restBreakRequiredAfterHours ?? 5);
    setMinimumRestBreakMinutes(d.minimumRestBreakMinutes ?? 30);
    setDailyRestPeriodHours(d.dailyRestPeriodHours ?? 11);
    setPaidBreakMinutes(d.paidBreakMinutes ?? 0);

    setWeekdayMultiplier(d.weekdayMultiplier ?? 1.5);
    setEnableWeekdayTiers(d.enableWeekdayTiers ?? false);
    setWeekdayTier1HoursCap(d.weekdayTier1HoursCap ?? null);
    setWeekdayTier2Multiplier(d.weekdayTier2Multiplier ?? null);

    setWeekendMultiplier(d.weekendMultiplier ?? 2.0);
    setSeparateSaturdaySunday(d.separateSaturdaySunday ?? false);
    setSaturdayMultiplier(d.saturdayMultiplier ?? 1.5);
    setSundayMultiplier(d.sundayMultiplier ?? 2.0);

    setHolidayMultiplier(d.holidayMultiplier ?? 2.5);
    setNightMultiplier(d.nightMultiplier ?? 1.15);
    setNightShiftWindowStart(d.nightShiftWindowStart ?? '18:00');
    setNightShiftWindowEnd(d.nightShiftWindowEnd ?? '06:00');

    setMaxDailyOvertimeHours(d.maxDailyOvertimeHours ?? null);
    setMaxWeeklyOvertimeHours(d.maxWeeklyOvertimeHours ?? null);
    setMaxMonthlyOvertimeHours(d.maxMonthlyOvertimeHours ?? null);
    setActionOnCapBreach(d.actionOnCapBreach ?? 'flag');
    setRequireManagerApproval(d.requireManagerApproval ?? true);
    setTimeOffInLieuAllowed(d.timeOffInLieuAllowed ?? true);
    setNotes(d.notes || '');

    setEffectiveFrom(`${new Date().getFullYear()}-01-01`);
    setEffectiveTo('');
    setSourceReference(
      country.isoCode === 'AUS'
        ? 'Fair Work Act 2009 (NES §62)'
        : `${country.name} Statutory Labor Code`,
    );
    setChangeNote('Initial working hours & overtime rules baseline');
  };

  const populateFromVersion = (v: RuleVersionView) => {
    setEffectiveFrom(v.effectiveFrom);
    setEffectiveTo(v.effectiveTo || '');
    setSourceReference(v.sourceReference);
    setChangeNote(v.changeNote);

    const payload = normalizeWorkingHoursOtPayload(
      (v.payload as unknown as Record<string, unknown>) || {},
      country.isoCode,
    );

    setStandardDailyHours(payload.standardDailyHours);
    setStandardWeeklyHours(payload.standardWeeklyHours);
    setMaxDailyHours(payload.maxDailyHours ?? 10);
    setMaxWeeklyHours(payload.maxWeeklyHours ?? 48);
    setMaxConsecutiveDays(payload.maxConsecutiveDays ?? 6);

    setRestBreakRequiredAfterHours(payload.restBreakRequiredAfterHours ?? 5);
    setMinimumRestBreakMinutes(payload.minimumRestBreakMinutes ?? 30);
    setDailyRestPeriodHours(payload.dailyRestPeriodHours ?? 11);
    setPaidBreakMinutes(payload.paidBreakMinutes ?? 0);

    setWeekdayMultiplier(payload.weekdayMultiplier ?? 1.5);
    setEnableWeekdayTiers(payload.enableWeekdayTiers ?? false);
    setWeekdayTier1HoursCap(payload.weekdayTier1HoursCap ?? null);
    setWeekdayTier2Multiplier(payload.weekdayTier2Multiplier ?? null);

    setWeekendMultiplier(payload.weekendMultiplier ?? 2.0);
    setSeparateSaturdaySunday(payload.separateSaturdaySunday ?? false);
    setSaturdayMultiplier(payload.saturdayMultiplier ?? 1.5);
    setSundayMultiplier(payload.sundayMultiplier ?? 2.0);

    setHolidayMultiplier(payload.holidayMultiplier ?? 2.5);
    setNightMultiplier(payload.nightMultiplier ?? 1.15);
    setNightShiftWindowStart(payload.nightShiftWindowStart ?? '18:00');
    setNightShiftWindowEnd(payload.nightShiftWindowEnd ?? '06:00');

    setMaxDailyOvertimeHours(payload.maxDailyOvertimeHours ?? null);
    setMaxWeeklyOvertimeHours(payload.maxWeeklyOvertimeHours ?? null);
    setMaxMonthlyOvertimeHours(payload.maxMonthlyOvertimeHours ?? null);
    setActionOnCapBreach(payload.actionOnCapBreach ?? 'flag');
    setRequireManagerApproval(payload.requireManagerApproval ?? true);
    setTimeOffInLieuAllowed(payload.timeOffInLieuAllowed ?? true);
    setNotes(payload.notes || '');
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    const v = versions.find((item) => item.id === versionId);
    if (v) populateFromVersion(v);
  };

  // Build current payload
  const buildCurrentPayload = (): WorkingHoursOtRulePayload => {
    return {
      standardDailyHours,
      standardWeeklyHours,
      maxDailyHours,
      maxWeeklyHours,
      maxConsecutiveDays,

      restBreakRequiredAfterHours,
      minimumRestBreakMinutes,
      dailyRestPeriodHours,
      paidBreakMinutes,

      weekdayMultiplier,
      enableWeekdayTiers,
      weekdayTier1HoursCap: enableWeekdayTiers ? weekdayTier1HoursCap : null,
      weekdayTier2Multiplier: enableWeekdayTiers ? weekdayTier2Multiplier : null,

      weekendMultiplier,
      separateSaturdaySunday,
      saturdayMultiplier: separateSaturdaySunday ? saturdayMultiplier : weekendMultiplier,
      sundayMultiplier: separateSaturdaySunday ? sundayMultiplier : weekendMultiplier,

      holidayMultiplier,
      nightMultiplier,
      nightShiftWindowStart,
      nightShiftWindowEnd,

      maxDailyOvertimeHours,
      maxWeeklyOvertimeHours,
      maxMonthlyOvertimeHours,
      actionOnCapBreach,

      requireManagerApproval,
      timeOffInLieuAllowed,
      notes: notes.trim() || undefined,
    };
  };

  // Real-time validation
  const validation = useMemo(() => {
    const p = buildCurrentPayload();
    return validateWorkingHoursOtPayload(p);
  }, [
    standardDailyHours,
    standardWeeklyHours,
    maxDailyHours,
    maxWeeklyHours,
    maxConsecutiveDays,
    restBreakRequiredAfterHours,
    minimumRestBreakMinutes,
    dailyRestPeriodHours,
    paidBreakMinutes,
    weekdayMultiplier,
    enableWeekdayTiers,
    weekdayTier1HoursCap,
    weekdayTier2Multiplier,
    weekendMultiplier,
    separateSaturdaySunday,
    saturdayMultiplier,
    sundayMultiplier,
    holidayMultiplier,
    nightMultiplier,
    nightShiftWindowStart,
    nightShiftWindowEnd,
    maxDailyOvertimeHours,
    maxWeeklyOvertimeHours,
    maxMonthlyOvertimeHours,
    actionOnCapBreach,
  ]);

  // Live Overtime What-If calculation result
  const whatIfResult: OvertimeCalculationResult = useMemo(() => {
    const payload = buildCurrentPayload();
    return calculateOvertimePayBreakdown(
      {
        workedHours: simWorkedHours,
        dayType: simDayType,
        nightHours: simNightHours,
      },
      payload,
    );
  }, [
    simWorkedHours,
    simDayType,
    simNightHours,
    standardDailyHours,
    weekdayMultiplier,
    enableWeekdayTiers,
    weekdayTier1HoursCap,
    weekdayTier2Multiplier,
    weekendMultiplier,
    separateSaturdaySunday,
    saturdayMultiplier,
    sundayMultiplier,
    holidayMultiplier,
    nightMultiplier,
    maxDailyOvertimeHours,
    actionOnCapBreach,
  ]);

  const handleLoadPreset = (presetIso: string) => {
    const preset = getDefaultWorkingHoursOtForCountry(presetIso);
    setStandardDailyHours(preset.standardDailyHours);
    setStandardWeeklyHours(preset.standardWeeklyHours);
    setMaxDailyHours(preset.maxDailyHours ?? 10);
    setMaxWeeklyHours(preset.maxWeeklyHours ?? 48);
    setMaxConsecutiveDays(preset.maxConsecutiveDays ?? 6);

    setRestBreakRequiredAfterHours(preset.restBreakRequiredAfterHours ?? 5);
    setMinimumRestBreakMinutes(preset.minimumRestBreakMinutes ?? 30);
    setDailyRestPeriodHours(preset.dailyRestPeriodHours ?? 11);
    setPaidBreakMinutes(preset.paidBreakMinutes ?? 0);

    setWeekdayMultiplier(preset.weekdayMultiplier ?? 1.5);
    setEnableWeekdayTiers(preset.enableWeekdayTiers ?? false);
    setWeekdayTier1HoursCap(preset.weekdayTier1HoursCap ?? null);
    setWeekdayTier2Multiplier(preset.weekdayTier2Multiplier ?? null);

    setWeekendMultiplier(preset.weekendMultiplier ?? 2.0);
    setSeparateSaturdaySunday(preset.separateSaturdaySunday ?? false);
    setSaturdayMultiplier(preset.saturdayMultiplier ?? 1.5);
    setSundayMultiplier(preset.sundayMultiplier ?? 2.0);

    setHolidayMultiplier(preset.holidayMultiplier ?? 2.5);
    setNightMultiplier(preset.nightMultiplier ?? 1.15);
    setNightShiftWindowStart(preset.nightShiftWindowStart ?? '18:00');
    setNightShiftWindowEnd(preset.nightShiftWindowEnd ?? '06:00');

    setMaxDailyOvertimeHours(preset.maxDailyOvertimeHours ?? null);
    setMaxWeeklyOvertimeHours(preset.maxWeeklyOvertimeHours ?? null);
    setMaxMonthlyOvertimeHours(preset.maxMonthlyOvertimeHours ?? null);
    setActionOnCapBreach(preset.actionOnCapBreach ?? 'flag');
    setRequireManagerApproval(preset.requireManagerApproval ?? true);
    setTimeOffInLieuAllowed(preset.timeOffInLieuAllowed ?? true);
    setNotes(preset.notes || '');

    setSuccessMessage(`Loaded statutory preset: ${presetIso} benchmark.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Save changes to active draft or sunset date on published version
  const handleSaveDraft = async () => {
    if (!currentVersion) return;

    if (isPublished) {
      try {
        setSaving(true);
        setError(null);
        await updateRuleVersion(country.id, currentVersion.id, {
          effectiveTo: effectiveTo || null,
        });
        setSuccessMessage('Updated sunset / effectiveTo date for published overtime version.');
        await loadVersions(currentVersion.id);
        await onRefresh();
      } catch (err: any) {
        setError(err?.message || 'Failed to update sunset date.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!validation.isValid) {
      setError(`Cannot save draft overtime rules: ${validation.summaryError}`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload = buildCurrentPayload();

      await updateRuleVersion(country.id, currentVersion.id, {
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        sourceReference,
        changeNote,
        payload: payload as unknown as Record<string, unknown>,
      });

      setSuccessMessage('Successfully saved draft working hours & overtime rules.');
      await loadVersions(currentVersion.id);
      await onRefresh();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to save draft working hours & overtime rules.');
    } finally {
      setSaving(false);
    }
  };

  // Publish draft version
  const handlePublish = async (version: RuleVersionView) => {
    if (!validation.isValid) {
      setError(`Cannot publish rule version: ${validation.summaryError}`);
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      setSuccessMessage(null);

      // Save any pending edits first if publishing the currently active draft
      if (currentVersion?.id === version.id && version.status === 'draft') {
        const payload = buildCurrentPayload();
        await updateRuleVersion(country.id, version.id, {
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          sourceReference,
          changeNote,
          payload: payload as unknown as Record<string, unknown>,
        });
      }

      await publishRuleVersion(country.id, version.id);
      setSuccessMessage(
        `Version ${version.version} is now PUBLISHED and effective from ${version.effectiveFrom}.`,
      );
      await loadVersions(version.id);
      await onRefresh();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to publish overtime rule version.');
    } finally {
      setPublishing(false);
    }
  };

  // Create new version modal submit
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
        ruleType: activeRuleType,
        stateProvinceId: selectedStateId || undefined,
        effectiveFrom: newVersionEffectiveFrom,
        effectiveTo: newVersionEffectiveTo || undefined,
        sourceReference: newVersionSourceReference.trim() || `${country.name} Statutory Labor Act`,
        changeNote: newVersionChangeNote.trim() || 'New statutory overtime schedule revision',
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

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & SCOPE BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" role="img" aria-label="country-flag">
                {country.isoCode === 'AUS' ? '🇦🇺' : country.isoCode === 'BGD' ? '🇧🇩' : country.isoCode === 'USA' ? '🇺🇸' : country.isoCode === 'GBR' ? '🇬🇧' : '🌐'}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Overtime & Working Hours Editor
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Stage C.06 • NES & FLSA
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      completeness.tone === 'green'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : completeness.tone === 'amber'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {completeness.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Standard daily/weekly thresholds, mandatory rest periods, overtime multiplier tiers, and non-destructive cap governance (ATTENDANCE_LOGIC.md §4 & PAYROLL_LOGIC.md §9).
                </p>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 px-1 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Statutory Presets:
            </span>
            <button
              type="button"
              onClick={() => handleLoadPreset('AUS')}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium transition"
              title="Fair Work Act 2009 (NES): 38h week, 1.5× first 2h then 2.0×, 2.5× public holiday, 11h daily rest."
            >
              🇦🇺 AUS (Fair Work)
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('BGD')}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium transition"
              title="Bangladesh Labor Act 2006: 48h week, 2.0× OT, max 60h ceiling, 1h break after 6h."
            >
              🇧🇩 BGD (Labor Act)
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('USA')}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium transition"
              title="US FLSA: 40h standard week, 1.5× OT."
            >
              🇺🇸 USA (FLSA)
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('GBR')}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium transition"
              title="UK Working Time Regs: 37.5h standard week, 48h max average, 11h daily rest."
            >
              🇬🇧 GBR (WTR)
            </button>
          </div>
        </div>

        {/* Scope selector */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-500" /> Regulatory Scope:
            </span>
            <div className="inline-flex rounded-md shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedStateId('')}
                className={`px-3 py-1.5 text-xs font-medium rounded-l-md border transition ${
                  selectedStateId === ''
                    ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                National Baseline ({country.isoCode})
              </button>
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                className={`px-2 py-1.5 text-xs border border-l-0 rounded-r-md transition focus:outline-none ${
                  selectedStateId !== ''
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-medium'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <option value="">State / Province Override...</option>
                {states.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>
            {selectedState && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs">
                <Building2 className="w-3.5 h-3.5" />
                State Override: <strong>{selectedState.name} ({selectedState.code})</strong>
              </span>
            )}
          </div>

          {/* Sub-tab section switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setEditorSection('hours')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                editorSection === 'hours'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Hours & Breaks
            </button>
            <button
              type="button"
              onClick={() => setEditorSection('multipliers')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                editorSection === 'multipliers'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Multipliers & Night
            </button>
            <button
              type="button"
              onClick={() => setEditorSection('caps')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                editorSection === 'caps'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Caps & Governance
            </button>
            <button
              type="button"
              onClick={() => setEditorSection('simulator')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                editorSection === 'simulator'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" /> What-If Simulator
            </button>
          </div>
        </div>
      </div>

      {/* 2. RULE VERSION SELECTOR BAR */}
      <RuleVersionSelector
        versions={versions}
        selectedVersionId={selectedVersionId}
        onSelectVersion={handleVersionChange}
        onCreateNewVersion={() => {
          setNewVersionEffectiveFrom(`${new Date().getFullYear() + 1}-01-01`);
          setNewVersionEffectiveTo('');
          setNewVersionSourceReference(sourceReference || `${country.name} Statutory Labor Act`);
          setNewVersionChangeNote('');
          setIsNewVersionModalOpen(true);
        }}
        onCompareVersions={() => setIsDiffModalOpen(true)}
        onPublishVersion={(versionId) => {
          const v = versions.find((item) => item.id === versionId);
          if (v) void handlePublish(v);
        }}
        isPublishing={publishing}
      />

      {/* Feedback alerts */}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <strong>Validation / System Error:</strong> {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Published Locked Warning */}
      {isPublished && currentVersion && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Version {currentVersion.version} is PUBLISHED & LOCKED.</strong> Working hours and overtime multiplier parameters are immutable. To revise statutory rules, click <strong>New Version</strong>. You may edit the <em>effectiveTo</em> sunset date below.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewVersionEffectiveFrom(`${new Date().getFullYear() + 1}-01-01`);
              setNewVersionEffectiveTo('');
              setNewVersionSourceReference(sourceReference || `${country.name} Statutory Labor Act`);
              setNewVersionChangeNote('');
              setIsNewVersionModalOpen(true);
            }}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-xs shadow-sm transition whitespace-nowrap"
          >
            Create Draft v{versions.length + 1}
          </button>
        </div>
      )}

      {/* 3. VERSION METADATA & DATES */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-800">
              Version {currentVersion ? currentVersion.version : 1} Effective Dating & Gazette Authority
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Status:{' '}
              <strong className={isPublished ? 'text-emerald-600' : 'text-amber-600'}>
                {currentVersion?.status?.toUpperCase() || 'DRAFT'}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Effective From (Inclusive)</label>
            <input
              type="date"
              disabled={isPublished}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Effective To (Sunset Date)
            </label>
            <input
              type="date"
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
              placeholder="Open-ended if empty"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Leave blank for open-ended active rule.</p>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Gazette / Statutory Reference</label>
            <input
              type="text"
              disabled={isPublished}
              value={sourceReference}
              onChange={(e) => setSourceReference(e.target.value)}
              placeholder="e.g. Fair Work Act 2009 (NES §62)"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Change Note</label>
            <input
              type="text"
              disabled={isPublished}
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Reason for revision..."
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* 4. MAIN CONFIGURATION PANELS */}
      {/* SECTION A: STANDARD HOURS & BREAK RULES */}
      {(editorSection === 'hours' || editorSection === 'simulator') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Standard Hours & Statutory Ceilings */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-800">
                  Standard Hours & Maximum Ceilings
                </h4>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                ATTENDANCE_LOGIC.md §4
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Standard Daily Hours <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="24"
                      disabled={isPublished}
                      value={standardDailyHours}
                      onChange={(e) => setStandardDailyHours(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-semibold text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">hrs</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">e.g. 7.6h (AUS 38h/5d) or 8.0h (standard).</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Standard Weekly Hours <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="168"
                      disabled={isPublished}
                      value={standardWeeklyHours}
                      onChange={(e) => setStandardWeeklyHours(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-semibold text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">hrs</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">e.g. 38.0h (AU NES) or 40.0h (USA FLSA) or 48.0h (BGD).</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Daily Working Hours
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min={standardDailyHours}
                      max="24"
                      disabled={isPublished}
                      value={maxDailyHours}
                      onChange={(e) => setMaxDailyHours(parseFloat(e.target.value) || standardDailyHours)}
                      placeholder="e.g. 10.0"
                      className="w-full px-2.5 py-1.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">hrs</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Absolute statutory cap on shift length.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Weekly Working Hours
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min={standardWeeklyHours}
                      max="168"
                      disabled={isPublished}
                      value={maxWeeklyHours}
                      onChange={(e) => setMaxWeeklyHours(parseFloat(e.target.value) || standardWeeklyHours)}
                      placeholder="e.g. 48.0"
                      className="w-full px-2.5 py-1.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">hrs</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">e.g. UK Working Time 48h limit or BGD 60h cap.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block font-semibold text-slate-700 mb-1">
                  Maximum Consecutive Working Days
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    min="1"
                    max="14"
                    disabled={isPublished}
                    value={maxConsecutiveDays}
                    onChange={(e) => setMaxConsecutiveDays(parseInt(e.target.value, 10) || 6)}
                    className="w-full px-2.5 py-1.5 pr-12 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">days</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Mandates at least 1 day of statutory rest per rolling 7 days (usually 6 days).</p>
              </div>
            </div>
          </div>

          {/* Card 2: Minimum Rest Breaks & Rest Periods */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-bold text-slate-800">
                  Mandatory Breaks & Daily Rest Periods
                </h4>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                Health & Safety Statutory
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Break Trigger After
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max={standardDailyHours}
                      disabled={isPublished}
                      value={restBreakRequiredAfterHours}
                      onChange={(e) => setRestBreakRequiredAfterHours(parseFloat(e.target.value) || 5)}
                      className="w-full px-2.5 py-1.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">hrs</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">e.g. 5.0h continuous work requires a rest break.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Minimum Rest Break Duration
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="5"
                      min="0"
                      max="240"
                      disabled={isPublished}
                      value={minimumRestBreakMinutes}
                      onChange={(e) => setMinimumRestBreakMinutes(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2.5 py-1.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">min</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Unpaid meal/meal break entitlement (e.g. 30m or 60m).</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block font-semibold text-slate-700 mb-1">
                  Daily Rest Period Between Shifts
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    disabled={isPublished}
                    value={dailyRestPeriodHours}
                    onChange={(e) => setDailyRestPeriodHours(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">hrs</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Consecutive rest required between end of shift and start of next shift (e.g. 11h per EU/UK/AUS awards; penalty rates trigger if breached).
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block font-semibold text-slate-700 mb-1">
                  Paid Tea / Rest Break Included
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    step="5"
                    min="0"
                    max="60"
                    disabled={isPublished}
                    value={paidBreakMinutes}
                    onChange={(e) => setPaidBreakMinutes(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2.5 py-1.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">min</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Counted as paid working time (e.g. 10m rest interval per 4h worked).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B: OVERTIME MULTIPLIERS & NIGHT SHIFT */}
      {(editorSection === 'multipliers' || editorSection === 'simulator') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-bold text-slate-800">
                Statutory Overtime Multipliers & Penalty Rates
              </h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
              PAYROLL_LOGIC.md §9 Multipliers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
            {/* 1. Weekday Overtime */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-600" /> Weekday Overtime
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Mon – Fri</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tier 1 / Base Multiplier <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="10.0"
                    disabled={isPublished}
                    value={weekdayMultiplier}
                    onChange={(e) => setWeekdayMultiplier(parseFloat(e.target.value) || 1.5)}
                    className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-bold text-indigo-700"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">×</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">e.g. 1.5× (Time and a half) or 2.0× (Double time).</p>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isPublished}
                    checked={enableWeekdayTiers}
                    onChange={(e) => setEnableWeekdayTiers(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-700">Enable Two-Tier Weekday Overtime</span>
                </label>

                {enableWeekdayTiers && (
                  <div className="grid grid-cols-2 gap-2 pl-5 pt-1">
                    <div>
                      <label className="block font-medium text-slate-600 mb-0.5">Tier 1 Cap</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="8"
                          disabled={isPublished}
                          value={weekdayTier1HoursCap ?? 2}
                          onChange={(e) => setWeekdayTier1HoursCap(parseFloat(e.target.value) || 2)}
                          className="w-full px-2 py-1 pr-6 border border-slate-300 rounded text-slate-800"
                        />
                        <span className="absolute right-2 top-1 text-slate-400">h</span>
                      </div>
                      <p className="text-[9px] text-slate-400">e.g. first 2 hours</p>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-600 mb-0.5">Tier 2 Multiplier</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.05"
                          min={weekdayMultiplier}
                          max="10.0"
                          disabled={isPublished}
                          value={weekdayTier2Multiplier ?? 2.0}
                          onChange={(e) => setWeekdayTier2Multiplier(parseFloat(e.target.value) || 2.0)}
                          className="w-full px-2 py-1 pr-6 border border-slate-300 rounded text-indigo-700 font-bold"
                        />
                        <span className="absolute right-2 top-1 text-slate-400">×</span>
                      </div>
                      <p className="text-[9px] text-slate-400">e.g. 2.0× thereafter</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Weekend & Public Holiday Overtime */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-600" /> Weekend & Holiday Rates
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Sat / Sun / PH</span>
              </div>

              {!separateSaturdaySunday ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Combined Weekend Multiplier <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="10.0"
                      disabled={isPublished}
                      value={weekendMultiplier}
                      onChange={(e) => setWeekendMultiplier(parseFloat(e.target.value) || 2.0)}
                      className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-bold text-indigo-700"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">×</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Applies to both Saturday and Sunday shifts.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Saturday</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        min="1.0"
                        max="10.0"
                        disabled={isPublished}
                        value={saturdayMultiplier}
                        onChange={(e) => setSaturdayMultiplier(parseFloat(e.target.value) || 1.5)}
                        className="w-full px-2 py-1 pr-6 border border-slate-300 rounded font-bold text-indigo-700"
                      />
                      <span className="absolute right-2 top-1 text-slate-400">×</span>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sunday</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        min="1.0"
                        max="10.0"
                        disabled={isPublished}
                        value={sundayMultiplier}
                        onChange={(e) => setSundayMultiplier(parseFloat(e.target.value) || 2.0)}
                        className="w-full px-2 py-1 pr-6 border border-slate-300 rounded font-bold text-indigo-700"
                      />
                      <span className="absolute right-2 top-1 text-slate-400">×</span>
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  disabled={isPublished}
                  checked={separateSaturdaySunday}
                  onChange={(e) => setSeparateSaturdaySunday(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-600">Differentiate Saturday vs Sunday Rates</span>
              </label>

              <div className="pt-2 border-t border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1">
                  Public Holiday Multiplier <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="10.0"
                    disabled={isPublished}
                    value={holidayMultiplier}
                    onChange={(e) => setHolidayMultiplier(parseFloat(e.target.value) || 2.5)}
                    className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-bold text-purple-700"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">×</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Statutory holiday penalty (typically 2.0× or 2.5×).</p>
              </div>
            </div>

            {/* 3. Night Shift Loading & Window */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-blue-600" /> Night Shift Loading
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Unsocial Hours</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Night Shift Rate Multiplier <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1.0"
                    max="5.0"
                    disabled={isPublished}
                    value={nightMultiplier}
                    onChange={(e) => setNightMultiplier(parseFloat(e.target.value) || 1.15)}
                    className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-bold text-blue-700"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">×</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  e.g. 1.15× (+15% loading for AUS Modern Awards) or 1.25× (+25%).
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1">
                  Night Shift Window (24h HH:mm)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Starts:</span>
                    <input
                      type="time"
                      disabled={isPublished}
                      value={nightShiftWindowStart}
                      onChange={(e) => setNightShiftWindowStart(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-slate-800"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Ends:</span>
                    <input
                      type="time"
                      disabled={isPublished}
                      value={nightShiftWindowEnd}
                      onChange={(e) => setNightShiftWindowEnd(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-slate-800"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Hours worked between {nightShiftWindowStart} and {nightShiftWindowEnd} accrue night shift loading.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION C: OVERTIME CAPS & BREACH GOVERNANCE */}
      {(editorSection === 'caps' || editorSection === 'simulator') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h4 className="text-sm font-bold text-slate-800">
                Overtime Ceilings & Breach Governance Policy
              </h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700 font-medium">
              PAYROLL_LOGIC.md §9 Mandatory Governance
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Daily Overtime</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="12"
                  disabled={isPublished}
                  value={maxDailyOvertimeHours ?? ''}
                  onChange={(e) => setMaxDailyOvertimeHours(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 4.0"
                  className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800 font-medium"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400">h</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Cap on daily overtime hours.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Weekly Overtime</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="60"
                  disabled={isPublished}
                  value={maxWeeklyOvertimeHours ?? ''}
                  onChange={(e) => setMaxWeeklyOvertimeHours(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 12.0"
                  className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800 font-medium"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400">h</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Statutory weekly OT cap.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Monthly Overtime</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="120"
                  disabled={isPublished}
                  value={maxMonthlyOvertimeHours ?? ''}
                  onChange={(e) => setMaxMonthlyOvertimeHours(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 50.0"
                  className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800 font-medium"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400">h</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Monthly statutory threshold.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Action on Cap Breach <span className="text-red-500">*</span>
              </label>
              <select
                disabled={isPublished}
                value={actionOnCapBreach}
                onChange={(e) => setActionOnCapBreach(e.target.value as OvertimeCapBreachAction)}
                className={`w-full px-2.5 py-1.5 border rounded-md font-semibold ${
                  actionOnCapBreach === 'flag'
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                    : 'border-red-300 bg-red-50 text-red-900'
                }`}
              >
                <option value="flag">flag (Flag Exception for Payroll Review)</option>
                <option value="auto_cap">auto_cap (Auto-Cap Payable Overtime)</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {actionOnCapBreach === 'flag'
                  ? 'Per PAYROLL_LOGIC.md §9: Flag exception for review, non-destructive.'
                  : 'Payable overtime truncated strictly at statutory ceiling.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isPublished}
                  checked={requireManagerApproval}
                  onChange={(e) => setRequireManagerApproval(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Require Manager Approval Before Payroll Inclusion</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isPublished}
                  checked={timeOffInLieuAllowed}
                  onChange={(e) => setTimeOffInLieuAllowed(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Time Off In Lieu (TOIL) Allowed in Place of Overtime Pay</span>
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Statutory Notes & Legal Provisions</label>
              <textarea
                rows={2}
                disabled={isPublished}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Statutory award references, exemptions, or collective bargaining rules..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: INTERACTIVE LIVE WHAT-IF SIMULATOR */}
      {editorSection === 'simulator' && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 rounded-xl p-5 text-white shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-900/60 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              <div>
                <h4 className="text-sm font-bold text-white">
                  Live Overtime & Penalty Rate What-If Simulator
                </h4>
                <p className="text-xs text-indigo-200">
                  Simulate single shift calculation against current rule draft in real-time.
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded bg-indigo-800/80 text-indigo-200 font-mono font-medium">
              Pure Engine: calculateOvertimePayBreakdown
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-indigo-200 mb-1">Hours Worked in Shift</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={simWorkedHours}
                  onChange={(e) => setSimWorkedHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-indigo-700/60 rounded text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                />
                <span className="absolute right-3 top-2 text-indigo-300 font-medium">hrs</span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-indigo-200 mb-1">Shift Day Type</label>
              <select
                value={simDayType}
                onChange={(e) => setSimDayType(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-indigo-700/60 rounded text-white font-semibold text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="weekday">Weekday (Mon–Fri)</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
                <option value="holiday">Public Holiday</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-indigo-200 mb-1">Night Window Hours</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={simNightHours}
                  onChange={(e) => setSimNightHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-indigo-700/60 rounded text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                />
                <span className="absolute right-3 top-2 text-indigo-300 font-medium">hrs</span>
              </div>
            </div>
          </div>

          {/* Simulation Output Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Standard Hours</span>
              <span className="text-base font-bold text-white">{whatIfResult.standardHours.toFixed(2)}h</span>
              <span className="text-[10px] text-slate-400 block">@ 1.0× ordinary</span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tier 1 OT</span>
              <span className="text-base font-bold text-amber-400">{whatIfResult.tier1OvertimeHours.toFixed(2)}h</span>
              <span className="text-[10px] text-slate-400 block">
                @ {simDayType === 'weekday' ? weekdayMultiplier : simDayType === 'saturday' ? saturdayMultiplier : simDayType === 'sunday' ? sundayMultiplier : holidayMultiplier}×
              </span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tier 2 OT</span>
              <span className="text-base font-bold text-orange-400">{whatIfResult.tier2OvertimeHours.toFixed(2)}h</span>
              <span className="text-[10px] text-slate-400 block">
                @ {weekdayTier2Multiplier ?? weekdayMultiplier}×
              </span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Night Loading</span>
              <span className="text-base font-bold text-blue-400">{whatIfResult.nightHoursPayable.toFixed(2)}h</span>
              <span className="text-[10px] text-slate-400 block">@ {whatIfResult.nightRateMultiplier}×</span>
            </div>

            <div className="p-3 bg-indigo-900/60 rounded-lg border border-indigo-700/80">
              <span className="text-indigo-300 block text-[10px] uppercase font-semibold">Equivalent Ordinary</span>
              <span className="text-base font-extrabold text-emerald-400">
                {whatIfResult.equivalentRegularHours.toFixed(2)}h
              </span>
              <span className="text-[10px] text-indigo-300 block">payroll hours</span>
            </div>

            <div className="p-3 bg-indigo-900/60 rounded-lg border border-indigo-700/80">
              <span className="text-indigo-300 block text-[10px] uppercase font-semibold">Effective Multiplier</span>
              <span className="text-base font-extrabold text-emerald-400">
                {whatIfResult.effectiveMultiplier.toFixed(2)}×
              </span>
              <span className="text-[10px] text-indigo-300 block">blended rate</span>
            </div>
          </div>

          {/* Breach Status Banner */}
          {whatIfResult.isCapBreached && (
            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
              actionOnCapBreach === 'flag'
                ? 'bg-amber-950/80 border-amber-600/80 text-amber-200'
                : 'bg-red-950/80 border-red-600/80 text-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>
                  <strong>Daily Overtime Ceiling Breached:</strong> Shift overtime ({whatIfResult.overtimeHoursBeforeCap.toFixed(2)}h) exceeds daily cap ({maxDailyOvertimeHours}h).
                </span>
              </div>
              <span className="font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[11px] bg-slate-900 border border-slate-700">
                {actionOnCapBreach === 'flag' ? '⚠️ FLAGGED FOR REVIEW' : '🛑 AUTO-CAPPED'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 5. BOTTOM ACTIONS BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          {!validation.isValid ? (
            <span className="text-red-600 font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {validation.summaryError}
            </span>
          ) : (
            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              All parameters valid and compliant with ATTENDANCE_LOGIC.md and PAYROLL_LOGIC.md.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={isPublished || saving || publishing}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Statutory Defaults
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || publishing}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isPublished ? 'Update Sunset Date' : 'Save Draft Version'}
          </button>

          {currentVersion && currentVersion.status === 'draft' && (
            <button
              type="button"
              onClick={() => handlePublish(currentVersion)}
              disabled={publishing || saving || !validation.isValid}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Publish Version {currentVersion.version}
            </button>
          )}
        </div>
      </div>

      {/* 6. MODALS */}
      {/* Create New Version Modal */}
      <Modal
        open={isNewVersionModalOpen}
        onClose={() => setIsNewVersionModalOpen(false)}
        title={`Create New Overtime & Working Hours Version (v${versions.length + 1})`}
      >
        <form onSubmit={handleCreateNewVersion} className="space-y-4 text-xs">
          <p className="text-slate-500">
            A new version will be created as a <strong>DRAFT</strong> cloned from your current settings. Published versions remain locked for historical payroll reproducibility.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Effective From (Inclusive) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={newVersionEffectiveFrom}
              onChange={(e) => setNewVersionEffectiveFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Effective To (Sunset Date)
            </label>
            <input
              type="date"
              value={newVersionEffectiveTo}
              onChange={(e) => setNewVersionEffectiveTo(e.target.value)}
              placeholder="Leave blank if open-ended"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Leave blank for open-ended version.</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Gazette / Statutory Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newVersionSourceReference}
              onChange={(e) => setNewVersionSourceReference(e.target.value)}
              placeholder="e.g. Fair Work Ombudsman 2026 Schedule"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Change Note / Revision Purpose <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newVersionChangeNote}
              onChange={(e) => setNewVersionChangeNote(e.target.value)}
              placeholder="e.g. Annual modern award overtime schedule adjustments"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewVersionModalOpen(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingVersion}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold flex items-center gap-1.5"
            >
              {creatingVersion && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Draft Version
            </button>
          </div>
        </form>
      </Modal>

      {/* Compare Versions Diff Modal */}
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
