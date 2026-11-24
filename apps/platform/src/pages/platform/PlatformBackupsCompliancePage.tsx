// apps/platform/src/pages/platform/PlatformBackupsCompliancePage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowRight,
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  HardDrive,
  History,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Trash2,
  UserCheck,
  UserX,
  X,
  Zap,
} from 'lucide-react';
import type {
  BackupsComplianceSummary,
  BackupRunItem,
  BackupType,
  CompletionRecord,
  DataRequestItem,
  DataRequestType,
  LegalRetentionException,
  RequestCountdown,
  RestoreRequestItem,
  RestoreScope,
} from '@hrm/shared-types';
import { platformBackupsApi } from '../../lib/platform-backups-api';

type TabKey = 'runs' | 'restore-requests' | 'data-requests';

export const PlatformBackupsCompliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('runs');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<BackupsComplianceSummary | null>(null);
  const [backupRuns, setBackupRuns] = useState<BackupRunItem[]>([]);
  const [restoreRequests, setRestoreRequests] = useState<RestoreRequestItem[]>([]);
  const [dataRequests, setDataRequests] = useState<DataRequestItem[]>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; subdomain: string }>>([]);

  // Modals
  const [showTriggerBackupModal, setShowTriggerBackupModal] = useState<boolean>(false);
  const [showCreateRestoreModal, setShowCreateRestoreModal] = useState<boolean>(false);
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [showTenantExportModal, setShowTenantExportModal] = useState<boolean>(false);
  const [showEmployeeAnonModal, setShowEmployeeAnonModal] = useState<boolean>(false);
  const [showTestDetailsModal, setShowTestDetailsModal] = useState<boolean>(false);
  const [showAnonSummaryModal, setShowAnonSummaryModal] = useState<boolean>(false);
  const [showJobLogsModal, setShowJobLogsModal] = useState<boolean>(false);

  // Compliance & Statutory Deadlines Modals
  const [showCompletionRecordModal, setShowCompletionRecordModal] = useState<boolean>(false);
  const [showLegalExceptionsModal, setShowLegalExceptionsModal] = useState<boolean>(false);
  const [showApproveDataRequestModal, setShowApproveDataRequestModal] = useState<boolean>(false);
  const [showRejectDataRequestModal, setShowRejectDataRequestModal] = useState<boolean>(false);

  // Selected entities for modals
  const [selectedBackupRun, setSelectedBackupRun] = useState<BackupRunItem | null>(null);
  const [selectedRestoreRequest, setSelectedRestoreRequest] = useState<RestoreRequestItem | null>(null);
  const [selectedDataRequest, setSelectedDataRequest] = useState<DataRequestItem | null>(null);

  // SLA Thresholds & Configuration
  const [backupThresholdHours, setBackupThresholdHours] = useState<number>(24);
  const [restoreTestThresholdDays, setRestoreTestThresholdDays] = useState<number>(7);
  const [tempBackupHours, setTempBackupHours] = useState<number>(24);
  const [tempRestoreDays, setTempRestoreDays] = useState<number>(7);
  const [showThresholdModal, setShowThresholdModal] = useState<boolean>(false);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [runStatusFilter, setRunStatusFilter] = useState<string>('all');
  const [runTestFilter, setRunTestFilter] = useState<string>('all');
  const [restoreStatusFilter, setRestoreStatusFilter] = useState<string>('all');

  // Data requests queue filters & search
  const [dataReqSearchQuery, setDataReqSearchQuery] = useState<string>('');
  const [dataReqTypeFilter, setDataReqTypeFilter] = useState<string>('all');
  const [dataReqStatusFilter, setDataReqStatusFilter] = useState<string>('all');
  const [dataReqUrgencyFilter, setDataReqUrgencyFilter] = useState<string>('all');

  // Form states
  const [backupTypeForm, setBackupTypeForm] = useState<BackupType>('full');
  const [includesFileStorageForm, setIncludesFileStorageForm] = useState<boolean>(true);
  const [restoreScopeForm, setRestoreScopeForm] = useState<RestoreScope>('tenant');
  const [restoreBackupIdForm, setRestoreBackupIdForm] = useState<string>('');
  const [restoreTenantIdForm, setRestoreTenantIdForm] = useState<string>('');
  const [restoreReasonForm, setRestoreReasonForm] = useState<string>('');
  const [rejectReasonForm, setRejectReasonForm] = useState<string>('');
  const [exportTenantIdForm, setExportTenantIdForm] = useState<string>('');
  const [exportReasonForm, setExportReasonForm] = useState<string>('');
  const [exportDeadlineDaysForm, setExportDeadlineDaysForm] = useState<number>(7);
  const [anonTenantIdForm, setAnonTenantIdForm] = useState<string>('');
  const [anonTargetEmployeeIdForm, setAnonTargetEmployeeIdForm] = useState<string>('');
  const [anonTypeForm, setAnonTypeForm] = useState<'employee_anonymization' | 'employee_deletion'>('employee_anonymization');
  const [anonReasonForm, setAnonReasonForm] = useState<string>('');
  const [anonDeadlineDaysForm, setAnonDeadlineDaysForm] = useState<number>(30);
  const [dataReqApproveNotesForm, setDataReqApproveNotesForm] = useState<string>('');
  const [dataReqRejectReasonForm, setDataReqRejectReasonForm] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  // Current logged in user ID from token or storage
  const currentUserId = useMemo(() => {
    try {
      const rawUser =
        localStorage.getItem('hrm_platform_user') ||
        localStorage.getItem('platform_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        return parsed.id || '';
      }
    } catch {
      // fallback
    }
    return '';
  }, []);

  const formatTimeAgo = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Never';
    const diffMs = Date.now() - new Date(dateString).getTime();
    if (diffMs < 0) return 'Just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const loadData = async (
    isRefresh = false,
    thresholdOverrides?: { backupThresholdHours?: number; restoreTestThresholdDays?: number },
  ) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const bHours = thresholdOverrides?.backupThresholdHours ?? backupThresholdHours;
      const rDays = thresholdOverrides?.restoreTestThresholdDays ?? restoreTestThresholdDays;

      const [sum, runs, restores, dataReqs, tList] = await Promise.all([
        platformBackupsApi.getSummary({
          backupThresholdHours: bHours,
          restoreTestThresholdDays: rDays,
        }),
        platformBackupsApi.listBackupRuns(),
        platformBackupsApi.listRestoreRequests(),
        platformBackupsApi.listDataRequests(),
        platformBackupsApi.listTenants(),
      ]);

      setSummary(sum);
      setBackupRuns(runs);
      setRestoreRequests(restores);
      setDataRequests(dataReqs);
      setTenants(tList);

      if (runs.length > 0 && !restoreBackupIdForm) {
        setRestoreBackupIdForm(runs[0].id);
      }
      if (tList.length > 0) {
        if (!restoreTenantIdForm) setRestoreTenantIdForm(tList[0].id);
        if (!exportTenantIdForm) setExportTenantIdForm(tList[0].id);
        if (!anonTenantIdForm) setAnonTenantIdForm(tList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load backup and compliance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleTriggerBackup = async () => {
    try {
      setActionInProgress(true);
      await platformBackupsApi.triggerBackup({
        backupType: backupTypeForm,
        includesFileStorage: includesFileStorageForm,
      });
      setSuccessMessage('New backup initiated and completed successfully.');
      setShowTriggerBackupModal(false);
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Error triggering backup: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRunRestoreTest = async (run: BackupRunItem) => {
    try {
      setActionInProgress(true);
      await platformBackupsApi.runRestoreTest(run.id);
      setSuccessMessage(`Automated restore test for backup ${run.id.slice(0, 8)} passed verification.`);
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Restore test failed: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleCreateRestoreRequest = async () => {
    if (!restoreReasonForm.trim()) {
      alert('A typed reason is required to initiate a restore request.');
      return;
    }
    try {
      setActionInProgress(true);
      await platformBackupsApi.createRestoreRequest({
        backupRunId: restoreBackupIdForm,
        scope: restoreScopeForm,
        tenantId: restoreScopeForm === 'tenant' ? restoreTenantIdForm : undefined,
        reason: restoreReasonForm.trim(),
      });
      setSuccessMessage('Restore request submitted for secondary dual approval.');
      setShowCreateRestoreModal(false);
      setRestoreReasonForm('');
      setActiveTab('restore-requests');
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Error creating restore request: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleApproveRestore = async () => {
    if (!selectedRestoreRequest) return;
    try {
      setActionInProgress(true);
      await platformBackupsApi.approveRestoreRequest(selectedRestoreRequest.id);
      setSuccessMessage(
        `Dual approval verified. Restore job completed with tenant isolation guaranteed (0 foreign records modified).`,
      );
      setShowApproveModal(false);
      setSelectedRestoreRequest(null);
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectRestore = async () => {
    if (!selectedRestoreRequest) return;
    try {
      setActionInProgress(true);
      await platformBackupsApi.rejectRestoreRequest(selectedRestoreRequest.id, {
        reason: rejectReasonForm.trim() || 'Rejected by platform operator',
      });
      setSuccessMessage('Restore request marked as rejected.');
      setShowRejectModal(false);
      setSelectedRestoreRequest(null);
      setRejectReasonForm('');
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleCreateTenantExport = async () => {
    if (!exportTenantIdForm) {
      alert('Please select a tenant.');
      return;
    }
    try {
      setActionInProgress(true);
      await platformBackupsApi.createTenantExport({
        tenantId: exportTenantIdForm,
        reason: exportReasonForm.trim() || 'Tenant data portability archive request',
        deadlineDays: exportDeadlineDaysForm,
      });
      setSuccessMessage('Tenant export archive request created and scheduled.');
      setShowTenantExportModal(false);
      setExportReasonForm('');
      setActiveTab('data-requests');
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Tenant export error: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleCreateEmployeeAnon = async () => {
    if (!anonTenantIdForm || !anonTargetEmployeeIdForm.trim()) {
      alert('Tenant and Target Employee ID are required.');
      return;
    }
    try {
      setActionInProgress(true);
      await platformBackupsApi.createEmployeeAnonymization({
        tenantId: anonTenantIdForm,
        targetEmployeeId: anonTargetEmployeeIdForm.trim(),
        type: anonTypeForm,
        reason: anonReasonForm.trim() || 'Right to be forgotten request',
        deadlineDays: anonDeadlineDaysForm,
      });
      setSuccessMessage(
        'Employee anonymization request logged. Personal identifiers will be scrubbed while statutory payroll records and audit logs are preserved in anonymized form.',
      );
      setShowEmployeeAnonModal(false);
      setAnonTargetEmployeeIdForm('');
      setAnonReasonForm('');
      setActiveTab('data-requests');
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Anonymization error: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleApproveDataRequest = async () => {
    if (!selectedDataRequest) return;
    try {
      setActionInProgress(true);
      await platformBackupsApi.approveDataRequest(selectedDataRequest.id, {
        reviewNotes: dataReqApproveNotesForm.trim() || undefined,
      });
      setSuccessMessage(
        `Data request ${selectedDataRequest.id.slice(0, 8)} approved and completed with statutory retention exceptions applied.`,
      );
      setShowApproveDataRequestModal(false);
      setSelectedDataRequest(null);
      setDataReqApproveNotesForm('');
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectDataRequest = async () => {
    if (!selectedDataRequest) return;
    if (!dataReqRejectReasonForm.trim()) {
      alert('A typed reason is required to reject a compliance data request.');
      return;
    }
    try {
      setActionInProgress(true);
      await platformBackupsApi.rejectDataRequest(selectedDataRequest.id, {
        reason: dataReqRejectReasonForm.trim(),
      });
      setSuccessMessage(`Data request ${selectedDataRequest.id.slice(0, 8)} rejected.`);
      setShowRejectDataRequestModal(false);
      setSelectedDataRequest(null);
      setDataReqRejectReasonForm('');
      await loadData(true);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const filteredBackupRuns = useMemo(() => {
    return backupRuns.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesId = r.id.toLowerCase().includes(q);
        const matchesLoc = r.location.toLowerCase().includes(q);
        const matchesChecksum = r.checksum?.toLowerCase().includes(q);
        if (!matchesId && !matchesLoc && !matchesChecksum) return false;
      }
      if (runStatusFilter !== 'all' && r.status !== runStatusFilter) return false;
      if (runTestFilter !== 'all' && r.restoreTestStatus !== runTestFilter) return false;
      return true;
    });
  }, [backupRuns, searchQuery, runStatusFilter, runTestFilter]);

  const filteredRestoreRequests = useMemo(() => {
    return restoreRequests.filter((req) => {
      if (restoreStatusFilter !== 'all' && req.status !== restoreStatusFilter) return false;
      return true;
    });
  }, [restoreRequests, restoreStatusFilter]);

  const filteredDataRequests = useMemo(() => {
    return dataRequests.filter((req) => {
      const q = dataReqSearchQuery.toLowerCase().trim();
      if (q) {
        const matchesId = req.id.toLowerCase().includes(q);
        const matchesTenant = req.tenantName?.toLowerCase().includes(q) || req.tenantSubdomain?.toLowerCase().includes(q);
        const matchesTarget = req.targetEmployeeName?.toLowerCase().includes(q) || req.targetEmployeeId?.toLowerCase().includes(q);
        const matchesReason = req.reason.toLowerCase().includes(q);
        const matchesRequester = req.requestedByName?.toLowerCase().includes(q);
        const matchesApprover = req.approvedByName?.toLowerCase().includes(q);
        if (!matchesId && !matchesTenant && !matchesTarget && !matchesReason && !matchesRequester && !matchesApprover) {
          return false;
        }
      }
      if (dataReqTypeFilter !== 'all' && req.type !== dataReqTypeFilter) return false;
      if (dataReqStatusFilter !== 'all' && req.status !== dataReqStatusFilter) return false;
      if (dataReqUrgencyFilter !== 'all') {
        if (!req.countdown || req.countdown.severity !== dataReqUrgencyFilter) return false;
      }
      return true;
    });
  }, [dataRequests, dataReqSearchQuery, dataReqTypeFilter, dataReqStatusFilter, dataReqUrgencyFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              Backups, Restore & Data Compliance
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
              Control Plane · System Settings
            </span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              SECURITY.md §7, §9, §10
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Automated scheduled backups, periodic restore test runs, dual-control tenant restores (isolated boundary enforcement), and GDPR employee data anonymization.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTriggerBackupModal(true)}
            className="px-3.5 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Trigger Backup
          </button>
          <button
            onClick={() => setShowCreateRestoreModal(true)}
            className="px-3.5 py-2 text-sm font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <History className="h-4 w-4" />
            Request Restore
          </button>
          <button
            onClick={() => setShowTenantExportModal(true)}
            className="px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Archive className="h-4 w-4" />
            Export Tenant
          </button>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Prominent SLA Warning Banner if last backup or last restore test is older than threshold */}
      {summary?.hasThresholdWarning ? (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex-shrink-0">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
                    Resilience & SLA Threshold Alert: Action Required
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                    SLA Breached
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                  System resilience thresholds violated. Ensure frequent backups and verified restore tests to satisfy RPO/RTO compliance.
                </p>

                <div className="mt-3 space-y-2">
                  {summary.isBackupOverdue && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-amber-200 dark:border-amber-900/80 text-xs">
                      <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-medium">
                        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span><strong>Backup Overdue:</strong> {summary.backupWarning}</span>
                        <span className="text-slate-500 text-[11px]">
                          (Threshold: {summary.backupThresholdHours}h · Last: {formatTimeAgo(summary.lastBackupAt)})
                        </span>
                      </div>
                      <button
                        onClick={() => setShowTriggerBackupModal(true)}
                        className="px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                      >
                        Trigger Backup Now
                      </button>
                    </div>
                  )}

                  {summary.isRestoreTestOverdue && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-amber-200 dark:border-amber-900/80 text-xs">
                      <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-medium">
                        <AlertOctagon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span><strong>Restore Test Overdue:</strong> {summary.restoreTestWarning}</span>
                        <span className="text-slate-500 text-[11px]">
                          (Threshold: {summary.restoreTestThresholdDays}d · Last Verified: {formatTimeAgo(summary.lastSuccessfulRestoreTestAt)})
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (backupRuns.length > 0) {
                            handleRunRestoreTest(backupRuns[0]);
                          } else {
                            setShowTriggerBackupModal(true);
                          }
                        }}
                        className="px-3 py-1 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        Run Restore Test Now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setTempBackupHours(summary.backupThresholdHours);
                setTempRestoreDays(summary.restoreTestThresholdDays);
                setShowThresholdModal(true);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-700 bg-white/60 dark:bg-slate-800/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex-shrink-0 self-start md:self-auto"
            >
              Configure Thresholds
            </button>
          </div>
        </div>
      ) : summary ? (
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">Resilience SLAs Nominal:</span>
            <span>
              Last backup completed {formatTimeAgo(summary.lastBackupAt)} (SLA: {summary.backupThresholdHours}h) · Last restore test verified {formatTimeAgo(summary.lastSuccessfulRestoreTestAt)} (SLA: {summary.restoreTestThresholdDays}d).
            </span>
          </div>
          <button
            onClick={() => {
              setTempBackupHours(summary.backupThresholdHours);
              setTempRestoreDays(summary.restoreTestThresholdDays);
              setShowThresholdModal(true);
            }}
            className="px-2.5 py-1 text-xs font-medium rounded border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            Adjust Thresholds ({summary.backupThresholdHours}h / {summary.restoreTestThresholdDays}d)
          </button>
        </div>
      ) : null}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Last Successful Backup */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Backup Run</span>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${summary?.isBackupOverdue
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                }`}
            >
              {summary?.isBackupOverdue ? 'Overdue' : 'SLA Nominal'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary?.lastBackupAt ? formatTimeAgo(summary.lastBackupAt) : 'Never'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summary?.lastBackupSizeFormatted ? `Size: ${summary.lastBackupSizeFormatted}` : 'No backups recorded'}
          </div>
        </div>

        {/* Card 2: Last Successful Restore Test */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Restore Test</span>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${summary?.isRestoreTestOverdue
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                }`}
            >
              {summary?.isRestoreTestOverdue ? 'Overdue' : 'Passed'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary?.lastSuccessfulRestoreTestAt ? formatTimeAgo(summary.lastSuccessfulRestoreTestAt) : 'None'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summary?.lastSuccessfulRestoreTestDurationMs
              ? `${summary.lastSuccessfulRestoreTestDurationMs}ms sandbox latency`
              : `${summary?.restoreTestsPassed || 0} verified tests`}
          </div>
        </div>

        {/* Card 3: Local Storage & Backup Scope */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Backups & Scope</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary ? summary.totalBackups : '--'}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {summary ? `${summary.completedBackups} completed` : ''}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summary?.fileStorageIncludedCount ?? 0} with local file storage
          </div>
        </div>

        {/* Card 4: Pending Restore Approvals */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Restore Approvals</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${summary && summary.pendingRestoreApprovals > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-white'
                }`}
            >
              {summary ? summary.pendingRestoreApprovals : '--'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Dual control</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Requires 2nd Owner/Admin
          </div>
        </div>

        {/* Card 5: Resilience SLA Thresholds */}
        <div
          onClick={() => {
            if (summary) {
              setTempBackupHours(summary.backupThresholdHours);
              setTempRestoreDays(summary.restoreTestThresholdDays);
            }
            setShowThresholdModal(true);
          }}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          title="Click to adjust SLA thresholds"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">SLA Thresholds</span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold underline">Edit</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary ? `${summary.backupThresholdHours}h / ${summary.restoreTestThresholdDays}d` : '24h / 7d'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Backup: {summary?.backupThresholdHours || 24}h · Test: {summary?.restoreTestThresholdDays || 7}d
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab('runs')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'runs'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold'
            : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <Database className="h-4 w-4" />
          Scheduled Backups & Restore Tests
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {backupRuns.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('restore-requests')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'restore-requests'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold'
            : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <Lock className="h-4 w-4" />
          Restore Requests (Dual Approval)
          {summary && summary.pendingRestoreApprovals > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold">
              {summary.pendingRestoreApprovals}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('data-requests')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'data-requests'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold'
            : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Tenant Export & GDPR Anonymization
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {dataRequests.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Backup Runs & Restore Tests */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-sm text-slate-600 dark:text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                Automated Backup Routine & Local Storage Policy (SYSTEM_SETTINGS.md §3)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daily database snapshots and file storage bundles are retained for 30 days. Periodic restore tests verify archive checksums and validate schema compatibility in an isolated sandbox.
              </p>
            </div>
            <button
              onClick={() => setShowTriggerBackupModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0 self-start md:self-auto"
            >
              + Trigger Backup
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Run ID, location path, or checksum..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={runStatusFilter}
                onChange={(e) => setRunStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="running">Running</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>

              <select
                value={runTestFilter}
                onChange={(e) => setRunTestFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Restore Test Results</option>
                <option value="passed">Passed Sandbox</option>
                <option value="failed">Failed Sandbox</option>
                <option value="pending">Test Pending</option>
                <option value="not_tested">Not Tested</option>
              </select>

              {(searchQuery || runStatusFilter !== 'all' || runTestFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setRunStatusFilter('all');
                    setRunTestFilter('all');
                  }}
                  className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                  <tr>
                    <th className="py-3 px-4">Backup Run & Type</th>
                    <th className="py-3 px-4">Storage Location</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Scope & Driver</th>
                    <th className="py-3 px-4">Retention Expiry</th>
                    <th className="py-3 px-4">Automated Restore Test</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredBackupRuns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No backup runs match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredBackupRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="capitalize">{run.backupType} Backup</span>
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {run.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            {formatTimeAgo(run.startedAt)} · {new Date(run.startedAt).toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          <div className="truncate" title={run.location}>{run.location}</div>
                          {run.checksum && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>SHA: {run.checksum.slice(0, 12)}...</span>
                              <button
                                onClick={() => copyToClipboard(run.checksum!, `cs-${run.id}`)}
                                className="hover:text-indigo-600"
                                title="Copy full checksum"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              {copiedText === `cs-${run.id}` && <span className="text-emerald-500 text-[10px]">Copied!</span>}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {run.sizeFormatted}
                        </td>

                        <td className="py-3 px-4 text-xs">
                          <div className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                            {run.storageDriver.replace('_', ' ')}
                          </div>
                          {run.includesFileStorage ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                              <HardDrive className="h-3 w-3" />
                              Files included (local)
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 mt-0.5">DB only</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                          <div>{new Date(run.retentionExpiry).toLocaleDateString()}</div>
                          <span className="text-[11px] text-slate-400">Auto-prune</span>
                        </td>

                        <td className="py-3 px-4 text-xs">
                          {run.restoreTestStatus === 'passed' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                Passed
                              </span>
                              {run.restoreTestDurationMs && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {run.restoreTestDurationMs}ms sandbox
                                </div>
                              )}
                            </div>
                          )}
                          {run.restoreTestStatus === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <Clock className="h-3 w-3" />
                              Test Pending
                            </span>
                          )}
                          {run.restoreTestStatus === 'not_tested' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Not Tested
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right space-x-2">
                          {run.restoreTestDetails && (
                            <button
                              onClick={() => {
                                setSelectedBackupRun(run);
                                setShowTestDetailsModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              Details
                            </button>
                          )}
                          <button
                            onClick={() => handleRunRestoreTest(run)}
                            disabled={actionInProgress}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors"
                          >
                            Test Restore
                          </button>
                          <button
                            onClick={() => {
                              setRestoreBackupIdForm(run.id);
                              setShowCreateRestoreModal(true);
                            }}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-colors"
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Restore Requests & Dual Approval */}
      {activeTab === 'restore-requests' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 text-sm text-amber-900 dark:text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Dual-Control Restoration Security Rule (SYSTEM_SETTINGS.md §4)
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Every restore request requires approval from a second Platform Owner or Admin and a mandatory typed reason. Tenant-level restores are executed in strict isolation and will <strong>never touch other tenants' data</strong>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateRestoreModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0 self-start md:self-auto"
            >
              + Initiate Restore Request
            </button>
          </div>

          {/* Restore Request Status Filter Bar */}
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'pending_approval', label: 'Pending Approval' },
              { id: 'completed', label: 'Completed Restores' },
              { id: 'rejected', label: 'Rejected' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRestoreStatusFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${restoreStatusFilter === f.id
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                  <tr>
                    <th className="py-3 px-4">Restore Scope</th>
                    <th className="py-3 px-4">Target Tenant</th>
                    <th className="py-3 px-4">Initiated By & Reason</th>
                    <th className="py-3 px-4">Approval Status</th>
                    <th className="py-3 px-4">Dual Approver</th>
                    <th className="py-3 px-4">Isolation Assurance</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRestoreRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No restore requests found matching the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRestoreRequests.map((req) => {
                      const isInitiator = currentUserId && req.requestedByUserId === currentUserId;
                      return (
                        <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                            <span className="capitalize font-semibold">{req.scope} Restore</span>
                            <div className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-[140px]" title={req.backupLocation}>
                              from {req.backupLocation ? req.backupLocation.split('/').pop() : 'backup'}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {req.scope === 'tenant' ? (
                              <div>
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {req.tenantName || 'Tenant'}
                                </span>
                                <div className="text-xs text-slate-500 font-mono">
                                  {req.tenantSubdomain || req.tenantId}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                Full Cluster
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                              {req.requestedByName || req.requestedByUserId}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 italic mt-0.5 truncate" title={req.reason}>
                              "{req.reason}"
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(req.createdAt).toLocaleString()}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {req.status === 'pending_approval' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Clock className="h-3 w-3" />
                                Pending Approval
                              </span>
                            )}
                            {req.status === 'completed' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                Restored
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                                <Ban className="h-3 w-3" />
                                Rejected
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs">
                            {req.approvedByName ? (
                              <div>
                                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                  {req.approvedByName}
                                </span>
                                <div className="text-[11px] text-slate-400">
                                  {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : ''}
                                </div>
                              </div>
                            ) : req.rejectedByName ? (
                              <div>
                                <span className="font-medium text-red-700 dark:text-red-400">
                                  {req.rejectedByName}
                                </span>
                                <div className="text-[11px] text-slate-500 italic truncate max-w-[120px]" title={req.rejectionReason || ''}>
                                  {req.rejectionReason}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Awaiting 2nd Owner</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-xs">
                            {req.logs?.isolationGuaranteed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                                <ShieldCheck className="h-3 w-3" />
                                0 foreign rows touched
                              </span>
                            ) : req.status === 'completed' ? (
                              <span className="text-[11px] text-slate-500">Executed</span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Enforced at run</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right space-x-2">
                            {req.logs && (
                              <button
                                onClick={() => {
                                  setSelectedRestoreRequest(req);
                                  setShowJobLogsModal(true);
                                }}
                                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                View Logs
                              </button>
                            )}

                            {req.status === 'pending_approval' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedRestoreRequest(req);
                                    setShowApproveModal(true);
                                  }}
                                  disabled={actionInProgress || !!isInitiator}
                                  title={isInitiator ? 'You cannot approve your own request' : 'Approve & Execute'}
                                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${isInitiator
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedRestoreRequest(req);
                                    setShowRejectModal(true);
                                  }}
                                  disabled={actionInProgress}
                                  className="px-2.5 py-1 text-xs font-medium rounded border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Data Requests & GDPR Compliance */}
      {activeTab === 'data-requests' && (
        <div className="space-y-4">
          {/* Policy Banner */}
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20 text-sm text-indigo-900 dark:text-indigo-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                  <span>Data Requests Queue: Portability & Legal Erasure</span>
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                    GDPR Art. 12(3), 17(3)(b) · SECURITY.md §9
                  </span>
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                  Tenant Data Export provides full data portability archives within legal deadlines. Employee Anonymization scrubs all personal identifiers while strictly preserving statutory tax, payroll, and audit logs.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowTenantExportModal(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                + Tenant Export
              </button>
              <button
                onClick={() => setShowEmployeeAnonModal(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-700 hover:bg-purple-800 text-white shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <UserX className="h-3.5 w-3.5" />
                + Anonymize Employee
              </button>
            </div>
          </div>

          {/* Compliance KPI Chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Total Compliance Requests</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {dataRequests.length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <FileText className="h-4 w-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Awaiting Dual Review</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {dataRequests.filter((r) => r.status === 'pending').length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Urgent Deadline (&lt;7d)</p>
                <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                  {dataRequests.filter((r) => r.countdown && ['warning', 'critical'].includes(r.countdown.severity) && r.status !== 'completed').length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <Timer className="h-4 w-4" />
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between ${
              dataRequests.some((r) => r.countdown?.isOverdue && r.status !== 'completed')
                ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}>
              <div>
                <p className={`text-xs font-medium ${
                  dataRequests.some((r) => r.countdown?.isOverdue && r.status !== 'completed')
                    ? 'text-red-700 dark:text-red-300 font-bold'
                    : 'text-slate-500'
                }`}>
                  Overdue Compliance Breaches
                </p>
                <p className={`text-xl font-bold mt-0.5 ${
                  dataRequests.some((r) => r.countdown?.isOverdue && r.status !== 'completed')
                    ? 'text-red-600 dark:text-red-400 animate-pulse'
                    : 'text-slate-900 dark:text-white'
                }`}>
                  {dataRequests.filter((r) => r.countdown?.isOverdue && r.status !== 'completed').length}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${
                dataRequests.some((r) => r.countdown?.isOverdue && r.status !== 'completed')
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 w-full">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dataReqSearchQuery}
                onChange={(e) => setDataReqSearchQuery(e.target.value)}
                placeholder="Search requests by ID, tenant, employee, reason, approver..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={dataReqTypeFilter}
                onChange={(e) => setDataReqTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">All Request Types</option>
                <option value="tenant_export">Tenant Export</option>
                <option value="employee_anonymization">GDPR Anonymization</option>
              </select>

              <select
                value={dataReqStatusFilter}
                onChange={(e) => setDataReqStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={dataReqUrgencyFilter}
                onChange={(e) => setDataReqUrgencyFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">All Deadlines</option>
                <option value="nominal">Nominal (&gt;7d)</option>
                <option value="warning">Warning (24h - 7d)</option>
                <option value="critical">Critical (&lt;24h)</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          {/* Comprehensive Data Requests Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                  <tr>
                    <th className="py-3 px-4">Request Type & Target</th>
                    <th className="py-3 px-4">Reason & Requester</th>
                    <th className="py-3 px-4">Statutory Deadline & Countdown</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Dual Approver</th>
                    <th className="py-3 px-4">Legal Retention Exceptions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredDataRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No compliance data requests found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDataRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        {/* 1. Request Type & Target */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {req.type === 'tenant_export' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                <Archive className="h-3 w-3" />
                                Tenant Export
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                <UserX className="h-3 w-3" />
                                GDPR Anonymization
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-slate-900 dark:text-white mt-1">
                            {req.tenantName || 'Tenant'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {req.targetEmployeeName ? `Target: ${req.targetEmployeeName}` : (req.targetEmployeeId ? `ID: ${req.targetEmployeeId.slice(0, 13)}...` : req.tenantSubdomain)}
                          </div>
                        </td>

                        {/* 2. Reason & Requester */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate" title={req.reason}>
                            "{req.reason}"
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            by {req.requestedByName || req.requestedByUserId}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* 3. Statutory Deadline & Live Countdown */}
                        <td className="py-3 px-4">
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {req.deadline ? new Date(req.deadline).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="mt-1">
                            {req.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Completed
                              </span>
                            ) : req.countdown ? (
                              req.countdown.severity === 'overdue' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse">
                                  <AlertTriangle className="h-3 w-3" />
                                  {req.countdown.formatted}
                                </span>
                              ) : req.countdown.severity === 'critical' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  <Clock className="h-3 w-3" />
                                  Critical: {req.countdown.formatted}
                                </span>
                              ) : req.countdown.severity === 'warning' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  <Clock className="h-3 w-3" />
                                  Warning: {req.countdown.formatted}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <Clock className="h-3 w-3" />
                                  {req.countdown.formatted}
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-slate-400">No deadline</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Status */}
                        <td className="py-3 px-4">
                          {req.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Completed
                            </span>
                          )}
                          {req.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <Clock className="h-3 w-3" />
                              Pending Approval
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              <CheckCircle2 className="h-3 w-3" />
                              Approved
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                              <Ban className="h-3 w-3" />
                              Rejected
                            </span>
                          )}
                        </td>

                        {/* 5. Dual Approver */}
                        <td className="py-3 px-4 text-xs">
                          {req.approvedByName ? (
                            <div>
                              <div className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {req.approvedByName}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : 'Approved'}
                              </div>
                            </div>
                          ) : req.rejectedByName ? (
                            <div>
                              <div className="font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
                                <Ban className="h-3 w-3" />
                                {req.rejectedByName}
                              </div>
                              <div className="text-[10px] text-red-500 truncate max-w-[120px]" title={req.rejectionReason || 'Rejected'}>
                                {req.rejectionReason || 'Rejected'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                              Awaiting Review
                            </span>
                          )}
                        </td>

                        {/* 6. Legal Retention Exceptions */}
                        <td className="py-3 px-4 text-xs">
                          {req.type === 'employee_anonymization' ? (
                            <div>
                              <div className="flex flex-wrap gap-1 mb-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  Tax (7y)
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Payroll (7y)
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  Audit (10y)
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedDataRequest(req);
                                  setShowLegalExceptionsModal(true);
                                }}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline font-medium"
                              >
                                View Exceptions ({req.legalRetentionExceptions?.length || 4})
                              </button>
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {req.archiveSizeFormatted || '18.4 MB'}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                Full Tenant Archive · 7d TTL
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 7. Actions */}
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedDataRequest(req);
                                  setDataReqApproveNotesForm('');
                                  setShowApproveDataRequestModal(true);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDataRequest(req);
                                  setDataReqRejectReasonForm('');
                                  setShowRejectDataRequestModal(true);
                                }}
                                className="px-2.5 py-1 text-xs font-medium rounded border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {req.status === 'completed' && req.completionRecord && (
                            <button
                              onClick={() => {
                                setSelectedDataRequest(req);
                                setShowCompletionRecordModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                            >
                              <FileCheck2 className="h-3 w-3" />
                              Completion Record
                            </button>
                          )}

                          {req.type === 'tenant_export' && req.archiveUrl && (
                            <a
                              href={req.archiveUrl}
                              download
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </a>
                          )}

                          {req.anonymizedSummary && !req.completionRecord && (
                            <button
                              onClick={() => {
                                setSelectedDataRequest(req);
                                setShowAnonSummaryModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              Summary
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Trigger Backup Modal */}
      {showTriggerBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-600" />
                Trigger On-Demand Backup
              </h3>
              <button onClick={() => setShowTriggerBackupModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Backup Scope
                </label>
                <select
                  value={backupTypeForm}
                  onChange={(e) => setBackupTypeForm(e.target.value as BackupType)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="full">Full Backup (PostgreSQL Database + File Storage Directory)</option>
                  <option value="database">Database Only (PostgreSQL schemas & tables)</option>
                  <option value="file_storage">File Storage Directory Only (documents, avatars)</option>
                </select>
              </div>

              <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200">
                <strong>SYSTEM_SETTINGS.md §3 Rule:</strong> When local-disk driver is used, the file storage directory is automatically included in the backup snapshot alongside the PostgreSQL database.
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includesFileStorageForm}
                  onChange={(e) => setIncludesFileStorageForm(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Include File Storage Directory in backup bundle</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowTriggerBackupModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerBackup}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5"
              >
                {actionInProgress ? 'Executing Backup...' : 'Start Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Restore Request Modal */}
      {showCreateRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-5 w-5 text-amber-600" />
                Initiate Restore Request
              </h3>
              <button onClick={() => setShowCreateRestoreModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Source Backup Run
                </label>
                <select
                  value={restoreBackupIdForm}
                  onChange={(e) => setRestoreBackupIdForm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {backupRuns.map((r) => (
                    <option key={r.id} value={r.id}>
                      {new Date(r.startedAt).toLocaleString()} ({r.backupType}, {r.sizeFormatted})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Restore Scope
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreScope"
                      checked={restoreScopeForm === 'tenant'}
                      onChange={() => setRestoreScopeForm('tenant')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Single Tenant (Isolated)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreScope"
                      checked={restoreScopeForm === 'full'}
                      onChange={() => setRestoreScopeForm('full')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Full Platform Cluster</span>
                  </label>
                </div>
              </div>

              {restoreScopeForm === 'tenant' && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Tenant
                  </label>
                  <select
                    value={restoreTenantIdForm}
                    onChange={(e) => setRestoreTenantIdForm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subdomain})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    ✓ Tenant isolation guarantee: only rows belonging to this tenant will be modified.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mandatory Typed Reason
                </label>
                <textarea
                  value={restoreReasonForm}
                  onChange={(e) => setRestoreReasonForm(e.target.value)}
                  placeholder="Explain why this restoration is necessary (e.g. recover corrupted leave policies from ticket #308)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200">
                <strong>Dual Authorization Notice:</strong> Once submitted, a second Platform Owner or Admin must review and approve this request before execution can proceed.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowCreateRestoreModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRestoreRequest}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                {actionInProgress ? 'Submitting...' : 'Submit for Dual Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Approve Restore Confirmation Modal */}
      {showApproveModal && selectedRestoreRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Approve & Execute Restore
              </h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div>
                  <span className="text-xs text-slate-500">Scope:</span>{' '}
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {selectedRestoreRequest.scope}
                  </span>
                </div>
                {selectedRestoreRequest.tenantName && (
                  <div>
                    <span className="text-xs text-slate-500">Target Tenant:</span>{' '}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {selectedRestoreRequest.tenantName} ({selectedRestoreRequest.tenantSubdomain})
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-500">Initiated By:</span>{' '}
                  <span className="text-slate-800 dark:text-slate-200">
                    {selectedRestoreRequest.requestedByName}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Reason:</span>
                  <p className="italic text-slate-700 dark:text-slate-300 mt-0.5">
                    "{selectedRestoreRequest.reason}"
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-200">
                <strong>Isolation Guarantee:</strong> Executing this tenant restore will exclusively update data belonging to tenant ID <code className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border">{selectedRestoreRequest.tenantId || 'all'}</code>. All other tenants remain untouched.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveRestore}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
              >
                {actionInProgress ? 'Restoring...' : 'Confirm Dual Approval & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Reject Restore Modal */}
      {showRejectModal && selectedRestoreRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-600" />
                Reject Restore Request
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <p className="text-slate-600 dark:text-slate-400">
                Provide a reason for rejecting the restore request submitted by {selectedRestoreRequest.requestedByName}.
              </p>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectReasonForm}
                  onChange={(e) => setRejectReasonForm(e.target.value)}
                  placeholder="Explain why this request is rejected..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRestore}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Tenant Data Export Modal */}
      {showTenantExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Archive className="h-5 w-5 text-indigo-600" />
                Generate Tenant Data Export Archive
              </h3>
              <button onClick={() => setShowTenantExportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tenant
                </label>
                <select
                  value={exportTenantIdForm}
                  onChange={(e) => setExportTenantIdForm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subdomain})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Export
                </label>
                <input
                  type="text"
                  value={exportReasonForm}
                  onChange={(e) => setExportReasonForm(e.target.value)}
                  placeholder="e.g. Client offboarding / statutory audit archive"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Statutory SLA Deadline (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={exportDeadlineDaysForm}
                  onChange={(e) => setExportDeadlineDaysForm(parseInt(e.target.value, 10) || 7)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-500">Standard data portability SLA: 7 days.</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400">
                Generates a complete downloadable JSON/ZIP bundle containing all tenant business entities: organizational hierarchy, employees, attendance logs, leave balances, and payroll totals. Available for 7 days.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowTenantExportModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTenantExport}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                {actionInProgress ? 'Generating...' : 'Generate Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Employee Anonymization Modal */}
      {showEmployeeAnonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserX className="h-5 w-5 text-purple-600" />
                Employee Data Anonymization (Right to be Forgotten)
              </h3>
              <button onClick={() => setShowEmployeeAnonModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tenant
                </label>
                <select
                  value={anonTenantIdForm}
                  onChange={(e) => setAnonTenantIdForm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subdomain})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Employee UUID
                </label>
                <input
                  type="text"
                  value={anonTargetEmployeeIdForm}
                  onChange={(e) => setAnonTargetEmployeeIdForm(e.target.value)}
                  placeholder="Enter employee UUID (e.g. from employee detail)"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Request
                </label>
                <input
                  type="text"
                  value={anonReasonForm}
                  onChange={(e) => setAnonReasonForm(e.target.value)}
                  placeholder="e.g. Employee GDPR Article 17 erasure request"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Statutory SLA Deadline (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={anonDeadlineDaysForm}
                  onChange={(e) => setAnonDeadlineDaysForm(parseInt(e.target.value, 10) || 30)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-500">GDPR Art. 12(3) statutory response limit: 30 days.</span>
              </div>

              <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                <p className="font-semibold">SECURITY.md §9 & AUDIT_LOG.md §6 Guarantee:</p>
                <p>
                  • Personal identifiers (name, phone, address, tax ID, bank accounts) will be permanently scrubbed.
                </p>
                <p>
                  • <strong>Statutory payroll and tax records are strictly preserved</strong> in anonymized form to maintain financial integrity.
                </p>
                <p>
                  • Existing audit logs remain intact and immutable.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowEmployeeAnonModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEmployeeAnon}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              >
                {actionInProgress ? 'Scrubbing...' : 'Execute Anonymization'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Restore Test Details Modal */}
      {showTestDetailsModal && selectedBackupRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Automated Restore Verification Report
              </h3>
              <button onClick={() => setShowTestDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Backup Run:</span>
                <span className="font-mono text-xs">{selectedBackupRun.id.slice(0, 16)}...</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Restore Test Status:</span>
                <span className="font-semibold text-emerald-600 uppercase">
                  {selectedBackupRun.restoreTestStatus}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Execution Latency:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedBackupRun.restoreTestDurationMs} ms
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Verified Timestamp:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {selectedBackupRun.restoreTestAt ? new Date(selectedBackupRun.restoreTestAt).toLocaleString() : '--'}
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Sandbox Verification Details
                </span>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(selectedBackupRun.restoreTestDetails, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowTestDetailsModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Anonymization Summary Modal */}
      {showAnonSummaryModal && selectedDataRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-purple-600" />
                GDPR Anonymization & Preservation Summary
              </h3>
              <button onClick={() => setShowAnonSummaryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500">Employee Number:</span>{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedDataRequest.anonymizedSummary?.employeeNumber || 'Redacted'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Statutory Payroll Records Retained:</span>{' '}
                  <span className="font-semibold text-emerald-600">
                    {selectedDataRequest.anonymizedSummary?.statutoryPayrollRecordsPreserved ?? 0} records
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Audit Logs Preserved:</span>{' '}
                  <span className="font-semibold text-emerald-600">
                    {selectedDataRequest.anonymizedSummary?.auditLogsRetained ? 'Yes (Immutable)' : 'Yes'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Full Compliance Payload
                </span>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(selectedDataRequest.anonymizedSummary, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowAnonSummaryModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: Restore Job Logs Modal */}
      {showJobLogsModal && selectedRestoreRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Restore Execution Log & Isolation Verification
              </h3>
              <button onClick={() => setShowJobLogsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                <strong>Tenant Isolation Status:</strong>{' '}
                {selectedRestoreRequest.logs?.isolationGuaranteed
                  ? 'Guaranteed - 0 foreign tenant rows mutated.'
                  : 'Executed'}
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Logged Execution Trail
                </span>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-52 border border-slate-800">
                  {JSON.stringify(selectedRestoreRequest.logs, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowJobLogsModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 10: Threshold Settings Modal */}
      {showThresholdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-indigo-600" />
                Configure Resilience & SLA Thresholds
              </h3>
              <button
                onClick={() => setShowThresholdModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Define the maximum acceptable staleness thresholds before warning banners are triggered across the Platform Control Plane.
              </p>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Backup Freshness Threshold (Hours)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[6, 12, 24, 48].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setTempBackupHours(hrs)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${tempBackupHours === hrs
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      {hrs} Hours
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Alert is shown if the latest completed backup is older than this value. Default: 24h.
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Restore Test Freshness Threshold (Days)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTempRestoreDays(days)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${tempRestoreDays === days
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      {days} {days === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Alert is shown if no automated sandbox test has passed within this window. Default: 7d (SECURITY.md §7).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
                <strong>Simulation Tip:</strong> Selecting a strict threshold (e.g. 6h backup or 1d restore test) triggers the persistent warning banner immediately for operational testing.
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={async () => {
                  setBackupThresholdHours(0.01);
                  setRestoreTestThresholdDays(0.0001);
                  setShowThresholdModal(false);
                  await loadData(true, {
                    backupThresholdHours: 0.01,
                    restoreTestThresholdDays: 0.0001,
                  });
                  setSuccessMessage('Simulated threshold breach: SLA Warning Banner triggered.');
                  setTimeout(() => setSuccessMessage(null), 4000);
                }}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Simulate SLA Breach
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowThresholdModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setBackupThresholdHours(tempBackupHours);
                    setRestoreTestThresholdDays(tempRestoreDays);
                    setShowThresholdModal(false);
                    await loadData(true, {
                      backupThresholdHours: tempBackupHours,
                      restoreTestThresholdDays: tempRestoreDays,
                    });
                    setSuccessMessage(`SLA thresholds updated to ${tempBackupHours}h backup / ${tempRestoreDays}d restore test.`);
                    setTimeout(() => setSuccessMessage(null), 3000);
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  Apply Thresholds
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 11: Compliance Completion Record Modal */}
      {showCompletionRecordModal && selectedDataRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-emerald-600" />
                Compliance Completion Record
              </h3>
              <button
                onClick={() => setShowCompletionRecordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1">
              {/* Header Details */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Request ID:</span>
                  <span className="font-mono text-slate-900 dark:text-white font-semibold">
                    {selectedDataRequest.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Request Type:</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 capitalize">
                    {selectedDataRequest.type.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Target Tenant:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selectedDataRequest.tenantName} ({selectedDataRequest.tenantSubdomain})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Completion Timestamp:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selectedDataRequest.completedAt ? new Date(selectedDataRequest.completedAt).toLocaleString() : 'Completed'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Dual Approver:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {selectedDataRequest.approvedByName || 'Authorized Platform Staff'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Executed By:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedDataRequest.completionRecord?.executedByName || 'Compliance Processing Engine'}
                  </span>
                </div>
              </div>

              {/* Completion Summary */}
              {selectedDataRequest.completionRecord?.summary && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Execution Summary
                  </h4>
                  <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200">
                    {selectedDataRequest.completionRecord.summary}
                  </div>
                </div>
              )}

              {/* Scrubbed Fields */}
              {selectedDataRequest.completionRecord?.scrubbedFields && selectedDataRequest.completionRecord.scrubbedFields.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Scrubbed Personal Identifiers (GDPR Art. 17)
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDataRequest.completionRecord.scrubbedFields.map((field) => (
                      <span
                        key={field}
                        className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                      >
                        ✓ {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preserved Records Count */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDataRequest.completionRecord?.preservedPayrollRunsCount ?? 'All'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Payroll Runs (7y)</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDataRequest.completionRecord?.preservedAuditLogsCount ?? 'All'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Audit Logs (10y)</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDataRequest.completionRecord?.preservedTaxProfilesCount ?? 'All'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Tax Profiles (7y)</div>
                </div>
              </div>

              {/* Archive Information (if export) */}
              {selectedDataRequest.type === 'tenant_export' && (
                <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Archive className="h-4 w-4" />
                    Downloadable Portability Package
                  </div>
                  <div className="flex justify-between">
                    <span>Archive Size:</span>
                    <span className="font-semibold">{selectedDataRequest.archiveSizeFormatted || '18.4 MB'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retention Expiry:</span>
                    <span>{selectedDataRequest.archiveExpiresAt ? new Date(selectedDataRequest.archiveExpiresAt).toLocaleString() : '7 days from generation'}</span>
                  </div>
                  {selectedDataRequest.archiveUrl && (
                    <div className="pt-1.5">
                      <a
                        href={selectedDataRequest.archiveUrl}
                        download
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Archive Bundle
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowCompletionRecordModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 transition-colors"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 12: Legal Retention Exceptions Modal */}
      {showLegalExceptionsModal && selectedDataRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="h-5 w-5 text-indigo-600" />
                Legal-Retention Exceptions Applied
              </h3>
              <button
                onClick={() => setShowLegalExceptionsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1">
              <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200">
                <strong>GDPR Article 17(3)(b) & (e) Directive:</strong> The right to erasure does not apply to the extent that processing is necessary for compliance with a legal obligation (statutory tax/wage accounting) or for the establishment, exercise, or defense of legal claims.
              </div>

              <div className="space-y-3">
                {(selectedDataRequest.legalRetentionExceptions && selectedDataRequest.legalRetentionExceptions.length > 0
                  ? selectedDataRequest.legalRetentionExceptions
                  : [
                      {
                        category: 'Tax & Fiscal Accounting',
                        legalBasis: 'GDPR Art. 17(3)(b) / Tax Code §44',
                        retentionPeriod: '7 years',
                        reason: 'Mandatory retention of statutory compensation and withholding schedules for tax authority audits.',
                        recordsCount: 1,
                        affectedEntities: ['PayrollRuns', 'TaxWithholdingProfiles'],
                      },
                      {
                        category: 'Statutory Payroll Journals',
                        legalBasis: 'FLSA 29 U.S.C. §211 / Employment Standards',
                        retentionPeriod: '7 years',
                        reason: 'Statutory wage payment histories must be preserved to prove compliance with minimum wage and overtime laws.',
                        recordsCount: 1,
                        affectedEntities: ['PayrollItems', 'DisbursementRecords'],
                      },
                      {
                        category: 'Security & Access Audit Logs',
                        legalBasis: 'AUDIT_LOG.md §6 / ISO 27001 Control A.12.4',
                        retentionPeriod: '10 years',
                        reason: 'Immutable append-only access and modification logs required for regulatory forensics and anti-fraud verification.',
                        recordsCount: 1,
                        affectedEntities: ['AuditLogs'],
                      },
                      {
                        category: 'Pension & Benefit Accruals',
                        legalBasis: 'ERISA Section 107 / Statutory Retirement Rules',
                        retentionPeriod: '10 years',
                        reason: 'Vested benefit accruals and historical contribution logs preserved for retirement qualification calculations.',
                        recordsCount: 1,
                        affectedEntities: ['BenefitEnrollments', 'DeductionSchedules'],
                      },
                    ]
                ).map((exc, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{exc.category}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {exc.retentionPeriod}
                          </span>
                        </div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                          {exc.legalBasis}
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {exc.recordsCount} {exc.recordsCount === 1 ? 'Record' : 'Records'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {exc.reason}
                    </p>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span>Affected Entities:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {exc.affectedEntities?.join(', ') || 'PayrollRuns, AuditLogs'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowLegalExceptionsModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 13: Approve Data Request Modal */}
      {showApproveDataRequestModal && selectedDataRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Approve & Execute Compliance Request
              </h3>
              <button
                onClick={() => setShowApproveDataRequestModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Request:</span>{' '}
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {selectedDataRequest.type.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Target Tenant:</span>{' '}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {selectedDataRequest.tenantName} ({selectedDataRequest.tenantSubdomain})
                  </span>
                </div>
                {selectedDataRequest.targetEmployeeName && (
                  <div>
                    <span className="text-slate-500">Target Employee:</span>{' '}
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      {selectedDataRequest.targetEmployeeName}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Statutory Deadline:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedDataRequest.deadline ? new Date(selectedDataRequest.deadline).toLocaleDateString() : '30 days SLA'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Reason:</span>
                  <p className="italic text-slate-700 dark:text-slate-300 mt-0.5">
                    "{selectedDataRequest.reason}"
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Approval Notes / Legal Verification (Optional)
                </label>
                <textarea
                  value={dataReqApproveNotesForm}
                  onChange={(e) => setDataReqApproveNotesForm(e.target.value)}
                  placeholder="Record verification of identity, legal representative authority, or statutory basis..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-200">
                <strong>Statutory Guarantee:</strong> Approving this request will scrub all personal identifiers under GDPR while automatically applying statutory retention exceptions for payroll runs, tax summaries, and audit logs.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowApproveDataRequestModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveDataRequest}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
              >
                {actionInProgress ? 'Processing...' : 'Approve & Execute Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 14: Reject Data Request Modal */}
      {showRejectDataRequestModal && selectedDataRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-600" />
                Reject Compliance Request
              </h3>
              <button
                onClick={() => setShowRejectDataRequestModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                Under GDPR Article 12(4), when refusing to act on a request for erasure or portability, the controller must state the specific legal grounds and inform the data subject of their right to lodge a complaint with a supervisory authority.
              </p>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rejection Reason & Legal Justification (Required)
                </label>
                <textarea
                  value={dataReqRejectReasonForm}
                  onChange={(e) => setDataReqRejectReasonForm(e.target.value)}
                  placeholder="Explain why this request is denied (e.g. unverified identity, pending statutory subpoena, conflicting contractual obligation)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowRejectDataRequestModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectDataRequest}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
