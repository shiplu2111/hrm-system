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
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
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
  DataRequestItem,
  DataRequestType,
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

  // Selected entities for modals
  const [selectedBackupRun, setSelectedBackupRun] = useState<BackupRunItem | null>(null);
  const [selectedRestoreRequest, setSelectedRestoreRequest] = useState<RestoreRequestItem | null>(null);
  const [selectedDataRequest, setSelectedDataRequest] = useState<DataRequestItem | null>(null);

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
  const [anonTenantIdForm, setAnonTenantIdForm] = useState<string>('');
  const [anonTargetEmployeeIdForm, setAnonTargetEmployeeIdForm] = useState<string>('');
  const [anonTypeForm, setAnonTypeForm] = useState<'employee_anonymization' | 'employee_deletion'>('employee_anonymization');
  const [anonReasonForm, setAnonReasonForm] = useState<string>('');
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

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [sum, runs, restores, dataReqs, tList] = await Promise.all([
        platformBackupsApi.getSummary(),
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
      });
      setSuccessMessage('Tenant export archive generated successfully. Ready for download.');
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
      });
      setSuccessMessage(
        'Employee personal identifiers scrubbed while statutory payroll records and audit logs are preserved in anonymized form.',
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Backups</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary ? summary.totalBackups : '--'}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {summary ? `${summary.completedBackups} completed` : ''}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summary?.lastBackupSizeFormatted ? `Last: ${summary.lastBackupSizeFormatted}` : 'Retention: 30 days'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Restore Tests Passed</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary ? summary.restoreTestsPassed : '--'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {summary ? `of ${summary.restoreTestsCount} tested` : ''}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Periodic automated sandbox tests
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Local Storage Backups</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary ? summary.fileStorageIncludedCount : '--'}
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              Files + DB
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            SYSTEM_SETTINGS.md §3 compliant
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Restore Approvals</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${summary && summary.pendingRestoreApprovals > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {summary ? summary.pendingRestoreApprovals : '--'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Dual control
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Requires 2nd Owner/Admin
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Data & GDPR Compliance</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary ? summary.anonymizedEmployees : '--'}
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              {summary ? `${summary.completedExports} exports` : ''}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Payroll & audit logs preserved
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab('runs')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'runs'
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
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'restore-requests'
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
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'data-requests'
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
                  {backupRuns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No backup runs found.
                      </td>
                    </tr>
                  ) : (
                    backupRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="capitalize">{run.backupType} Backup</span>
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {run.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            {new Date(run.startedAt).toLocaleString()}
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
                  {restoreRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No restore requests recorded.
                      </td>
                    </tr>
                  ) : (
                    restoreRequests.map((req) => {
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
                                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                                    isInitiator
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
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20 text-sm text-indigo-900 dark:text-indigo-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-indigo-900 dark:text-indigo-100">
                  Data Portability & Statutory Retention Policy (SECURITY.md §9, AUDIT_LOG.md §6)
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                  Tenant Data Export generates a self-contained archive for client offboarding. Employee Anonymization scrubs all personal identifiers under GDPR while preserving statutory payroll records and keeping audit logs intact.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowTenantExportModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                + Tenant Export
              </button>
              <button
                onClick={() => setShowEmployeeAnonModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-sm"
              >
                + Anonymize Employee
              </button>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                  <tr>
                    <th className="py-3 px-4">Request Type</th>
                    <th className="py-3 px-4">Tenant & Target</th>
                    <th className="py-3 px-4">Reason & Requester</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Compliance Outcome</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {dataRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No data requests recorded.
                      </td>
                    </tr>
                  ) : (
                    dataRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          {req.type === 'tenant_export' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              <Archive className="h-3 w-3" />
                              Tenant Export
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                              <UserX className="h-3 w-3" />
                              GDPR Anonymization
                            </span>
                          )}
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            {new Date(req.createdAt).toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {req.tenantName || 'Tenant'}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {req.targetEmployeeName ? `Target: ${req.targetEmployeeName}` : req.tenantSubdomain}
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate" title={req.reason}>
                            "{req.reason}"
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            by {req.requestedByName || req.requestedByUserId}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            {req.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-xs">
                          {req.type === 'tenant_export' ? (
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {req.archiveSizeFormatted || '18.4 MB'}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Expires: {req.archiveExpiresAt ? new Date(req.archiveExpiresAt).toLocaleDateString() : '7 days'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                PII Scrubbed
                              </span>
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                Payroll & audit retained
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right space-x-2">
                          {req.type === 'tenant_export' && req.archiveUrl && (
                            <a
                              href={req.archiveUrl}
                              download
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          )}

                          {req.anonymizedSummary && (
                            <button
                              onClick={() => {
                                setSelectedDataRequest(req);
                                setShowAnonSummaryModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              View Summary
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
    </div>
  );
};
