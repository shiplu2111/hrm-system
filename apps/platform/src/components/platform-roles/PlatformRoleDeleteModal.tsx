import { useState } from 'react';
import { AlertCircle, RefreshCw, Trash2, X } from 'lucide-react';
import type { PlatformRoleRecord } from '@hrm/shared-types';
import { deletePlatformRole } from '@/lib/platform-staff-api';

interface Props {
  role: PlatformRoleRecord | null;
  onClose: () => void;
  onDeleted: (roleId: string) => void;
}

export function PlatformRoleDeleteModal({ role, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!role) return null;

  const canDelete = !role.isSystem && role.userCount === 0;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deletePlatformRole(role.id);
      onDeleted(role.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete platform role');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 text-rose-600">
            <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Custom Role</h3>
              <p className="text-xs text-slate-500 mt-0.5">{role.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-xs text-rose-800 dark:text-rose-200">
            {error}
          </div>
        )}

        {!canDelete ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Role Cannot Be Deleted</span>
            </div>
            {role.isSystem && (
              <p>System platform roles are permanent fixtures of platform governance and cannot be removed.</p>
            )}
            {role.userCount > 0 && (
              <p>
                This role is currently assigned to <strong>{role.userCount} staff member(s)</strong>. You must reassign
                them to another role before deleting.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete the custom role <strong>'{role.name}'</strong>? All associated permission grants
            will be permanently removed.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2 shadow-sm transition-all"
          >
            {deleting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            <span>Confirm Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
