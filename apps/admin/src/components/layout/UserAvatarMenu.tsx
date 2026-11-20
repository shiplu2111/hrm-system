import { Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useAppTranslation } from '@hrm/i18n';
import { useAuth, usePermissions } from '@hrm/portal-ui';
import { Avatar } from '@/components/ui/Toggle';
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from '@/components/ui/Dropdown';
import { useNav } from '@/context/NavContext';
import { usePageAccess } from '@/hooks/usePageAccess';

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function UserAvatarMenu({
  onLogout,
  compact = false,
}: {
  onLogout: () => void;
  compact?: boolean;
}) {
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const { navigate } = useNav();
  const { can } = usePermissions();
  const { canView, selfServiceOnly } = usePageAccess();

  const displayName = user?.email ? displayNameFromEmail(user.email) : 'User';
  const roleLabel = user?.roleName || (selfServiceOnly ? 'Employee' : 'Admin');

  const profilePage =
    !selfServiceOnly && can('settings', 'view')
      ? ('settings-general' as const)
      : canView('my-profile')
        ? ('my-profile' as const)
        : null;

  return (
    <Dropdown
      width="w-56"
      trigger={
        <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer min-h-[36px]">
          <Avatar name={displayName} size="sm" />
          {!compact && (
            <div className="hidden sm:flex flex-col leading-tight text-left min-w-0">
              <span className="text-sm font-medium text-primary truncate max-w-[140px]">
                {displayName}
              </span>
              <span className="text-[10px] text-muted truncate max-w-[140px]">
                {roleLabel}
              </span>
            </div>
          )}
          <ChevronDown className="h-4 w-4 text-muted hidden sm:block shrink-0" />
        </div>
      }
    >
      <DropdownHeader>
        <div className="flex items-center gap-2.5">
          <Avatar name={displayName} size="md" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary truncate">
              {displayName}
            </div>
            <div className="text-xs text-muted truncate">{user?.email}</div>
          </div>
        </div>
      </DropdownHeader>
      <DropdownDivider />
      {profilePage && (
        <DropdownItem
          icon={<User className="h-4 w-4" />}
          onClick={() => navigate(profilePage)}
        >
          {t('shell.profile')}
        </DropdownItem>
      )}
      {canView('my-notifications') && (
        <DropdownItem
          icon={<Bell className="h-4 w-4" />}
          onClick={() => navigate('my-notifications')}
        >
          {t('shell.notifications')}
        </DropdownItem>
      )}
      <DropdownDivider />
      <DropdownItem icon={<LogOut className="h-4 w-4" />} onClick={onLogout}>
        {t('shell.logout')}
      </DropdownItem>
    </Dropdown>
  );
}

