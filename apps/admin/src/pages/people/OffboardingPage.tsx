import { FileText, Shield, Monitor, KeyRound, Package, Users } from 'lucide-react';
import { ChecklistBoard } from '@/components/people/ChecklistBoard';

export function OffboardingPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Offboarding Checklist</h1>
        <p className="text-sm text-secondary mt-0.5">Robert Lee — Senior Software Engineer · Last day: Sep 15, 2024</p>
      </div>
      <ChecklistBoard
        config={{
          title: 'Offboarding Progress',
          subtitle: 'Complete all clearance tasks before employee departure',
          items: [
            { id: 'off1', title: 'Exit Interview Scheduled', description: 'Schedule and conduct exit interview', category: 'Exit Process', assignee: 'Sofia Martinez', dueDate: 'Sep 10', completed: true, icon: Users },
            { id: 'off2', title: 'Exit Interview Completed', description: 'Record exit interview feedback', category: 'Exit Process', assignee: 'Sofia Martinez', dueDate: 'Sep 12', completed: false, icon: Users },
            { id: 'off3', title: 'Knowledge Transfer Plan', description: 'Document handover plan for team', category: 'Exit Process', assignee: 'Sarah Chen', dueDate: 'Sep 8', completed: true, icon: FileText },
            { id: 'off4', title: 'Laptop Return', description: 'Collect company laptop and charger', category: 'Asset Return', assignee: 'IT Team', dueDate: 'Sep 15', completed: false, icon: Package },
            { id: 'off5', title: 'Phone & Accessories', description: 'Return work phone, monitor, keyboard', category: 'Asset Return', assignee: 'IT Team', dueDate: 'Sep 15', completed: false, icon: Package },
            { id: 'off6', title: 'ID Card & Access Badge', description: 'Collect physical access badge', category: 'Asset Return', assignee: 'Facilities', dueDate: 'Sep 15', completed: false, icon: Package },
            { id: 'off7', title: 'Email Account Deactivation', description: 'Disable email and set auto-forward', category: 'Access Revocation', assignee: 'IT Team', dueDate: 'Sep 16', completed: false, icon: KeyRound },
            { id: 'off8', title: 'GitHub & Jira Access Removal', description: 'Revoke all repository and tool access', category: 'Access Revocation', assignee: 'IT Team', dueDate: 'Sep 16', completed: false, icon: KeyRound },
            { id: 'off9', title: 'VPN & Network Access', description: 'Revoke VPN credentials and network access', category: 'Access Revocation', assignee: 'IT Team', dueDate: 'Sep 16', completed: false, icon: KeyRound },
            { id: 'off10', title: 'Full & Final Settlement', description: 'Calculate and process final settlement', category: 'Final Settlement', assignee: 'Alex Morgan', dueDate: 'Sep 20', completed: false, icon: FileText },
            { id: 'off11', title: 'Experience Letter', description: 'Generate and issue experience certificate', category: 'Final Settlement', assignee: 'Alex Morgan', dueDate: 'Sep 18', completed: false, icon: FileText },
            { id: 'off12', title: 'Clearance Certificate', description: 'Obtain signed clearance from all departments', category: 'Final Settlement', assignee: 'Sofia Martinez', dueDate: 'Sep 17', completed: false, icon: Shield },
          ],
        }}
      />
    </div>
  );
}
