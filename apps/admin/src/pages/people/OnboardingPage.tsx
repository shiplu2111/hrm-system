import { FileText, Shield, Monitor, KeyRound } from 'lucide-react';
import { ChecklistBoard } from '@/components/people/ChecklistBoard';

export function OnboardingPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Onboarding Checklist</h1>
        <p className="text-sm text-secondary mt-0.5">James Park — Software Engineer II · Started Aug 1, 2024</p>
      </div>
      <ChecklistBoard
        config={{
          title: 'Onboarding Progress',
          subtitle: 'Complete all tasks to finish the onboarding process',
          items: [
            { id: 'on1', title: 'Collect Signed Offer Letter', description: 'Receive signed employment contract', category: 'Document Collection', assignee: 'Sofia Martinez', dueDate: 'Aug 2', completed: true, icon: FileText },
            { id: 'on2', title: 'ID & Tax Forms', description: 'Collect national ID, tax declaration (W-4)', category: 'Document Collection', assignee: 'Sofia Martinez', dueDate: 'Aug 3', completed: true, icon: FileText },
            { id: 'on3', title: 'Bank Account Details', description: 'Collect bank info for payroll setup', category: 'Document Collection', assignee: 'Sofia Martinez', dueDate: 'Aug 5', completed: false, icon: FileText },
            { id: 'on4', title: 'Employee Handbook Acknowledgment', description: 'Read and sign employee handbook', category: 'Policy Acceptance', assignee: 'Alex Morgan', dueDate: 'Aug 5', completed: true, icon: Shield },
            { id: 'on5', title: 'Code of Conduct Agreement', description: 'Sign code of conduct and NDA', category: 'Policy Acceptance', assignee: 'Alex Morgan', dueDate: 'Aug 5', completed: false, icon: Shield },
            { id: 'on6', title: 'IT Equipment Setup', description: 'Provision laptop, monitor, and accessories', category: 'Equipment Provisioning', assignee: 'IT Team', dueDate: 'Aug 6', completed: true, icon: Monitor },
            { id: 'on7', title: 'Phone & SIM Provisioning', description: 'Assign work phone number', category: 'Equipment Provisioning', assignee: 'IT Team', dueDate: 'Aug 7', completed: false, icon: Monitor },
            { id: 'on8', title: 'Email & Slack Access', description: 'Create email account and Slack workspace access', category: 'System Access', assignee: 'IT Team', dueDate: 'Aug 1', completed: true, icon: KeyRound },
            { id: 'on9', title: 'GitHub & Jira Access', description: 'Grant repository and project board access', category: 'System Access', assignee: 'IT Team', dueDate: 'Aug 2', completed: false, icon: KeyRound },
            { id: 'on10', title: 'HRIS & Payroll System', description: 'Create employee profile in HRMS', category: 'System Access', assignee: 'Sofia Martinez', dueDate: 'Aug 1', completed: true, icon: KeyRound },
          ],
        }}
      />
    </div>
  );
}
