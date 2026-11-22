import { useEffect, useMemo, useState } from 'react';
import type {
  CountryConfiguration,
  CountrySummary,
  EmploymentTerminationRulePayload,
  EmploymentTypeKind,
  FinalSettlementComponentConfig,
  FinalSettlementComponentKind,
  FinalSettlementTaxability,
  NoticePeriodTier,
  RuleVersionView,
  SeveranceCalculationResult,
  SeveranceFormulaType,
  SeveranceTenureTableTier,
  StateProvinceView,
  StatutoryContractRequirements,
  StructuredSeveranceFormula,
} from '@hrm/shared-types';
import {
  calculateNoticePeriod,
  evaluateStructuredSeveranceFormula,
  getDefaultEmploymentTerminationForCountry,
  normalizeEmploymentTerminationPayload,
  validateEmploymentTerminationPayload,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  DollarSign,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
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

interface EmploymentTerminationRulesEditorProps {
  country: CountrySummary;
  states?: StateProvinceView[];
  configuration: CountryConfiguration | null;
  completeness: { isComplete: boolean; label: string; tone: 'green' | 'amber' | 'slate' };
  onRefresh: () => Promise<void>;
  defaultSection?: 'probation' | 'notice' | 'severance' | 'settlement' | 'simulator';
}

export function EmploymentTerminationRulesEditor({
  country,
  states = [],
  configuration,
  completeness,
  onRefresh,
  defaultSection = 'probation',
}: EmploymentTerminationRulesEditorProps) {
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

  // Active section tab
  const [activeSection, setActiveSection] = useState<'probation' | 'notice' | 'severance' | 'settlement' | 'simulator'>(
    defaultSection,
  );

  useEffect(() => {
    setActiveSection(defaultSection);
  }, [defaultSection]);

  const defaultStatutory = useMemo(
    () => getDefaultEmploymentTerminationForCountry(country.isoCode),
    [country.isoCode],
  );

  // 1. Probation limits state
  const [standardProbationMonths, setStandardProbationMonths] = useState<number>(
    defaultStatutory.standardProbationMonths,
  );
  const [maxProbationMonths, setMaxProbationMonths] = useState<number>(
    defaultStatutory.maxProbationMonths,
  );
  const [probationNoticeDays, setProbationNoticeDays] = useState<number>(
    defaultStatutory.probationNoticeDays,
  );
  const [probationExtensionAllowed, setProbationExtensionAllowed] = useState<boolean>(
    defaultStatutory.probationExtensionAllowed,
  );
  const [maxProbationExtensionMonths, setMaxProbationExtensionMonths] = useState<number | null>(
    defaultStatutory.maxProbationExtensionMonths ?? null,
  );

  // 2. Minimum notice periods state
  const [standardNoticeWeeks, setStandardNoticeWeeks] = useState<number>(
    defaultStatutory.standardNoticeWeeks,
  );
  const [employeeNoticeWeeks, setEmployeeNoticeWeeks] = useState<number>(
    defaultStatutory.employeeNoticeWeeks,
  );
  const [noticeTiers, setNoticeTiers] = useState<NoticePeriodTier[]>(
    defaultStatutory.noticeTiers,
  );
  const [seniorAgeBonusEnabled, setSeniorAgeBonusEnabled] = useState<boolean>(
    defaultStatutory.seniorAgeBonusEnabled,
  );
  const [seniorAgeThreshold, setSeniorAgeThreshold] = useState<number | null>(
    defaultStatutory.seniorAgeThreshold ?? 45,
  );
  const [seniorAgeAdditionalWeeks, setSeniorAgeAdditionalWeeks] = useState<number | null>(
    defaultStatutory.seniorAgeAdditionalWeeks ?? 1,
  );
  const [paymentInLieuOfNoticeAllowed, setPaymentInLieuOfNoticeAllowed] = useState<boolean>(
    defaultStatutory.paymentInLieuOfNoticeAllowed,
  );

  // 3. Severance formulas state (Structured JSON per PAYROLL_LOGIC.md §5, never eval)
  const [severancePayEligible, setSeverancePayEligible] = useState<boolean>(
    defaultStatutory.severancePayEligible,
  );
  const [severanceFormulaType, setSeveranceFormulaType] = useState<SeveranceFormulaType>(
    defaultStatutory.severanceFormula.type,
  );
  const [minimumServiceYearsRequired, setMinimumServiceYearsRequired] = useState<number>(
    defaultStatutory.severanceFormula.minimumServiceYearsRequired ?? 1,
  );
  const [maxSeveranceWeeks, setMaxSeveranceWeeks] = useState<number | null>(
    defaultStatutory.severanceFormula.maxSeveranceWeeks ?? 16,
  );
  const [maxSeveranceMonetaryCap, setMaxSeveranceMonetaryCap] = useState<number | null>(
    defaultStatutory.severanceFormula.maxSeveranceMonetaryCap ?? null,
  );
  const [tenureTable, setTenureTable] = useState<SeveranceTenureTableTier[]>(
    defaultStatutory.severanceFormula.tenureTable || [],
  );
  const [payUnitPerYear, setPayUnitPerYear] = useState<'weeks' | 'days' | 'months'>(
    defaultStatutory.severanceFormula.payUnitPerYear || 'weeks',
  );
  const [payUnitsPerYearNumber, setPayUnitsPerYearNumber] = useState<number>(
    defaultStatutory.severanceFormula.payUnitsPerYearNumber || 2,
  );
  const [proratePartialYears, setProratePartialYears] = useState<boolean>(
    defaultStatutory.severanceFormula.proratePartialYears ?? true,
  );

  // 4. Final settlement components state
  const [finalSettlementPaymentTimelineDays, setFinalSettlementPaymentTimelineDays] = useState<number>(
    defaultStatutory.finalSettlementPaymentTimelineDays,
  );
  const [mandatoryLeaveEncashment, setMandatoryLeaveEncashment] = useState<boolean>(
    defaultStatutory.mandatoryLeaveEncashment,
  );
  const [leaveEncashmentLoadingPercentage, setLeaveEncashmentLoadingPercentage] = useState<number | null>(
    defaultStatutory.leaveEncashmentLoadingPercentage ?? null,
  );
  const [finalSettlementComponents, setFinalSettlementComponents] = useState<FinalSettlementComponentConfig[]>(
    defaultStatutory.finalSettlementComponents,
  );

  // 5. Statutory contract requirements state
  const [writtenContractMandatory, setWrittenContractMandatory] = useState<boolean>(
    defaultStatutory.contractRequirements.writtenContractMandatory,
  );
  const [minAgeOfEmployment, setMinAgeOfEmployment] = useState<number>(
    defaultStatutory.contractRequirements.minAgeOfEmployment,
  );
  const [allowedEmploymentTypes, setAllowedEmploymentTypes] = useState<EmploymentTypeKind[]>(
    defaultStatutory.contractRequirements.allowedEmploymentTypes,
  );
  const [casualLoadingPercentage, setCasualLoadingPercentage] = useState<number | null>(
    defaultStatutory.contractRequirements.casualLoadingPercentage ?? null,
  );
  const [maxFixedTermMonths, setMaxFixedTermMonths] = useState<number | null>(
    defaultStatutory.contractRequirements.maxFixedTermMonths ?? null,
  );
  const [maxFixedTermRenewals, setMaxFixedTermRenewals] = useState<number | null>(
    defaultStatutory.contractRequirements.maxFixedTermRenewals ?? null,
  );
  const [minimumWageHourly, setMinimumWageHourly] = useState<number>(
    defaultStatutory.contractRequirements.minimumWageHourly,
  );
  const [minimumWageMonthly, setMinimumWageMonthly] = useState<number | null>(
    defaultStatutory.contractRequirements.minimumWageMonthly ?? null,
  );
  const [itemizedPayslipMandatory, setItemizedPayslipMandatory] = useState<boolean>(
    defaultStatutory.contractRequirements.itemizedPayslipMandatory,
  );
  const [mandatoryTerms, setMandatoryTerms] = useState<string[]>(
    defaultStatutory.contractRequirements.mandatoryTerms,
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
      ? 'Fair Work Act 2009 (NES §117 & §119)'
      : `${country.name} Statutory Employment Regulations`,
  );
  const [newVersionChangeNote, setNewVersionChangeNote] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Live separation & severance calculator state
  const [simServiceYears, setSimServiceYears] = useState<number>(4.5);
  const [simEmployeeAge, setSimEmployeeAge] = useState<number>(48);
  const [simWeeklyWage, setSimWeeklyWage] = useState<number>(1500);
  const [simUnusedLeaveHours, setSimUnusedLeaveHours] = useState<number>(76);
  const [simSeparationReason, setSimSeparationReason] = useState<'redundancy' | 'employer_dismissal' | 'resignation' | 'probation_exit'>('redundancy');

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
        ruleType: 'employment_rules',
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
      setError(err?.message || 'Failed to load employment and termination rule versions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVersions();
  }, [country.id, selectedStateId]);

  const resetToDefaults = () => {
    const d = getDefaultEmploymentTerminationForCountry(country.isoCode);
    setStandardProbationMonths(d.standardProbationMonths);
    setMaxProbationMonths(d.maxProbationMonths);
    setProbationNoticeDays(d.probationNoticeDays);
    setProbationExtensionAllowed(d.probationExtensionAllowed);
    setMaxProbationExtensionMonths(d.maxProbationExtensionMonths ?? null);

    setStandardNoticeWeeks(d.standardNoticeWeeks);
    setEmployeeNoticeWeeks(d.employeeNoticeWeeks);
    setNoticeTiers(d.noticeTiers);
    setSeniorAgeBonusEnabled(d.seniorAgeBonusEnabled);
    setSeniorAgeThreshold(d.seniorAgeThreshold ?? 45);
    setSeniorAgeAdditionalWeeks(d.seniorAgeAdditionalWeeks ?? 1);
    setPaymentInLieuOfNoticeAllowed(d.paymentInLieuOfNoticeAllowed);

    setSeverancePayEligible(d.severancePayEligible);
    setSeveranceFormulaType(d.severanceFormula.type);
    setMinimumServiceYearsRequired(d.severanceFormula.minimumServiceYearsRequired ?? 1);
    setMaxSeveranceWeeks(d.severanceFormula.maxSeveranceWeeks ?? 16);
    setMaxSeveranceMonetaryCap(d.severanceFormula.maxSeveranceMonetaryCap ?? null);
    setTenureTable(d.severanceFormula.tenureTable || []);
    setPayUnitPerYear(d.severanceFormula.payUnitPerYear || 'weeks');
    setPayUnitsPerYearNumber(d.severanceFormula.payUnitsPerYearNumber || 2);
    setProratePartialYears(d.severanceFormula.proratePartialYears ?? true);

    setFinalSettlementPaymentTimelineDays(d.finalSettlementPaymentTimelineDays);
    setMandatoryLeaveEncashment(d.mandatoryLeaveEncashment);
    setLeaveEncashmentLoadingPercentage(d.leaveEncashmentLoadingPercentage ?? null);
    setFinalSettlementComponents(d.finalSettlementComponents);

    setWrittenContractMandatory(d.contractRequirements.writtenContractMandatory);
    setMinAgeOfEmployment(d.contractRequirements.minAgeOfEmployment);
    setAllowedEmploymentTypes(d.contractRequirements.allowedEmploymentTypes);
    setCasualLoadingPercentage(d.contractRequirements.casualLoadingPercentage ?? null);
    setMaxFixedTermMonths(d.contractRequirements.maxFixedTermMonths ?? null);
    setMaxFixedTermRenewals(d.contractRequirements.maxFixedTermRenewals ?? null);
    setMinimumWageHourly(d.contractRequirements.minimumWageHourly);
    setMinimumWageMonthly(d.contractRequirements.minimumWageMonthly ?? null);
    setItemizedPayslipMandatory(d.contractRequirements.itemizedPayslipMandatory);
    setMandatoryTerms(d.contractRequirements.mandatoryTerms);

    setNotes(d.notes || '');

    setEffectiveFrom(`${new Date().getFullYear()}-01-01`);
    setEffectiveTo('');
    setSourceReference(
      country.isoCode === 'AUS'
        ? 'Fair Work Act 2009 (NES §117 & §119)'
        : `${country.name} Statutory Employment Regulations`,
    );
    setChangeNote('Initial employment & termination statutory baseline version');
  };

  const populateFromVersion = (v: RuleVersionView) => {
    setEffectiveFrom(v.effectiveFrom);
    setEffectiveTo(v.effectiveTo || '');
    setSourceReference(v.sourceReference);
    setChangeNote(v.changeNote);

    const payload = normalizeEmploymentTerminationPayload(
      (v.payload as unknown as Record<string, unknown>) || {},
      country.isoCode,
    );

    setStandardProbationMonths(payload.standardProbationMonths);
    setMaxProbationMonths(payload.maxProbationMonths);
    setProbationNoticeDays(payload.probationNoticeDays);
    setProbationExtensionAllowed(payload.probationExtensionAllowed);
    setMaxProbationExtensionMonths(payload.maxProbationExtensionMonths ?? null);

    setStandardNoticeWeeks(payload.standardNoticeWeeks);
    setEmployeeNoticeWeeks(payload.employeeNoticeWeeks);
    setNoticeTiers(payload.noticeTiers);
    setSeniorAgeBonusEnabled(payload.seniorAgeBonusEnabled);
    setSeniorAgeThreshold(payload.seniorAgeThreshold ?? 45);
    setSeniorAgeAdditionalWeeks(payload.seniorAgeAdditionalWeeks ?? 1);
    setPaymentInLieuOfNoticeAllowed(payload.paymentInLieuOfNoticeAllowed);

    setSeverancePayEligible(payload.severancePayEligible);
    setSeveranceFormulaType(payload.severanceFormula.type);
    setMinimumServiceYearsRequired(payload.severanceFormula.minimumServiceYearsRequired ?? 1);
    setMaxSeveranceWeeks(payload.severanceFormula.maxSeveranceWeeks ?? null);
    setMaxSeveranceMonetaryCap(payload.severanceFormula.maxSeveranceMonetaryCap ?? null);
    setTenureTable(payload.severanceFormula.tenureTable || []);
    setPayUnitPerYear(payload.severanceFormula.payUnitPerYear || 'weeks');
    setPayUnitsPerYearNumber(payload.severanceFormula.payUnitsPerYearNumber || 2);
    setProratePartialYears(payload.severanceFormula.proratePartialYears ?? true);

    setFinalSettlementPaymentTimelineDays(payload.finalSettlementPaymentTimelineDays);
    setMandatoryLeaveEncashment(payload.mandatoryLeaveEncashment);
    setLeaveEncashmentLoadingPercentage(payload.leaveEncashmentLoadingPercentage ?? null);
    setFinalSettlementComponents(payload.finalSettlementComponents);

    setWrittenContractMandatory(payload.contractRequirements.writtenContractMandatory);
    setMinAgeOfEmployment(payload.contractRequirements.minAgeOfEmployment);
    setAllowedEmploymentTypes(payload.contractRequirements.allowedEmploymentTypes);
    setCasualLoadingPercentage(payload.contractRequirements.casualLoadingPercentage ?? null);
    setMaxFixedTermMonths(payload.contractRequirements.maxFixedTermMonths ?? null);
    setMaxFixedTermRenewals(payload.contractRequirements.maxFixedTermRenewals ?? null);
    setMinimumWageHourly(payload.contractRequirements.minimumWageHourly);
    setMinimumWageMonthly(payload.contractRequirements.minimumWageMonthly ?? null);
    setItemizedPayslipMandatory(payload.contractRequirements.itemizedPayslipMandatory);
    setMandatoryTerms(payload.contractRequirements.mandatoryTerms);

    setNotes(payload.notes || '');
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    const v = versions.find((item) => item.id === versionId);
    if (v) populateFromVersion(v);
  };

  // Build current payload
  const buildCurrentPayload = (): EmploymentTerminationRulePayload => {
    return {
      standardProbationMonths,
      maxProbationMonths,
      probationNoticeDays,
      probationExtensionAllowed,
      maxProbationExtensionMonths,

      standardNoticeWeeks,
      employeeNoticeWeeks,
      noticeTiers,
      seniorAgeBonusEnabled,
      seniorAgeThreshold,
      seniorAgeAdditionalWeeks,
      paymentInLieuOfNoticeAllowed,

      severancePayEligible,
      severanceFormula: {
        type: severanceFormulaType,
        minimumServiceYearsRequired,
        maxSeveranceWeeks,
        maxSeveranceMonetaryCap,
        tenureTable: severanceFormulaType === 'statutory_table' ? tenureTable : undefined,
        payUnitPerYear: severanceFormulaType === 'multiplier_per_year' ? payUnitPerYear : undefined,
        payUnitsPerYearNumber: severanceFormulaType === 'multiplier_per_year' ? payUnitsPerYearNumber : undefined,
        proratePartialYears,
      },

      finalSettlementPaymentTimelineDays,
      mandatoryLeaveEncashment,
      leaveEncashmentLoadingPercentage,
      finalSettlementComponents,

      contractRequirements: {
        writtenContractMandatory,
        minAgeOfEmployment,
        allowedEmploymentTypes,
        casualLoadingPercentage,
        maxFixedTermMonths,
        maxFixedTermRenewals,
        minimumWageHourly,
        minimumWageMonthly,
        itemizedPayslipMandatory,
        mandatoryTerms,
      },

      notes: notes.trim() || undefined,
    };
  };

  // Real-time validation
  const validation = useMemo(() => {
    const p = buildCurrentPayload();
    return validateEmploymentTerminationPayload(p);
  }, [
    standardProbationMonths,
    maxProbationMonths,
    probationNoticeDays,
    standardNoticeWeeks,
    employeeNoticeWeeks,
    noticeTiers,
    seniorAgeBonusEnabled,
    severancePayEligible,
    severanceFormulaType,
    tenureTable,
    payUnitsPerYearNumber,
    finalSettlementPaymentTimelineDays,
    finalSettlementComponents,
    minimumWageHourly,
    minAgeOfEmployment,
  ]);

  // Live Simulation Result (Notice + Severance + Accrued Leave Payout)
  const simResult = useMemo(() => {
    const payload = buildCurrentPayload();
    const tenureMonths = Math.round(simServiceYears * 12);

    // 1. Notice Calculation
    let calculatedNoticeWeeks = standardNoticeWeeks;
    let seniorBonusActive = false;
    let noticeDesc = 'Standard statutory notice';

    if (simSeparationReason === 'probation_exit') {
      calculatedNoticeWeeks = Math.max(0.5, probationNoticeDays / 7);
      noticeDesc = `Probation exit notice (${probationNoticeDays} days)`;
    } else if (simSeparationReason === 'resignation') {
      calculatedNoticeWeeks = employeeNoticeWeeks;
      noticeDesc = `Employee resignation notice (${employeeNoticeWeeks} weeks)`;
    } else {
      const noticeCalc = calculateNoticePeriod(tenureMonths, noticeTiers, {
        employeeAge: simEmployeeAge,
        seniorAgeBonusEnabled,
        seniorAgeThreshold,
        seniorAgeAdditionalWeeks,
        fallbackStandardNoticeWeeks: standardNoticeWeeks,
      });
      calculatedNoticeWeeks = noticeCalc.noticeWeeks;
      seniorBonusActive = noticeCalc.seniorBonusApplied;
      noticeDesc = noticeCalc.matchedTierDescription;
    }

    const noticePayAmount = calculatedNoticeWeeks * simWeeklyWage;

    // 2. Severance Calculation
    let severanceCalc: SeveranceCalculationResult = {
      eligible: false,
      severanceWeeks: 0,
      severancePayAmount: 0,
      formulaDescription: 'Not applicable for this separation reason.',
      isCapped: false,
    };

    if (simSeparationReason === 'redundancy' && severancePayEligible) {
      severanceCalc = evaluateStructuredSeveranceFormula(payload.severanceFormula, {
        serviceYears: simServiceYears,
        weeklyOrdinaryRate: simWeeklyWage,
        employeeAge: simEmployeeAge,
      });
    }

    // 3. Leave Encashment
    const hourlyRate = simWeeklyWage / 38; // standard 38h base
    const baseLeavePayout = simUnusedLeaveHours * hourlyRate;
    const leaveLoadingRate = (mandatoryLeaveEncashment && leaveEncashmentLoadingPercentage) ? (leaveEncashmentLoadingPercentage / 100) : 0;
    const leaveLoadingAmount = baseLeavePayout * leaveLoadingRate;
    const totalLeavePayout = baseLeavePayout + leaveLoadingAmount;

    // Total Settlement
    const totalSettlement = noticePayAmount + severanceCalc.severancePayAmount + totalLeavePayout;

    return {
      calculatedNoticeWeeks,
      noticePayAmount,
      seniorBonusActive,
      noticeDesc,
      severanceCalc,
      hourlyRate,
      baseLeavePayout,
      leaveLoadingAmount,
      totalLeavePayout,
      totalSettlement,
    };
  }, [
    simServiceYears,
    simEmployeeAge,
    simWeeklyWage,
    simUnusedLeaveHours,
    simSeparationReason,
    standardNoticeWeeks,
    employeeNoticeWeeks,
    probationNoticeDays,
    noticeTiers,
    seniorAgeBonusEnabled,
    seniorAgeThreshold,
    seniorAgeAdditionalWeeks,
    severancePayEligible,
    severanceFormulaType,
    tenureTable,
    payUnitsPerYearNumber,
    mandatoryLeaveEncashment,
    leaveEncashmentLoadingPercentage,
  ]);

  const handleLoadPreset = (presetIso: string) => {
    const preset = getDefaultEmploymentTerminationForCountry(presetIso);
    setStandardProbationMonths(preset.standardProbationMonths);
    setMaxProbationMonths(preset.maxProbationMonths);
    setProbationNoticeDays(preset.probationNoticeDays);
    setProbationExtensionAllowed(preset.probationExtensionAllowed);
    setMaxProbationExtensionMonths(preset.maxProbationExtensionMonths ?? null);

    setStandardNoticeWeeks(preset.standardNoticeWeeks);
    setEmployeeNoticeWeeks(preset.employeeNoticeWeeks);
    setNoticeTiers(preset.noticeTiers);
    setSeniorAgeBonusEnabled(preset.seniorAgeBonusEnabled);
    setSeniorAgeThreshold(preset.seniorAgeThreshold ?? 45);
    setSeniorAgeAdditionalWeeks(preset.seniorAgeAdditionalWeeks ?? 1);
    setPaymentInLieuOfNoticeAllowed(preset.paymentInLieuOfNoticeAllowed);

    setSeverancePayEligible(preset.severancePayEligible);
    setSeveranceFormulaType(preset.severanceFormula.type);
    setMinimumServiceYearsRequired(preset.severanceFormula.minimumServiceYearsRequired ?? 1);
    setMaxSeveranceWeeks(preset.severanceFormula.maxSeveranceWeeks ?? 16);
    setMaxSeveranceMonetaryCap(preset.severanceFormula.maxSeveranceMonetaryCap ?? null);
    setTenureTable(preset.severanceFormula.tenureTable || []);
    setPayUnitPerYear(preset.severanceFormula.payUnitPerYear || 'weeks');
    setPayUnitsPerYearNumber(preset.severanceFormula.payUnitsPerYearNumber || 2);
    setProratePartialYears(preset.severanceFormula.proratePartialYears ?? true);

    setFinalSettlementPaymentTimelineDays(preset.finalSettlementPaymentTimelineDays);
    setMandatoryLeaveEncashment(preset.mandatoryLeaveEncashment);
    setLeaveEncashmentLoadingPercentage(preset.leaveEncashmentLoadingPercentage ?? null);
    setFinalSettlementComponents(preset.finalSettlementComponents);

    setWrittenContractMandatory(preset.contractRequirements.writtenContractMandatory);
    setMinAgeOfEmployment(preset.contractRequirements.minAgeOfEmployment);
    setAllowedEmploymentTypes(preset.contractRequirements.allowedEmploymentTypes);
    setCasualLoadingPercentage(preset.contractRequirements.casualLoadingPercentage ?? null);
    setMaxFixedTermMonths(preset.contractRequirements.maxFixedTermMonths ?? null);
    setMaxFixedTermRenewals(preset.contractRequirements.maxFixedTermRenewals ?? null);
    setMinimumWageHourly(preset.contractRequirements.minimumWageHourly);
    setMinimumWageMonthly(preset.contractRequirements.minimumWageMonthly ?? null);
    setItemizedPayslipMandatory(preset.contractRequirements.itemizedPayslipMandatory);
    setMandatoryTerms(preset.contractRequirements.mandatoryTerms);

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
        setSuccessMessage('Updated sunset / effectiveTo date for published employment rules version.');
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
      setError(`Cannot save draft employment rules: ${validation.summaryError}`);
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

      setSuccessMessage('Successfully saved draft employment & termination rules.');
      await loadVersions(currentVersion.id);
      await onRefresh();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to save draft employment & termination rules.');
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
      setError(err?.message || 'Failed to publish employment & termination rule version.');
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
        ruleType: 'employment_rules',
        stateProvinceId: selectedStateId || undefined,
        effectiveFrom: newVersionEffectiveFrom,
        effectiveTo: newVersionEffectiveTo || undefined,
        sourceReference: newVersionSourceReference.trim() || `${country.name} Statutory Employment Regulations`,
        changeNote: newVersionChangeNote.trim() || 'New statutory employment & termination schedule revision',
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

  // Notice Tiers Handlers
  const handleAddNoticeTier = () => {
    const lastTier = noticeTiers[noticeTiers.length - 1];
    const newMin = lastTier ? (lastTier.maxTenureMonths ?? (lastTier.minTenureMonths + 24)) : 0;
    setNoticeTiers([
      ...noticeTiers,
      {
        minTenureMonths: newMin,
        maxTenureMonths: null,
        noticeWeeks: (lastTier ? lastTier.noticeWeeks + 1 : 4),
        description: `Tenure exceeding ${Math.round(newMin / 12)} years`,
      },
    ]);
  };

  const handleRemoveNoticeTier = (idx: number) => {
    setNoticeTiers(noticeTiers.filter((_, i) => i !== idx));
  };

  // Severance Table Handlers
  const handleAddTenureTier = () => {
    const last = tenureTable[tenureTable.length - 1];
    const newMin = last ? (last.maxYears ?? (last.minYears + 1)) : 1;
    setTenureTable([
      ...tenureTable,
      {
        minYears: newMin,
        maxYears: null,
        severanceWeeks: (last ? last.severanceWeeks + 2 : 4),
      },
    ]);
  };

  const handleRemoveTenureTier = (idx: number) => {
    setTenureTable(tenureTable.filter((_, i) => i !== idx));
  };

  // Final settlement component handlers
  const handleAddSettlementComponent = () => {
    setFinalSettlementComponents([
      ...finalSettlementComponents,
      {
        code: `CUSTOM_COMP_${finalSettlementComponents.length + 1}`,
        name: 'New Settlement Allowance',
        kind: 'earning',
        isMandatory: false,
        taxability: 'fully_taxable',
        settlementTimelineDays: 14,
        calculationBasis: 'daily_rate',
        description: 'Custom statutory or company termination component.',
      },
    ]);
  };

  const handleRemoveSettlementComponent = (idx: number) => {
    setFinalSettlementComponents(finalSettlementComponents.filter((_, i) => i !== idx));
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
                    Employment & Termination Rules Editor
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Stage C.09 & C.10 • Fair Work & Redundancy
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
                  Statutory probation ceilings, tenure-based notice periods, final settlement components, structured JSON severance formulas, and contract compliance.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 px-1 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Presets:
            </span>
            <button
              type="button"
              onClick={() => handleLoadPreset('AUS')}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium transition"
              title="Fair Work Act 2009: 6m probation, 4-wk notice by tenure + 45+ senior bonus, NES §119 redundancy table, 25% casual loading."
            >
              🇦🇺 AUS (Fair Work)
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('BGD')}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium transition"
              title="Bangladesh Labor Act 2006: 120-day notice permanent, 30 days severance per year, 30 days final settlement."
            >
              🇧🇩 BGD (Labor Act)
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('USA')}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium transition"
              title="US FLSA & At-Will: 2-wk customary notice, $7.25 min wage, 3-day final pay timeline."
            >
              🇺🇸 USA (FLSA)
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
              onClick={() => setActiveSection('probation')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                activeSection === 'probation'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" /> Probation & Contracts
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('notice')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                activeSection === 'notice'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Notice Tiers
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('severance')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                activeSection === 'severance'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5" /> Severance Formulas
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('settlement')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                activeSection === 'settlement'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Coins className="w-3.5 h-3.5" /> Final Settlement
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('simulator')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                activeSection === 'simulator'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" /> Settlement Simulator
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
          setNewVersionSourceReference(sourceReference || `${country.name} Statutory Employment Regulations`);
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
              <strong>Version {currentVersion.version} is PUBLISHED & LOCKED.</strong> Employment & termination rule parameters are immutable. To revise statutory rules, click <strong>New Version</strong>. You may edit the <em>effectiveTo</em> sunset date below.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewVersionEffectiveFrom(`${new Date().getFullYear() + 1}-01-01`);
              setNewVersionEffectiveTo('');
              setNewVersionSourceReference(sourceReference || `${country.name} Statutory Employment Regulations`);
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
              placeholder="e.g. Fair Work Act 2009 (NES §117 & §119)"
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
      {/* SECTION A: PROBATION LIMITS & STATUTORY CONTRACTS (Stage C.09) */}
      {(activeSection === 'probation' || activeSection === 'simulator') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Probation Limits */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-800">
                  Statutory Probation Ceilings & Notice
                </h4>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                Stage C.09
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Standard Probation <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      disabled={isPublished}
                      value={standardProbationMonths}
                      onChange={(e) => setStandardProbationMonths(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 pr-14 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-semibold text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">months</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Statutory default probation duration.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Maximum Statutory Cap <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min={standardProbationMonths}
                      max="24"
                      disabled={isPublished}
                      value={maxProbationMonths}
                      onChange={(e) => setMaxProbationMonths(parseFloat(e.target.value) || standardProbationMonths)}
                      className="w-full px-2.5 py-1.5 pr-14 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-semibold text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">months</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ceiling: tenants cannot exceed this legally.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Probation Notice Period
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      disabled={isPublished}
                      value={probationNoticeDays}
                      onChange={(e) => setProbationNoticeDays(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2.5 py-1.5 pr-12 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">days</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Notice required to terminate during probation.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Extension Allowed
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="12"
                      disabled={isPublished || !probationExtensionAllowed}
                      value={maxProbationExtensionMonths ?? ''}
                      onChange={(e) => setMaxProbationExtensionMonths(e.target.value ? parseInt(e.target.value, 10) : null)}
                      placeholder="e.g. 3"
                      className="w-full px-2.5 py-1.5 pr-14 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">months</span>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  disabled={isPublished}
                  checked={probationExtensionAllowed}
                  onChange={(e) => setProbationExtensionAllowed(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-slate-700">Allow Employers to Extend Probation Once</span>
              </label>
            </div>
          </div>

          {/* Card 2: Statutory Contract Requirements */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-800">
                  Statutory Contract & Minimum Wage Baselines
                </h4>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                Legal Standards
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Statutory Min Wage (Hourly) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      disabled={isPublished}
                      value={minimumWageHourly}
                      onChange={(e) => setMinimumWageHourly(parseFloat(e.target.value) || 0)}
                      className="w-full pl-6 pr-12 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 font-bold text-emerald-700"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">/hr</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">e.g. AUD $24.10 statutory national baseline.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Minimum Employment Age <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="12"
                      max="21"
                      disabled={isPublished}
                      value={minAgeOfEmployment}
                      onChange={(e) => setMinAgeOfEmployment(parseInt(e.target.value, 10) || 15)}
                      className="w-full px-2.5 py-1.5 pr-12 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">yrs</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Child labor statutory age threshold.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Casual Loading Percentage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      disabled={isPublished}
                      value={casualLoadingPercentage ?? ''}
                      onChange={(e) => setCasualLoadingPercentage(e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="e.g. 25.0"
                      className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800 font-semibold"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">e.g. 25% compensation in lieu of paid leave.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Fixed-Term Contract
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      disabled={isPublished}
                      value={maxFixedTermMonths ?? ''}
                      onChange={(e) => setMaxFixedTermMonths(e.target.value ? parseInt(e.target.value, 10) : null)}
                      placeholder="e.g. 24"
                      className="w-full px-2.5 py-1.5 pr-14 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 text-slate-800"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">months</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Closing Loopholes 2-year statutory limit.</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isPublished}
                    checked={writtenContractMandatory}
                    onChange={(e) => setWrittenContractMandatory(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">Written Employment Contract Legally Mandatory</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isPublished}
                    checked={itemizedPayslipMandatory}
                    onChange={(e) => setItemizedPayslipMandatory(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">Itemized Electronic Payslip Delivery Mandatory</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B: MINIMUM NOTICE PERIODS BY TENURE (Stage C.10) */}
      {(activeSection === 'notice' || activeSection === 'simulator') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Minimum Statutory Notice Periods by Service Tenure
                </h4>
                <p className="text-xs text-slate-500">
                  Graduated notice schedule mapped to continuous service (Fair Work NES §117 / UK ERA 1996).
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isPublished}
              onClick={handleAddNoticeTier}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add Tenure Tier
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pb-3 border-b border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Employer Baseline Notice <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="52"
                  disabled={isPublished}
                  value={standardNoticeWeeks}
                  onChange={(e) => setStandardNoticeWeeks(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 pr-14 border border-slate-300 rounded-md font-bold text-slate-800"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">weeks</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Default notice when no tier matches.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Employee Resignation Notice <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="52"
                  disabled={isPublished}
                  value={employeeNoticeWeeks}
                  onChange={(e) => setEmployeeNoticeWeeks(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 pr-14 border border-slate-300 rounded-md font-bold text-slate-800"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">weeks</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Statutory notice required from resigning employee.</p>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isPublished}
                  checked={seniorAgeBonusEnabled}
                  onChange={(e) => setSeniorAgeBonusEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="font-semibold text-purple-900">Fair Work Senior Age Bonus</span>
              </label>
              <p className="text-[10px] text-purple-700">
                Adds +{seniorAgeAdditionalWeeks} week notice if employee is {seniorAgeThreshold}+ years old with 2+ years service.
              </p>
            </div>
          </div>

          {/* Notice Tiers Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="py-2.5 px-3 font-semibold">Min Tenure</th>
                  <th className="py-2.5 px-3 font-semibold">Max Tenure</th>
                  <th className="py-2.5 px-3 font-semibold">Statutory Notice (Weeks)</th>
                  <th className="py-2.5 px-3 font-semibold">Statutory Description</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {noticeTiers.map((tier, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          disabled={isPublished}
                          value={tier.minTenureMonths}
                          onChange={(e) => {
                            const updated = [...noticeTiers];
                            updated[idx].minTenureMonths = parseInt(e.target.value, 10) || 0;
                            setNoticeTiers(updated);
                          }}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-center"
                        />
                        <span className="text-slate-400">m ({Math.round(tier.minTenureMonths / 12)}y)</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          disabled={isPublished}
                          value={tier.maxTenureMonths ?? ''}
                          placeholder="∞ Open"
                          onChange={(e) => {
                            const updated = [...noticeTiers];
                            updated[idx].maxTenureMonths = e.target.value ? parseInt(e.target.value, 10) : null;
                            setNoticeTiers(updated);
                          }}
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-center placeholder:text-slate-400"
                        />
                        {tier.maxTenureMonths ? (
                          <span className="text-slate-400">m ({Math.round(tier.maxTenureMonths / 12)}y)</span>
                        ) : (
                          <span className="text-indigo-600 font-semibold text-[10px]">Indefinite</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          disabled={isPublished}
                          value={tier.noticeWeeks}
                          onChange={(e) => {
                            const updated = [...noticeTiers];
                            updated[idx].noticeWeeks = parseFloat(e.target.value) || 0;
                            setNoticeTiers(updated);
                          }}
                          className="w-16 px-2 py-1 border border-slate-300 rounded font-bold text-indigo-700 text-center"
                        />
                        <span className="font-semibold text-slate-700">weeks ({Math.round(tier.noticeWeeks * 7)} days)</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        disabled={isPublished}
                        value={tier.description || ''}
                        onChange={(e) => {
                          const updated = [...noticeTiers];
                          updated[idx].description = e.target.value;
                          setNoticeTiers(updated);
                        }}
                        placeholder="e.g. Up to 1 year of continuous service"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-slate-700"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        disabled={isPublished || noticeTiers.length <= 1}
                        onClick={() => handleRemoveNoticeTier(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 transition disabled:opacity-30"
                        title="Delete Tier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION C: SEVERANCE & REDUNDANCY FORMULAS (Stage C.10 & PAYROLL_LOGIC.md §5) */}
      {(activeSection === 'severance' || activeSection === 'simulator') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Statutory Severance & Redundancy Formulas
                </h4>
                <p className="text-xs text-slate-500">
                  Structured JSON formulas per PAYROLL_LOGIC.md §5 (sandboxed pure AST & tables, never eval).
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-medium">
              NES §119 / Structured AST
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Severance Eligibility</label>
              <select
                disabled={isPublished}
                value={severancePayEligible ? 'yes' : 'no'}
                onChange={(e) => setSeverancePayEligible(e.target.value === 'yes')}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-800"
              >
                <option value="yes">Mandatory Statutory Severance</option>
                <option value="no">Discretionary / No Statutory Redundancy</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Formula Architecture</label>
              <select
                disabled={isPublished || !severancePayEligible}
                value={severanceFormulaType}
                onChange={(e) => setSeveranceFormulaType(e.target.value as SeveranceFormulaType)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-semibold text-indigo-900 bg-indigo-50"
              >
                <option value="statutory_table">Statutory Tenure Tier Table (Fair Work NES §119)</option>
                <option value="multiplier_per_year">Multiplier per Year (X weeks/days per year)</option>
                <option value="gratuity_statutory">Statutory Gratuity Scheme</option>
                <option value="structured_ast">Sandboxed Declarative AST Tree</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min Service to Qualify</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  disabled={isPublished || !severancePayEligible}
                  value={minimumServiceYearsRequired}
                  onChange={(e) => setMinimumServiceYearsRequired(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 pr-12 border border-slate-300 rounded-md"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400">years</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">e.g. 1 year continuous service.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Statutory Ceiling (Weeks)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="104"
                  disabled={isPublished || !severancePayEligible}
                  value={maxSeveranceWeeks ?? ''}
                  onChange={(e) => setMaxSeveranceWeeks(e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="e.g. 16"
                  className="w-full px-2.5 py-1.5 pr-14 border border-slate-300 rounded-md font-bold text-slate-800"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400">weeks</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Maximum statutory redundancy cap.</p>
            </div>
          </div>

          {/* Conditional Table Editor: Statutory Tenure Table */}
          {severanceFormulaType === 'statutory_table' && severancePayEligible && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-600" /> NES §119 Graduated Redundancy Pay Schedule
                </span>
                <button
                  type="button"
                  disabled={isPublished}
                  onClick={handleAddTenureTier}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Tier
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="py-2 px-3 font-semibold">Min Service (Years)</th>
                      <th className="py-2 px-3 font-semibold">Max Service (Years)</th>
                      <th className="py-2 px-3 font-semibold">Redundancy Pay (Weeks)</th>
                      <th className="py-2 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tenureTable.map((tier, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            min="0"
                            disabled={isPublished}
                            value={tier.minYears}
                            onChange={(e) => {
                              const updated = [...tenureTable];
                              updated[idx].minYears = parseFloat(e.target.value) || 0;
                              setTenureTable(updated);
                            }}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            min="1"
                            disabled={isPublished}
                            value={tier.maxYears ?? ''}
                            placeholder="∞ Open"
                            onChange={(e) => {
                              const updated = [...tenureTable];
                              updated[idx].maxYears = e.target.value ? parseFloat(e.target.value) : null;
                              setTenureTable(updated);
                            }}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-center placeholder:text-slate-400"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            disabled={isPublished}
                            value={tier.severanceWeeks}
                            onChange={(e) => {
                              const updated = [...tenureTable];
                              updated[idx].severanceWeeks = parseFloat(e.target.value) || 0;
                              setTenureTable(updated);
                            }}
                            className="w-20 px-2 py-1 border border-slate-300 rounded font-bold text-indigo-700 text-center"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <button
                            type="button"
                            disabled={isPublished}
                            onClick={() => handleRemoveTenureTier(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Conditional Multiplier per year */}
          {severanceFormulaType === 'multiplier_per_year' && severancePayEligible && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pay Units per Year</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  disabled={isPublished}
                  value={payUnitsPerYearNumber}
                  onChange={(e) => setPayUnitsPerYearNumber(parseFloat(e.target.value) || 2)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold text-indigo-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pay Unit</label>
                <select
                  disabled={isPublished}
                  value={payUnitPerYear}
                  onChange={(e) => setPayUnitPerYear(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                >
                  <option value="weeks">Weeks of Ordinary Pay</option>
                  <option value="days">Days of Basic Wage</option>
                  <option value="months">Months of Pay</option>
                </select>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isPublished}
                    checked={proratePartialYears}
                    onChange={(e) => setProratePartialYears(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-700">Prorate for Partial Years of Service</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION D: FINAL SETTLEMENT COMPONENTS */}
      {(activeSection === 'settlement' || activeSection === 'simulator') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Final Settlement Payout Components & Payment Timeline
                </h4>
                <p className="text-xs text-slate-500">
                  Mandatory termination payslip inclusions, unused leave payout, and ETP tax classification.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isPublished}
              onClick={handleAddSettlementComponent}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add Component
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pb-3 border-b border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Final Pay Due Deadline <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="90"
                  disabled={isPublished}
                  value={finalSettlementPaymentTimelineDays}
                  onChange={(e) => setFinalSettlementPaymentTimelineDays(parseInt(e.target.value, 10) || 7)}
                  className="w-full px-2.5 py-1.5 pr-12 border border-slate-300 rounded-md font-bold text-slate-800"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400 font-medium">days</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Maximum days from termination to final payout.</p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isPublished}
                  checked={mandatoryLeaveEncashment}
                  onChange={(e) => setMandatoryLeaveEncashment(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-emerald-950">Mandatory Unused Leave Payout</span>
              </label>
              <p className="text-[10px] text-emerald-800">
                All accrued untaken statutory annual leave must be paid upon separation.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Annual Leave Loading on Termination</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  disabled={isPublished}
                  value={leaveEncashmentLoadingPercentage ?? ''}
                  onChange={(e) => setLeaveEncashmentLoadingPercentage(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 17.5"
                  className="w-full px-2.5 py-1.5 pr-8 border border-slate-300 rounded-md font-bold text-emerald-700"
                />
                <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">e.g. 17.5% leave loading per Modern Awards.</p>
            </div>
          </div>

          {/* Settlement Components List */}
          <div className="space-y-2">
            {finalSettlementComponents.map((comp, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      comp.kind === 'earning'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {comp.kind}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900">{comp.name}</strong>
                      <code className="text-[10px] bg-white px-1.5 py-0.5 border border-slate-200 rounded font-mono text-slate-600">
                        {comp.code}
                      </code>
                      {comp.isMandatory && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                          Statutory Mandatory
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{comp.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-medium text-[11px]">
                    Tax: <strong>{comp.taxability.toUpperCase()}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-medium text-[11px]">
                    Basis: <strong>{comp.calculationBasis}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={isPublished}
                    onClick={() => handleRemoveSettlementComponent(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION E: LIVE SEPARATION & SETTLEMENT SIMULATOR */}
      {activeSection === 'simulator' && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 rounded-xl p-5 text-white shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-900/60 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              <div>
                <h4 className="text-sm font-bold text-white">
                  Live Separation & Final Settlement Calculator
                </h4>
                <p className="text-xs text-indigo-200">
                  Simulate complete statutory terminal dues (Notice, Severance, Unused Leave Payout) in real-time.
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded bg-indigo-800/80 text-indigo-200 font-mono font-medium">
              Pure AST Engine • Zero eval()
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block font-medium text-indigo-200 mb-1">Service Duration</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={simServiceYears}
                  onChange={(e) => setSimServiceYears(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-indigo-700/60 rounded text-white font-bold text-sm"
                />
                <span className="absolute right-3 top-2 text-indigo-300">years</span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-indigo-200 mb-1">Employee Age</label>
              <div className="relative">
                <input
                  type="number"
                  min="15"
                  max="90"
                  value={simEmployeeAge}
                  onChange={(e) => setSimEmployeeAge(parseInt(e.target.value, 10) || 45)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-indigo-700/60 rounded text-white font-bold text-sm"
                />
                <span className="absolute right-3 top-2 text-indigo-300">yrs</span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-indigo-200 mb-1">Weekly Ordinary Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-indigo-300">$</span>
                <input
                  type="number"
                  step="50"
                  min="100"
                  value={simWeeklyWage}
                  onChange={(e) => setSimWeeklyWage(parseFloat(e.target.value) || 1000)}
                  className="w-full pl-6 pr-3 py-1.5 bg-slate-800 border border-indigo-700/60 rounded text-white font-bold text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-indigo-200 mb-1">Accrued Leave</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={simUnusedLeaveHours}
                  onChange={(e) => setSimUnusedLeaveHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-indigo-700/60 rounded text-white font-bold text-sm"
                />
                <span className="absolute right-3 top-2 text-indigo-300">hrs</span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-indigo-200 mb-1">Separation Reason</label>
              <select
                value={simSeparationReason}
                onChange={(e) => setSimSeparationReason(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-indigo-700/60 rounded text-white font-semibold text-sm"
              >
                <option value="redundancy">Redundancy / Retrenchment</option>
                <option value="employer_dismissal">Employer Termination</option>
                <option value="resignation">Employee Resignation</option>
                <option value="probation_exit">Probation Exit</option>
              </select>
            </div>
          </div>

          {/* Simulation Output Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Statutory Notice</span>
              <span className="text-lg font-bold text-white">
                {simResult.calculatedNoticeWeeks.toFixed(1)} wks
              </span>
              <span className="text-[10px] text-amber-300 block font-mono">
                ${simResult.noticePayAmount.toFixed(2)} PILON
              </span>
              <p className="text-[9px] text-slate-400 mt-1">{simResult.noticeDesc}</p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Severance / Redundancy</span>
              <span className="text-lg font-bold text-indigo-300">
                {simResult.severanceCalc.severanceWeeks.toFixed(1)} wks
              </span>
              <span className="text-[10px] text-emerald-400 block font-mono">
                ${simResult.severanceCalc.severancePayAmount.toFixed(2)}
              </span>
              <p className="text-[9px] text-slate-400 mt-1">{simResult.severanceCalc.formulaDescription}</p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Annual Leave Encashment</span>
              <span className="text-lg font-bold text-white">
                ${simResult.totalLeavePayout.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-300 block">
                {simUnusedLeaveHours}h @ ${(simWeeklyWage / 38).toFixed(2)}/hr
                {leaveEncashmentLoadingPercentage ? ` (+${leaveEncashmentLoadingPercentage}% loading)` : ''}
              </span>
            </div>

            <div className="p-3 bg-indigo-900/60 rounded-lg border border-indigo-700">
              <span className="text-indigo-300 block text-[10px] uppercase font-semibold">Total Final Settlement</span>
              <span className="text-xl font-extrabold text-emerald-400">
                ${simResult.totalSettlement.toFixed(2)}
              </span>
              <span className="text-[10px] text-indigo-200 block">
                Gross terminal settlement payout
              </span>
            </div>
          </div>
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
              All employment & termination rules valid and compliant with Stage C.09 and C.10.
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
        title={`Create New Employment & Termination Version (v${versions.length + 1})`}
      >
        <form onSubmit={handleCreateNewVersion} className="space-y-4 text-xs">
          <p className="text-slate-500">
            A new version will be created as a <strong>DRAFT</strong> cloned from your current settings. Published versions remain locked for historical compliance reproducibility.
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
              placeholder="e.g. Fair Work Amendment 2026 Schedule"
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
              placeholder="e.g. Annual statutory redundancy and notice tier revisions"
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
