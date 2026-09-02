import { useState } from 'react';
import { Upload, FileText, Check, Clock, AlertTriangle, Download, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Form';
import { empDocuments, type EmpDocument } from '@/data/mockData';

const statusTone: Record<EmpDocument['status'], 'success' | 'warning' | 'error'> = {
  Verified: 'success',
  Pending: 'warning',
  Rejected: 'error',
  'Expiring Soon': 'error',
};

export function EmployeeDocumentsPage() {
  const [search, setSearch] = useState('');
  const filtered = empDocuments.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.type.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employee Documents</h1>
          <p className="text-sm text-secondary mt-0.5">Sarah Chen — All uploaded documents with expiry tracking</p>
        </div>
        <Button variant="primary"><Upload className="h-4 w-4" /> Upload Document</Button>
      </div>

      <div className="relative w-64 max-w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((doc) => (
          <Card key={doc.id} className="hover:shadow-card-hover transition-shadow group">
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-accent-600 dark:text-accent-400" />
                </div>
                <Badge tone={statusTone[doc.status]} dot>{doc.status}</Badge>
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
                    <span className={doc.status === 'Expiring Soon' ? 'text-error-600 font-medium flex items-center gap-1' : 'text-secondary'}>
                      {doc.status === 'Expiring Soon' && <AlertTriangle className="h-3 w-3" />}
                      {doc.expiryDate}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Size</span>
                  <span className="text-secondary">{doc.size}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="secondary" size="sm" className="flex-1">View</Button>
                <Button variant="ghost" size="sm" className="flex-1"><Download className="h-3.5 w-3.5" /></Button>
              </div>
            </CardBody>
          </Card>
        ))}
        <button className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-strong rounded-xl p-5 text-secondary hover:border-accent-500 hover:text-accent-600 transition-colors min-h-[220px]">
          <Upload className="h-6 w-6" />
          <span className="text-sm font-medium">Upload Document</span>
        </button>
      </div>
    </div>
  );
}
