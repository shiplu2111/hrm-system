import {
  ArrowLeft,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  Briefcase,
  Download,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useNav } from '@/context/NavContext';
import { contracts } from '@/data/mockData';

function DetailRow({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof FileText }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {Icon && <div className="h-8 w-8 rounded-lg bg-[rgb(var(--bg-muted))] flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-muted" /></div>}
      <div className="flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="text-sm text-primary font-medium">{value}</div>
      </div>
    </div>
  );
}

export function ContractDetailPage() {
  const { navigate } = useNav();
  const contract = contracts[0]; // Sarah Chen — Permanent

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <button onClick={() => navigate('emp-contracts')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Contracts
      </button>

      {/* Header */}
      <Card>
        <CardBody className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
            <FileText className="h-6 w-6 text-accent-600 dark:text-accent-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold text-primary">{contract.employeeName}</h1>
              <Badge tone="accent">{contract.type}</Badge>
              <Badge tone="success" dot>{contract.status}</Badge>
            </div>
            <div className="text-sm text-secondary mt-0.5">{contract.employeeId} · Contract #{contract.id.toUpperCase()}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md"><Download className="h-4 w-4" /> Download</Button>
            <Button variant="primary" size="md"><Pencil className="h-4 w-4" /> Edit Contract</Button>
          </div>
        </CardBody>
      </Card>

      {contract.status === 'Expiring Soon' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800/60">
          <AlertTriangle className="h-5 w-5 text-warning-600 dark:text-warning-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-warning-800 dark:text-warning-300">This contract is expiring soon</div>
            <div className="text-xs text-warning-700 dark:text-warning-400 mt-0.5">End date: {contract.endDate} — Initiate renewal process before expiry.</div>
          </div>
          <Button variant="primary" size="sm">Renew Contract</Button>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Contract Terms</CardTitle></CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            <DetailRow label="Contract Type" value={contract.type} icon={Briefcase} />
            <DetailRow label="Start Date" value={contract.startDate} icon={Calendar} />
            <DetailRow label="End Date" value={contract.endDate} icon={Calendar} />
            <DetailRow label="Pay Rate" value={contract.payRate} icon={DollarSign} />
            <DetailRow label="Pay Frequency" value={contract.payFrequency} icon={Clock} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Terms & Conditions</CardTitle></CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            <DetailRow label="Probation Period" value="3 months" icon={Clock} />
            <DetailRow label="Working Hours" value="40 hrs/week" icon={Clock} />
            <DetailRow label="Leave Entitlement" value="25 days/year" icon={Calendar} />
            <DetailRow label="Overtime Rule" value="1.5x after 40 hrs" icon={Clock} />
            <DetailRow label="Notice Period" value="60 days" icon={FileText} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Termination</CardTitle></CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            <DetailRow label="Employer Notice" value="60 days" icon={FileText} />
            <DetailRow label="Employee Notice" value="60 days" icon={FileText} />
            <DetailRow label="Severance" value="1 month per year of service" icon={DollarSign} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Attached Documents</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {[
              { name: 'Signed_Contract_2019.pdf', size: '1.2 MB', date: '2019-03-15' },
              { name: 'Appendix_A_Compensation.pdf', size: '340 KB', date: '2019-03-15' },
              { name: 'NDA_Agreement.pdf', size: '890 KB', date: '2019-03-16' },
            ].map((doc) => (
              <div key={doc.name} className="flex items-center gap-3 p-3 rounded-lg bg-[rgb(var(--bg-muted))] hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer">
                <FileText className="h-5 w-5 text-accent-600 dark:text-accent-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary truncate">{doc.name}</div>
                  <div className="text-xs text-muted">{doc.size} · {doc.date}</div>
                </div>
                <Download className="h-4 w-4 text-muted" />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
