import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  Headphones,
  KeyRound,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  Platform2faResetRequestView,
  PlatformUserDetailedView,
} from '@hrm/shared-types';
import { getPlatformStoredUser } from '@/lib/api-client';
import {
  deactivatePlatformUser,
  invitePlatformUser,
  list2faResetRequests,
  listPlatformRoles,
  listPlatformUsers,
  reactivatePlatformUser,
  request2faReset,
  review2faReset,
  type PlatformRoleOption,
} from '@/lib/platform-staff-api';

function getRoleBadgeStyle(roleName: string) {
  switch (roleName) {
    case 'Platform Owner':
      return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800';
    case 'Platform Admin':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
    case 'Compliance Admin':
      return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
    case 'Billing Admin':
    case 'Billing Ops':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    case 'Support Agent':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

function formatDate(isoString: string | null) {
  if (!isoString) return 'Never signed in';
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function PlatformUsersPage() {
  const currentUser = getPlatformStoredUser();
  const isPlatformOwner = currentUser?.roleName === 'Platform Owner';

  const [activeTab, setActiveTab] = useState<'staff' | 'resets' | 'roles'>('staff');
  const [users, setUsers] = useState<PlatformUserDetailedView[]>([]);
  const [roles, setRoles] = useState<PlatformRoleOption[]>([]);
  const [resetRequests, setResetRequests] = useState<Platform2faResetRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'active' | 'invited' | 'deactivated'>('All');

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteTempPassword, setInviteTempPassword] = useState('TempPass2026!');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    email: string;
    temporaryPassword?: string;
    roleName: string;
  } | null>(null);

  // 2FA Reset Request modal
  const [resetModalTarget, setResetModalTarget] = useState<PlatformUserDetailedView | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Deactivate confirmation modal
  const [deactivateModalTarget, setDeactivateModalTarget] = useState<PlatformUserDetailedView | null>(null);
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false);

  // Review modal
  const [reviewModalRequest, setReviewModalRequest] = useState<Platform2faResetRequestView | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Load data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [usersData, rolesData, requestsData] = await Promise.all([
        listPlatformUsers(),
        listPlatformRoles(),
        list2faResetRequests(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setResetRequests(requestsData);

      // Set default invite role if none selected
      if (!inviteRoleId && rolesData.length > 0) {
        const supportRole = rolesData.find((r) => r.name === 'Support Agent') || rolesData[0];
        setInviteRoleId(supportRole.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform staff data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingResetRequests = useMemo(
    () => resetRequests.filter((r) => r.status === 'pending'),
    [resetRequests],
  );

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive && u.status === 'active').length;
    const invited = users.filter((u) => u.status === 'invited').length;
    const deactivated = users.filter((u) => !u.isActive).length;
    return { total, active, invited, deactivated, pendingResets: pendingResetRequests.length };
  }, [users, pendingResetRequests]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      const role = user.roleName.toLowerCase();
      const q = search.trim().toLowerCase();

      const matchesSearch = !q || fullName.includes(q) || email.includes(q) || role.includes(q);
      const matchesRole = roleFilter === 'All' || user.roleName === roleFilter;
      const matchesStatus = statusFilter === 'All' || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Handle Invite Submit
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFirstName.trim() || !inviteLastName.trim() || !inviteEmail.trim() || !inviteRoleId) {
      return;
    }

    setInviteSubmitting(true);
    setError(null);
    try {
      const res = await invitePlatformUser({
        firstName: inviteFirstName.trim(),
        lastName: inviteLastName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        roleId: inviteRoleId,
        temporaryPassword: inviteTempPassword.trim(),
      });

      const selectedRole = roles.find((r) => r.id === inviteRoleId);
      setInviteResult({
        email: res.user.email,
        temporaryPassword: res.temporaryPassword || inviteTempPassword,
        roleName: selectedRole?.name || 'Staff',
      });
      setNotice(`Invitation created for ${res.user.email}. First login requires mandatory 2FA enrollment.`);
      await loadData(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to invite platform user');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const closeInviteModal = () => {
    setInviteModalOpen(false);
    setInviteResult(null);
    setInviteFirstName('');
    setInviteLastName('');
    setInviteEmail('');
    setInviteTempPassword('TempPass2026!');
  };

  // Handle Deactivate
  const handleDeactivate = async () => {
    if (!deactivateModalTarget) return;
    setDeactivateSubmitting(true);
    setError(null);
    try {
      await deactivatePlatformUser(deactivateModalTarget.id);
      setNotice(`Deactivated ${deactivateModalTarget.email}. All active user sessions revoked immediately.`);
      setDeactivateModalTarget(null);
      await loadData(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to deactivate platform user');
    } finally {
      setDeactivateSubmitting(false);
    }
  };

  // Handle Reactivate
  const handleReactivate = async (user: PlatformUserDetailedView) => {
    setError(null);
    try {
      await reactivatePlatformUser(user.id);
      setNotice(`Reactivated ${user.email}.`);
      await loadData(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to reactivate platform user');
    }
  };

  // Handle Request 2FA Reset
  const handleRequest2faReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalTarget || !resetReason.trim()) return;
    setResetSubmitting(true);
    setError(null);
    try {
      await request2faReset(resetModalTarget.id, { reason: resetReason.trim() });
      setNotice(
        `2FA reset requested for ${resetModalTarget.email}. Another administrator must approve this request (Four-Eyes dual approval).`,
      );
      setResetModalTarget(null);
      setResetReason('');
      await loadData(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to request 2FA reset');
    } finally {
      setResetSubmitting(false);
    }
  };

  // Handle Review 2FA Reset
  const handleReview2faReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalRequest) return;
    setReviewSubmitting(true);
    setError(null);
    try {
      await review2faReset(reviewModalRequest.id, {
        action: reviewAction,
        reviewReason: reviewReason.trim() || undefined,
      });
      setNotice(
        reviewAction === 'approve'
          ? `2FA reset approved for ${reviewModalRequest.targetUserEmail}. Their 2FA secret was cleared and active sessions revoked. They must re-enroll 2FA on their next login.`
          : `2FA reset rejected for ${reviewModalRequest.targetUserEmail}.`,
      );
      setReviewModalRequest(null);
      setReviewReason('');
      await loadData(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to review 2FA reset request');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-1 tracking-wider uppercase">
            <Zap className="h-3.5 w-3.5" /> PLATFORM CONTROL PLANE
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white">
            Platform Users & Staff
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Internal CMSN platform staff operators with role hierarchy, mandatory first-login 2FA enrollment,
            immediate session revocation on deactivation, and four-eyes dual-control 2FA reset approval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/15 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite Staff</span>
          </button>
        </div>
      </div>

      {/* Global Notifications & Alerts */}
      {notice && (
        <div className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium">{notice}</p>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-300 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-800 dark:text-rose-300 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Key Metrics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Users className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold mt-3 text-slate-900 dark:text-white">{stats.total}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Total Staff Members</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold mt-3 text-emerald-600 dark:text-emerald-400">{stats.active}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Active Operators</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            <Mail className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold mt-3 text-blue-600 dark:text-blue-400">{stats.invited}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Pending 1st Login (2FA)</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            <UserX className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold mt-3 text-rose-600 dark:text-rose-400">{stats.deactivated}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Deactivated (Revoked)</div>
        </div>

        <div
          onClick={() => setActiveTab('resets')}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-all ${
            stats.pendingResets > 0
              ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 hover:border-amber-400'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <KeyRound className="h-4 w-4" />
            </div>
            {stats.pendingResets > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <div className="text-2xl font-extrabold mt-3 text-amber-600 dark:text-amber-400">{stats.pendingResets}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">2FA Reset Approvals</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Staff Directory</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resets')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'resets'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>2FA Reset Requests (Four-Eyes Queue)</span>
          {pendingResetRequests.length > 0 && (
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-extrabold">
              {pendingResetRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Platform Roles & Hierarchy</span>
        </button>
      </div>

      {/* Tab 1: Staff Directory */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff by name, email, or role..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="invited">Invited (Setup Pending)</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Staff Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
              <span>
                Showing {filteredUsers.length} of {users.length} platform staff operators
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Role Hierarchy Enforced: Only Platform Owner can manage other Owners</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[960px]">
                <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Staff Member</th>
                    <th className="px-4 py-3.5">Platform Role</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">2FA Authentication</th>
                    <th className="px-4 py-3.5">Last Login</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Loading platform staff members...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        No platform staff members found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((member) => {
                      const isSelf = currentUser?.id === member.id;
                      const isTargetOwner = member.roleName === 'Platform Owner';
                      const canManageTarget = isPlatformOwner || !isTargetOwner;

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors"
                        >
                          {/* Staff Name & Email */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                                {member.firstName.charAt(0)}
                                {member.lastName.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    {member.firstName} {member.lastName}
                                  </span>
                                  {isSelf && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <Mail className="h-3 w-3 text-slate-400" />
                                  <span>{member.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${getRoleBadgeStyle(
                                member.roleName,
                              )}`}
                            >
                              {member.roleName === 'Platform Owner' && <Shield className="h-3 w-3" />}
                              {member.roleName}
                            </span>
                          </td>

                          {/* Account Status */}
                          <td className="px-4 py-4">
                            {member.status === 'active' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Active
                              </span>
                            )}
                            {member.status === 'invited' && (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                title="Invited user has not yet signed in or completed first-login 2FA enrollment"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                                Invited (Setup Pending)
                              </span>
                            )}
                            {member.status === 'deactivated' && (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                title="Account is deactivated and all sessions have been revoked"
                              >
                                <UserX className="h-3.5 w-3.5" />
                                Deactivated
                              </span>
                            )}
                          </td>

                          {/* 2FA Status */}
                          <td className="px-4 py-4">
                            {member.hasPending2faReset ? (
                              <div
                                onClick={() => setActiveTab('resets')}
                                className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 hover:bg-amber-100 transition-colors"
                                title="2FA Reset is requested and awaiting administrator approval"
                              >
                                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                <span>Reset Pending Approval</span>
                              </div>
                            ) : member.totpEnrolled ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Enrolled (TOTP)</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
                                title="2FA enrolment will be enforced when user first logs in"
                              >
                                <Shield className="h-3.5 w-3.5 text-orange-500" />
                                <span>Required on 1st Login</span>
                              </span>
                            )}
                          </td>

                          {/* Last Login */}
                          <td className="px-4 py-4">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              {formatDate(member.lastLoginAt)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Created {formatDate(member.createdAt)}
                            </div>
                          </td>

                          {/* Actions Column */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Request 2FA Reset button */}
                              {member.isActive && member.totpEnrolled && (
                                <button
                                  type="button"
                                  onClick={() => setResetModalTarget(member)}
                                  disabled={!canManageTarget || member.hasPending2faReset}
                                  title={
                                    !canManageTarget
                                      ? 'Only a Platform Owner can request 2FA reset for another Platform Owner'
                                      : member.hasPending2faReset
                                      ? 'A 2FA reset request is already pending approval'
                                      : 'Request 2FA Reset (Requires dual-approval)'
                                  }
                                  className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                                  <span>Reset 2FA</span>
                                </button>
                              )}

                              {/* Deactivate / Reactivate button */}
                              {member.isActive ? (
                                <button
                                  type="button"
                                  onClick={() => setDeactivateModalTarget(member)}
                                  disabled={isSelf || !canManageTarget}
                                  title={
                                    isSelf
                                      ? 'You cannot deactivate your own account'
                                      : !canManageTarget
                                      ? 'Only a Platform Owner can deactivate another Platform Owner'
                                      : 'Deactivate user and revoke all active sessions'
                                  }
                                  className="h-8 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleReactivate(member)}
                                  disabled={!canManageTarget}
                                  title={
                                    !canManageTarget
                                      ? 'Only a Platform Owner can reactivate a Platform Owner'
                                      : 'Reactivate this staff user'
                                  }
                                  className="h-8 px-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Reactivate</span>
                                </button>
                              )}
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
        </div>
      )}

      {/* Tab 2: 2FA Reset Approvals (Four-Eyes Queue) */}
      {activeTab === 'resets' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm mb-1">Four-Eyes Dual Control Policy</div>
              <p className="leading-relaxed">
                Platform security strictly requires another administrator to approve 2FA resets. The administrator who
                submitted the reset request is <strong className="underline">prohibited from approving it</strong>. Once approved,
                the staff member's 2FA secret is wiped, all their active sessions are immediately revoked, and they are forced to
                enroll in fresh 2FA upon their next login.
              </p>
            </div>
          </div>

          {/* Pending Requests Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pending Approvals ({pendingResetRequests.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Requests awaiting independent administrator verification and review
                </p>
              </div>
            </div>

            {pendingResetRequests.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-medium text-slate-600 dark:text-slate-300">All clear!</p>
                <p className="text-xs mt-1">There are no pending 2FA reset requests at this time.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingResetRequests.map((req) => {
                  const isRequester = req.requestedBy === currentUser?.id;
                  const isTargetOwner = req.targetUserRole === 'Platform Owner';
                  const canReview = !isRequester && (isPlatformOwner || !isTargetOwner);

                  return (
                    <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {req.targetUserName}
                          </span>
                          <span className="text-xs text-slate-500">({req.targetUserEmail})</span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getRoleBadgeStyle(
                              req.targetUserRole,
                            )}`}
                          >
                            {req.targetUserRole}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                            Stated Reason for Reset:
                          </div>
                          "{req.reason}"
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Requested by: <strong>{req.requesterName}</strong> ({req.requesterEmail})</span>
                          <span>•</span>
                          <span>{formatDate(req.createdAt)}</span>
                        </div>

                        {isRequester && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span>You requested this reset. Four-Eyes policy requires another administrator to approve.</span>
                          </div>
                        )}
                        {!isPlatformOwner && isTargetOwner && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-violet-50 text-violet-800 border border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800">
                            <Shield className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                            <span>Only a Platform Owner can review 2FA resets for another Platform Owner.</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewModalRequest(req);
                            setReviewAction('reject');
                            setReviewReason('');
                          }}
                          disabled={!canReview}
                          className="h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewModalRequest(req);
                            setReviewAction('approve');
                            setReviewReason('');
                          }}
                          disabled={!canReview}
                          className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                          Approve Reset
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historical Reset Requests Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Review Audit History</h3>
              <p className="text-xs text-slate-500">Historical record of all approved and rejected 2FA resets</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Target User</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Reviewer & Notes</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {resetRequests.filter((r) => r.status !== 'pending').length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                        No previous 2FA reset reviews recorded yet.
                      </td>
                    </tr>
                  ) : (
                    resetRequests
                      .filter((r) => r.status !== 'pending')
                      .map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">{req.targetUserName}</div>
                            <div className="text-[11px] text-slate-500">{req.targetUserEmail}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div>{req.requesterName}</div>
                            <div className="text-[11px] text-slate-500">{req.reason}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            {req.status === 'approved' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <Check className="h-3 w-3" /> Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                <XCircle className="h-3 w-3" /> Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div>{req.reviewerName || 'Administrator'}</div>
                            <div className="text-[11px] text-slate-500 italic">{req.reviewReason || 'No notes'}</div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500">
                            {formatDate(req.reviewedAt || req.createdAt)}
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

      {/* Tab 3: Roles & Permissions Matrix */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200">
            <div className="font-bold text-sm mb-1 flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-indigo-600" />
              <span>Platform Role Hierarchy Rules</span>
            </div>
            <p className="leading-relaxed">
              <strong>Platform Owner</strong> is the apex governance role. Only an existing Platform Owner can invite,
              promote, modify, deactivate, or approve 2FA resets for other Platform Owners. The system protects the last
              remaining active Platform Owner from demotion or deactivation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {roles.map((role) => (
              <div
                key={role.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${getRoleBadgeStyle(
                        role.name,
                      )}`}
                    >
                      {role.name === 'Platform Owner' && <Shield className="h-3 w-3" />}
                      {role.name}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {role.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400">
                      {role._count?.users ?? users.filter((u) => u.roleId === role.id).length} users
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Granted Permissions ({role.permissions.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {role.permissions.map((p) => (
                      <span
                        key={`${p.module}-${p.action}`}
                        className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                      >
                        {p.module}:{p.action}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Invite Staff Modal */}
      {/* ========================================================================= */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            {inviteResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Staff Invitation Sent</h3>
                    <p className="text-xs text-slate-500">First-login 2FA enrollment is mandatory</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Invited Staff Email</label>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{inviteResult.email}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Assigned Role</label>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{inviteResult.roleName}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Temporary Password</label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs font-mono font-bold bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 select-all">
                        {inviteResult.temporaryPassword}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          if (inviteResult.temporaryPassword) {
                            navigator.clipboard.writeText(inviteResult.temporaryPassword);
                            setNotice('Temporary password copied to clipboard');
                          }
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Copy to clipboard"
                      >
                        <Copy className="h-4 w-4 text-slate-500" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    When this user signs in for the first time, the platform will automatically present an authenticator QR code.
                    Access is denied until they successfully verify their 6-digit TOTP code.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeInviteModal}
                    className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Invite Platform Staff</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Internal control plane operator with mandatory 2FA enrollment on first login
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeInviteModal}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">First Name *</label>
                    <input
                      type="text"
                      required
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      placeholder="Jane"
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      placeholder="Doe"
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Staff Work Email *</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="jane.doe@cmsnbd.com"
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Assigned Platform Role *</label>
                  <select
                    value={inviteRoleId}
                    onChange={(e) => setInviteRoleId(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    {roles.map((r) => {
                      const isOwnerRole = r.name === 'Platform Owner';
                      const disabled = isOwnerRole && !isPlatformOwner;
                      return (
                        <option key={r.id} value={r.id} disabled={disabled}>
                          {r.name} {disabled ? '(Requires Platform Owner)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {!isPlatformOwner && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Note: Only a Platform Owner can invite or assign the Platform Owner role.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Temporary Password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={inviteTempPassword}
                      onChange={(e) => setInviteTempPassword(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setInviteTempPassword(`TempPass${Math.floor(1000 + Math.random() * 9000)}!`)}
                      className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-100"
                    >
                      Random
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Mandatory First-Login 2FA:</strong> New staff users do not have a pre-enrolled secret. On their first
                    sign-in with this temporary password, the platform prompts them to scan an authenticator QR code and verify
                    their TOTP before access is granted.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={closeInviteModal}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteSubmitting}
                    className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2 shadow-sm"
                  >
                    {inviteSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    <span>Send Invitation</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Request 2FA Reset Modal */}
      {/* ========================================================================= */}
      {resetModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Request 2FA Reset</h3>
                  <p className="text-xs text-slate-500">Initiate dual-control credential recovery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Target Staff: </span>
                <span className="text-slate-900 dark:text-white font-semibold">
                  {resetModalTarget.firstName} {resetModalTarget.lastName}
                </span>
                <span className="text-slate-500"> ({resetModalTarget.email})</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Role: </span>
                <span className="text-slate-900 dark:text-white">{resetModalTarget.roleName}</span>
              </div>
            </div>

            <form onSubmit={handleRequest2faReset} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Detailed Reason for 2FA Reset *
                </label>
                <textarea
                  required
                  rows={3}
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="e.g. Staff replaced phone and lost access to Microsoft/Google Authenticator app. Verified via direct phone call."
                  className="mt-1 w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>Four-Eyes Dual Control Enforced</span>
                </div>
                <p className="leading-relaxed">
                  Submitting this request will place it in the approval queue. <strong>You cannot approve your own request.</strong>{' '}
                  Another administrator must review and approve it.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetModalTarget(null)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting || resetReason.trim().length < 5}
                  className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2 shadow-sm"
                >
                  {resetSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Submit Request for Approval</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Deactivate Confirmation Modal */}
      {/* ========================================================================= */}
      {deactivateModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3 text-rose-600">
              <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Deactivate Staff Account?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {deactivateModalTarget.firstName} {deactivateModalTarget.lastName} ({deactivateModalTarget.email})
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                <span>Immediate Session Revocation:</span>
              </div>
              <p className="leading-relaxed">
                Deactivating this staff operator will <strong>immediately revoke all active sessions and refresh tokens</strong>.
                Any requests in progress with their existing JWT will be rejected immediately by the platform auth guard.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeactivateModalTarget(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivateSubmitting}
                className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2 shadow-sm"
              >
                {deactivateSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Deactivation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Review 2FA Reset Modal (Approve / Reject) */}
      {/* ========================================================================= */}
      {reviewModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    reviewAction === 'approve'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600'
                  }`}
                >
                  {reviewAction === 'approve' ? <Check className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {reviewAction === 'approve' ? 'Approve 2FA Reset' : 'Reject 2FA Reset'}
                  </h3>
                  <p className="text-xs text-slate-500">Four-Eyes Dual Control Verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Target Staff: </span>
                <span className="font-semibold text-slate-900 dark:text-white">{reviewModalRequest.targetUserName}</span>
                <span className="text-slate-500"> ({reviewModalRequest.targetUserEmail})</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Requested By: </span>
                <span>{reviewModalRequest.requesterName} ({reviewModalRequest.requesterEmail})</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Stated Reason: </span>
                <span className="italic">"{reviewModalRequest.reason}"</span>
              </div>
            </div>

            <form onSubmit={handleReview2faReset} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Reviewer Notes / Verification Details
                </label>
                <textarea
                  rows={2}
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'e.g. Identity verified via video call and corporate directory match.'
                      : 'e.g. Could not confirm staff identity.'
                  }
                  className="mt-1 w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {reviewAction === 'approve' ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Consequences of Approval:</span>
                  </div>
                  <p className="leading-relaxed">
                    1. Target user's current 2FA secret will be wiped.<br />
                    2. All active sessions will be terminated immediately.<br />
                    3. On next login, they will be required to scan a new QR code and enroll in 2FA.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    <span>Consequences of Rejection:</span>
                  </div>
                  <p className="leading-relaxed">
                    The request will be marked as rejected. No changes will be made to the user's 2FA secret or active sessions.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewModalRequest(null)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className={`h-10 px-5 rounded-xl text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2 shadow-sm transition-all ${
                    reviewAction === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {reviewSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{reviewAction === 'approve' ? 'Confirm 2FA Reset Approval' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
