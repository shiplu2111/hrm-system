import { Building2, Plus, UserPlus, Users } from 'lucide-react';
import { PermissionGate, usePermission } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNav } from '@/context/NavContext';

function OnboardingActions() {
  const { navigate } = useNav();
  const canCreateEmployee = usePermission('employee', 'create');

  return (
    <EmptyState
      icon={Users}
      title="No employees yet"
      description="Add your first employee to start tracking attendance, leave, payroll, and dashboard metrics for your company."
      action={{
        label: canCreateEmployee ? 'Add your first employee' : 'Go to Employee Directory',
        onClick: () => navigate('emp-directory'),
        icon: canCreateEmployee ? Plus : UserPlus,
      }}
    />
  );
}

export function DashboardOnboardingEmpty() {
  const { navigate } = useNav();

  return (
    <Card>
      <CardBody className="p-0">
        <OnboardingActions />

        <div className="border-t border-base px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
          <span className="text-muted">Other setup steps:</span>
          <PermissionGate module="settings" action="view">
            <button
              type="button"
              onClick={() => navigate('org-departments')}
              className="inline-flex items-center gap-1.5 text-accent-700 dark:text-accent-300 font-medium hover:underline"
            >
              <Building2 className="h-4 w-4" />
              Set up departments
            </button>
          </PermissionGate>
        </div>
      </CardBody>
    </Card>
  );
}
