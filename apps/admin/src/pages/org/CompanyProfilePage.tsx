import { useState } from 'react';
import { Upload, MapPin, Plus, Trash2, Check, Building2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';

const branches = [
  { id: 1, name: 'Headquarters', location: 'San Francisco, CA', employees: 420, isHQ: true },
  { id: 2, name: 'New York Office', location: 'New York, NY', employees: 280 },
  { id: 3, name: 'London Branch', location: 'London, UK', employees: 185 },
  { id: 4, name: 'Singapore Hub', location: 'Singapore', employees: 399 },
];

export function CompanyProfilePage() {
  const [branchList, setBranchList] = useState(branches);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', location: '' });

  const addBranch = () => {
    if (!newBranch.name || !newBranch.location) return;
    setBranchList((prev) => [...prev, { id: Date.now(), ...newBranch, employees: 0 }]);
    setNewBranch({ name: '', location: '' });
    setShowAddBranch(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Company Profile</h1>
        <p className="text-sm text-secondary mt-0.5">Manage your organization's core information and branches.</p>
      </div>

      {/* Logo + basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Identity</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Logo upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-strong flex items-center justify-center bg-[rgb(var(--bg-muted))] hover:border-accent-500 transition-colors cursor-pointer group">
                <div className="flex flex-col items-center gap-1 text-muted group-hover:text-accent-600 transition-colors">
                  <Upload className="h-6 w-6" />
                  <span className="text-[10px] font-medium">Upload Logo</span>
                </div>
              </div>
              <p className="text-[11px] text-muted text-center max-w-[120px]">PNG or SVG, max 1MB</p>
            </div>

            {/* Form */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input defaultValue="Acme Corporation" />
              </div>
              <div>
                <Label>Legal Entity Name</Label>
                <Input defaultValue="Acme Corp. Inc." />
              </div>
              <div>
                <Label>Industry</Label>
                <Select defaultValue="tech">
                  <option value="tech">Technology / SaaS</option>
                  <option value="finance">Finance</option>
                  <option value="retail">Retail</option>
                  <option value="mfg">Manufacturing</option>
                </Select>
              </div>
              <div>
                <Label>Company Size</Label>
                <Select defaultValue="1000">
                  <option value="100">100-499 employees</option>
                  <option value="500">500-999 employees</option>
                  <option value="1000">1000-4999 employees</option>
                  <option value="5000">5000+ employees</option>
                </Select>
              </div>
              <div>
                <Label>Founded</Label>
                <Input type="number" defaultValue="2015" />
              </div>
              <div>
                <Label>Website</Label>
                <Input defaultValue="https://acme.com" />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Branches */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Branches & Locations</CardTitle>
            <p className="text-xs text-muted mt-0.5">Physical offices and locations for this organization</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAddBranch((s) => !s)}>
            <Plus className="h-3.5 w-3.5" /> Add Branch
          </Button>
        </CardHeader>
        <CardBody className="p-0">
          {showAddBranch && (
            <div className="px-5 py-4 border-b border-base bg-[rgb(var(--bg-muted))] animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <Label>Branch Name</Label>
                  <Input value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} placeholder="e.g. Berlin Office" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={newBranch.location} onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })} placeholder="e.g. Berlin, Germany" />
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="md" onClick={addBranch}><Check className="h-4 w-4" /> Save</Button>
                  <Button variant="secondary" size="md" onClick={() => setShowAddBranch(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          )}
          <div className="divide-y divide-[rgb(var(--border-base))]">
            {branchList.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[rgb(var(--bg-hover))] transition-colors group">
                <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-accent-600 dark:text-accent-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">{b.name}</span>
                    {b.isHQ && <Badge tone="accent">Headquarters</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-secondary mt-0.5">
                    <MapPin className="h-3 w-3" /> {b.location}
                  </div>
                </div>
                <Badge tone="neutral">{b.employees} employees</Badge>
                {!b.isHQ && (
                  <button
                    onClick={() => setBranchList((prev) => prev.filter((x) => x.id !== b.id))}
                    className="text-muted hover:text-error-600 p-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-950/40 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Save bar */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">Save Changes</Button>
      </div>
    </div>
  );
}
