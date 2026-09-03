import { useMemo, useState } from 'react';
import {
  Check,
  CreditCard,
  Headphones,
  Mail,
  Plus,
  Search,
  Shield,
  UserCog,
  UserPlus,
  Zap,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Toggle, Avatar } from '@/components/ui/Toggle';

type PlatformRole = 'Super Admin' | 'Support Agent' | 'Billing Ops';

interface PlatformStaff {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  permissions: string[];
  lastActive: string;
  status: 'Active' | 'Invited';
}

const rolePermissions: Record<PlatformRole, string[]> = {
  'Super Admin': ['Tenants', 'Billing', 'Support', 'Health', 'Feature Flags', 'Audit'],
  'Support Agent': ['Support tickets', 'Impersonate', 'Health read', 'Tenant lookup'],
  'Billing Ops': ['Invoices', 'Plans', 'Failed payments', 'Usage metering'],
};

const initialStaff: PlatformStaff[] = [
  { id: 'u1', name: 'Alex Morgan', email: 'alex.morgan@nexushr.com', role: 'Super Admin', permissions: rolePermissions['Super Admin'], lastActive: 'Just now', status: 'Active' },
  { id: 'u2', name: 'Priya Shah', email: 'priya.shah@nexushr.com', role: 'Super Admin', permissions: rolePermissions['Super Admin'], lastActive: '12 minutes ago', status: 'Active' },
  { id: 'u3', name: 'Jordan Hale', email: 'jordan.hale@nexushr.com', role: 'Support Agent', permissions: rolePermissions['Support Agent'], lastActive: '28 minutes ago', status: 'Active' },
  { id: 'u4', name: 'Mei Chen', email: 'mei.chen@nexushr.com', role: 'Support Agent', permissions: rolePermissions['Support Agent'], lastActive: '1 hour ago', status: 'Active' },
  { id: 'u5', name: 'Diego Alvarez', email: 'diego.alvarez@nexushr.com', role: 'Support Agent', permissions: rolePermissions['Support Agent'], lastActive: 'Yesterday', status: 'Active' },
  { id: 'u6', name: 'Hannah Cole', email: 'hannah.cole@nexushr.com', role: 'Billing Ops', permissions: rolePermissions['Billing Ops'], lastActive: '3 hours ago', status: 'Active' },
  { id: 'u7', name: 'Omar Rahman', email: 'omar.rahman@nexushr.com', role: 'Billing Ops', permissions: rolePermissions['Billing Ops'], lastActive: 'Aug 24, 2026', status: 'Active' },
  { id: 'u8', name: 'Sofia Rossi', email: 'sofia.rossi@nexushr.com', role: 'Support Agent', permissions: rolePermissions['Support Agent'], lastActive: 'Invite pending', status: 'Invited' },
];

function roleTone(role: PlatformRole) {
  if (role === 'Super Admin') {
    return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800';
  }
  if (role === 'Support Agent') {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  }
  return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
}

function permissionTone(permission: string) {
  if (['Tenants', 'Billing', 'Invoices', 'Plans'].includes(permission)) {
    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
  if (['Support', 'Support tickets', 'Impersonate'].includes(permission)) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
  }
  return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
}

export function PlatformUsersPage() {
  const [staff, setStaff] = useState<PlatformStaff[]>(initialStaff);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | PlatformRole>('All');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<PlatformRole>('Support Agent');
  const [sendEmail, setSendEmail] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      staff.filter((member) => {
        const haystack = `${member.name} ${member.email} ${member.role}`.toLowerCase();
        const matchesSearch = haystack.includes(search.toLowerCase());
        const matchesRole = roleFilter === 'All' || member.role === roleFilter;
        return matchesSearch && matchesRole;
      }),
    [staff, search, roleFilter],
  );

  const counts = {
    total: staff.length,
    super: staff.filter((member) => member.role === 'Super Admin').length,
    support: staff.filter((member) => member.role === 'Support Agent').length,
    billing: staff.filter((member) => member.role === 'Billing Ops').length,
  };

  const resetInvite = () => {
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Support Agent');
    setSendEmail(true);
  };

  const submitInvite = () => {
    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    if (!name || !email || !email.includes('@')) return;

    const member: PlatformStaff = {
      id: `u-${Date.now()}`,
      name,
      email,
      role: inviteRole,
      permissions: rolePermissions[inviteRole],
      lastActive: sendEmail ? 'Invite pending' : 'Never signed in',
      status: 'Invited',
    };

    setStaff((previous) => [member, ...previous]);
    setNotice(
      sendEmail
        ? `Invitation sent to ${email} as ${inviteRole}.`
        : `${name} added as ${inviteRole}. Share the temporary access link manually.`,
    );
    resetInvite();
    setInviteOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300 font-bold mb-2">
            <Zap className="h-3.5 w-3.5" /> PLATFORM CONTROL PLANE
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold">Platform Users</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Internal Nexus HR operators — not tenant employees or company admins.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/15"
        >
          <Plus className="h-4 w-4" /> Invite New Staff
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Internal operators', value: String(counts.total), icon: UserCog, tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300' },
          { label: 'Super Admins', value: String(counts.super), icon: Shield, tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300' },
          { label: 'Support Agents', value: String(counts.support), icon: Headphones, tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300' },
          { label: 'Billing Ops', value: String(counts.billing), icon: CreditCard, tone: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tone}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-2xl font-extrabold mt-3">{value}</div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {notice && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200">
          <Check className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{notice}</p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or role..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as 'All' | PlatformRole)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:border-indigo-400"
          >
            <option value="All">All roles</option>
            <option value="Super Admin">Super Admin</option>
            <option value="Support Agent">Support Agent</option>
            <option value="Billing Ops">Billing Ops</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          {filtered.length} platform staff {roleFilter !== 'All' ? `· ${roleFilter}` : ''}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[920px]">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((member) => (
                <tr key={member.id} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="md" />
                      <div>
                        <div className="text-sm font-bold">{member.name}</div>
                        <div className="text-[11px] text-slate-500">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${roleTone(member.role)}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {member.permissions.map((permission) => (
                        <span key={permission} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${permissionTone(permission)}`}>
                          {permission}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs font-medium">{member.lastActive}</div>
                    <div className={`text-[11px] mt-0.5 ${member.status === 'Invited' ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {member.status}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite New Staff"
        description="Add an internal operator. This does not create a tenant user."
        footer={
          <>
            <button onClick={() => setInviteOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold">
              Cancel
            </button>
            <button
              onClick={submitInvite}
              disabled={!inviteName.trim() || !inviteEmail.includes('@')}
              className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" /> Send invite
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold">Full name</label>
            <input
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder="Operator full name"
              className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold">Work email</label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@nexushr.com"
                className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold">Role</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
              {(['Super Admin', 'Support Agent', 'Billing Ops'] as PlatformRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setInviteRole(role)}
                  className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                    inviteRole === role
                      ? 'border-indigo-500 ring-2 ring-indigo-500/15 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {rolePermissions[inviteRole].map((permission) => (
                <span key={permission} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${permissionTone(permission)}`}>
                  {permission}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50">
            <Toggle checked={sendEmail} onChange={setSendEmail} />
            <div>
              <div className="text-sm font-bold">Send secure invitation email</div>
              <div className="text-xs text-slate-500 mt-1">
                {sendEmail
                  ? 'The operator will set a password from a time-limited link.'
                  : 'Skip email and generate a manual onboarding link for the ops team.'}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
