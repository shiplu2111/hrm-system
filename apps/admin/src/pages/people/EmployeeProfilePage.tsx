import { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Building2,
  UserCog,
  Banknote,
  FileText,
  History,
  Check,
  Clock,
  X,
  AlertCircle,
  Upload,
  Shield,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';
import { Input, Label, Select } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { employees, lifecycleStages, empDocuments } from '@/data/mockData';

type Tab = 'overview' | 'employment' | 'bank-tax' | 'documents' | 'history';

const tabs: { key: Tab; label: string; icon: typeof Briefcase }[] = [
  { key: 'overview', label: 'Overview', icon: UserCog },
  { key: 'employment', label: 'Employment', icon: Briefcase },
  { key: 'bank-tax', label: 'Bank & Tax', icon: Banknote },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'history', label: 'History', icon: History },
];

function LifecycleStepper({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {lifecycleStages.map((stage, i) => {
        const completed = i < currentStage;
        const current = i === currentStage;
        const isLast = i === lifecycleStages.length - 1;
        return (
          <div key={stage} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  completed
                    ? 'bg-success-500 text-white'
                    : current
                    ? 'bg-accent-600 text-white ring-4 ring-accent-500/20'
                    : 'bg-[rgb(var(--bg-muted))] text-muted border border-base'
                }`}
              >
                {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block ${
                  completed ? 'text-success-600' : current ? 'text-accent-600' : 'text-muted'
                }`}
              >
                {stage}
              </span>
            </div>
            {!isLast && (
              <div className={`h-px w-6 sm:w-8 ${completed ? 'bg-success-500' : 'bg-[rgb(var(--border-base))]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-primary">{value}</span>
    </div>
  );
}

export function EmployeeProfilePage() {
  const { navigate } = useNav();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const emp = employees[0]; // Sarah Chen

  const docStatusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    Verified: 'success',
    Pending: 'warning',
    Rejected: 'error',
    'Expiring Soon': 'error',
  };

  const historyEvents = [
    { id: 1, event: 'Salary Revision', detail: 'Salary increased from $165,000 to $180,000', date: '2024-01-15', user: 'Alex Morgan', icon: Banknote, tone: 'accent' as const },
    { id: 2, event: 'Promotion', detail: 'Promoted from Senior Engineering Manager to VP Engineering', date: '2023-06-01', user: 'John Smith', icon: ArrowLeft, tone: 'success' as const },
    { id: 3, event: 'Department Transfer', detail: 'Transferred from Backend to Engineering (Leadership)', date: '2023-06-01', user: 'Alex Morgan', icon: Building2, tone: 'accent' as const },
    { id: 4, event: 'Confirmation', detail: 'Probation completed — confirmed as permanent employee', date: '2019-09-15', user: 'System', icon: Check, tone: 'success' as const },
    { id: 5, event: 'Onboarding Completed', detail: 'All onboarding tasks completed', date: '2019-03-20', user: 'HR Team', icon: Check, tone: 'success' as const },
    { id: 6, event: 'Hired', detail: 'Employment started — Software Engineer V', date: '2019-03-15', user: 'System', icon: Briefcase, tone: 'accent' as const },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Back */}
      <button onClick={() => navigate('emp-directory')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Directory
      </button>

      {/* Profile header */}
      <Card>
        <CardBody className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          <Avatar name={emp.name} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-primary">{emp.name}</h1>
              <Badge tone="success" dot>{emp.status}</Badge>
              <Badge tone="neutral">{emp.employeeId}</Badge>
            </div>
            <div className="mt-1 text-sm text-secondary">{emp.designation} · {emp.department}</div>
            <div className="mt-2 flex items-center gap-4 flex-wrap text-xs text-muted">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {emp.email}</span>
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {emp.phone}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Hired {emp.hireDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={() => navigate('emp-lifecycle')}>Lifecycle Actions</Button>
            <Button variant="primary" size="md">Edit Profile</Button>
          </div>
        </CardBody>
      </Card>

      {/* Lifecycle stepper */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-primary">Employee Lifecycle</span>
            <Badge tone="accent">Stage {emp.lifecycleStage + 1}: {lifecycleStages[emp.lifecycleStage]}</Badge>
          </div>
          <LifecycleStepper currentStage={emp.lifecycleStage} />
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-base overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-accent-600 text-accent-600'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-2 gap-4">
              <InfoRow label="Full Name" value={emp.name} />
              <InfoRow label="Employee ID" value={emp.employeeId} />
              <InfoRow label="Date of Birth" value="1988-05-12" />
              <InfoRow label="Gender" value="Female" />
              <InfoRow label="Nationality" value="American" />
              <InfoRow label="Marital Status" value="Married" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-2 gap-4">
              <InfoRow label="Email" value={emp.email} />
              <InfoRow label="Phone" value={emp.phone} />
              <div className="col-span-2">
                <InfoRow label="Address" value="1234 Market St, San Francisco, CA 94103" />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-2 gap-4">
              <InfoRow label="Name" value="David Chen" />
              <InfoRow label="Relationship" value="Spouse" />
              <InfoRow label="Phone" value="+1 415 555 0199" />
              <InfoRow label="Email" value="david.chen@email.com" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Family / Dependents</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
                <div>
                  <div className="text-sm font-medium text-primary">Emma Chen</div>
                  <div className="text-xs text-muted">Daughter · Age 8</div>
                </div>
                <Badge tone="neutral">Dependent</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
                <div>
                  <div className="text-sm font-medium text-primary">Lucas Chen</div>
                  <div className="text-xs text-muted">Son · Age 5</div>
                </div>
                <Badge tone="neutral">Dependent</Badge>
              </div>
              <Button variant="ghost" size="sm" className="w-full">+ Add Dependent</Button>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'employment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-2 gap-4">
              <InfoRow label="Job Title" value={emp.designation} />
              <InfoRow label="Department" value={emp.department} />
              <InfoRow label="Employment Type" value={emp.employmentType} />
              <InfoRow label="Cost Centre" value={emp.costCentre} />
              <InfoRow label="Manager" value={emp.manager} />
              <InfoRow label="Work Location" value="San Francisco HQ" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Hire & Probation</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-2 gap-4">
              <InfoRow label="Hire Date" value={emp.hireDate} />
              <InfoRow label="Probation End" value="2019-09-15" />
              <InfoRow label="Confirmation Date" value="2019-09-15" />
              <InfoRow label="Tenure" value="5 years 5 months" />
              <InfoRow label="Notice Period" value="60 days" />
              <InfoRow label="Shift Pattern" value="Mon-Fri, 9AM-5PM" />
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'bank-tax' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Bank Account</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-2 gap-4">
              <InfoRow label="Bank Name" value="First National Bank" />
              <InfoRow label="Account Holder" value={emp.name} />
              <InfoRow label="Account Number" value="**** **** 4521" />
              <InfoRow label="Routing Number" value="**** 8890" />
              <InfoRow label="Account Type" value="Checking" />
              <InfoRow label="Currency" value="USD" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tax Information</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-2 gap-4">
              <InfoRow label="Tax ID / SSN" value="***-**-4521" />
              <InfoRow label="Tax Filing Status" value="Married Filing Jointly" />
              <InfoRow label="Federal Allowances" value="3" />
              <InfoRow label="State Tax" value="CA — 5%" />
              <InfoRow label="Tax Exemptions" value="None" />
              <InfoRow label="W-4 Filed" value="2024-01-10" />
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {empDocuments.map((doc) => (
            <Card key={doc.id} className="hover:shadow-card-hover transition-shadow group">
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-accent-600 dark:text-accent-400" />
                  </div>
                  <Badge tone={docStatusTone[doc.status]} dot>{doc.status}</Badge>
                </div>
                <div className="mt-3 text-sm font-medium text-primary truncate">{doc.name}</div>
                <div className="text-xs text-muted mt-0.5">{doc.type}</div>
                <div className="mt-3 pt-3 border-t border-base space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Uploaded</span>
                    <span className="text-secondary">{doc.uploadedDate}</span>
                  </div>
                  {doc.expiryDate && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Expires</span>
                      <span className={doc.status === 'Expiring Soon' ? 'text-error-600 font-medium' : 'text-secondary'}>{doc.expiryDate}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Size</span>
                    <span className="text-secondary">{doc.size}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">View</Button>
                  <Button variant="ghost" size="sm" className="flex-1">Download</Button>
                </div>
              </CardBody>
            </Card>
          ))}
          <button className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-strong rounded-xl p-5 text-secondary hover:border-accent-500 hover:text-accent-600 transition-colors min-h-[200px]">
            <Upload className="h-6 w-6" />
            <span className="text-sm font-medium">Upload Document</span>
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader><CardTitle>Audit Timeline</CardTitle></CardHeader>
          <CardBody className="p-0">
            <div className="relative px-5 py-4">
              {historyEvents.map((evt, i) => {
                const Icon = evt.icon;
                const isLast = i === historyEvents.length - 1;
                return (
                  <div key={evt.id} className="flex gap-3 pb-6 relative">
                    {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-[rgb(var(--border-base))]" />}
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      evt.tone === 'success' ? 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300' :
                      'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-primary">{evt.event}</span>
                        <span className="text-xs text-muted shrink-0">{evt.date}</span>
                      </div>
                      <p className="text-xs text-secondary mt-0.5">{evt.detail}</p>
                      <span className="text-[11px] text-muted mt-1 block">by {evt.user}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
