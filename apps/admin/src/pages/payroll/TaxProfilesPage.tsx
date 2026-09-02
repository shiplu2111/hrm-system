import { useState } from 'react';
import {
  FileText,
  Download,
  Shield,
  Search,
  Pencil,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Building,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { taxProfiles, type TaxProfile } from '@/data/payrollData';

export function TaxProfilesPage() {
  const [profiles, setProfiles] = useState<TaxProfile[]>(taxProfiles);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<TaxProfile | null>(null);

  // Form State
  const [regime, setRegime] = useState<TaxProfile['regime']>('US Standard W-4');
  const [declared80C, setDeclared80C] = useState(0);
  const [declaredHra, setDeclaredHra] = useState(0);
  const [declared80D, setDeclared80D] = useState(0);

  const openEditModal = (p: TaxProfile) => {
    setSelectedProfile(p);
    setRegime(p.regime);
    setDeclared80C(p.section80C);
    setDeclaredHra(p.hraExemption);
    setDeclared80D(p.healthInsurance80D);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedProfile) return;
    const totalExempt = declared80C + declaredHra + declared80D;
    const newTaxable = Math.max(0, selectedProfile.projectedAnnualGross - totalExempt);
    const newAnnualTax = Math.round(newTaxable * 0.22);
    const newMonthlyTds = Math.round(newAnnualTax / 12);

    setProfiles((prev) =>
      prev.map((p) =>
        p.id === selectedProfile.id
          ? {
              ...p,
              regime,
              section80C: declared80C,
              hraExemption: declaredHra,
              healthInsurance80D: declared80D,
              declaredInvestments: totalExempt,
              taxableIncome: newTaxable,
              annualTaxLiability: newAnnualTax,
              monthlyTds: newMonthlyTds,
              status: 'Verified',
            }
          : p
      )
    );
    setModalOpen(false);
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      p.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      p.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      p.panOrTaxId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Tax Profiles & Statutory TDS Management</h1>
          <p className="text-sm text-secondary mt-0.5">
            Manage employee tax declarations, exemption thresholds, withholding rates, and year-end W-2 / Form 16 certificates.
          </p>
        </div>
        <Button variant="secondary">
          <Download className="h-4 w-4" /> Bulk Export W-2 / Form 16
        </Button>
      </div>

      {/* Progressive Tax Slabs Visual Widget */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent-500" /> Active Statutory Tax Brackets (2024 Regime)
            </span>
            <Badge tone="accent">Federal IRS & Progressive Slabs</Badge>
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="surface border border-base rounded-xl p-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted">Tier 1 (10%)</span>
                <span className="font-bold text-success-600">0% – 10%</span>
              </div>
              <div className="text-xs font-semibold text-primary">$0 – $11,600</div>
              <div className="h-1.5 w-full rounded-full bg-success-500 mt-2" />
            </div>

            <div className="surface border border-base rounded-xl p-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted">Tier 2 (12%)</span>
                <span className="font-bold text-accent-600">12%</span>
              </div>
              <div className="text-xs font-semibold text-primary">$11,601 – $47,150</div>
              <div className="h-1.5 w-full rounded-full bg-accent-500 mt-2" />
            </div>

            <div className="surface border border-base rounded-xl p-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted">Tier 3 (22%)</span>
                <span className="font-bold text-warning-600">22%</span>
              </div>
              <div className="text-xs font-semibold text-primary">$47,151 – $100,525</div>
              <div className="h-1.5 w-full rounded-full bg-warning-500 mt-2" />
            </div>

            <div className="surface border border-base rounded-xl p-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted">Tier 4 (24%+)</span>
                <span className="font-bold text-purple-600">24% – 32%</span>
              </div>
              <div className="text-xs font-semibold text-primary">$100,526 & Above</div>
              <div className="h-1.5 w-full rounded-full bg-purple-500 mt-2" />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Employee Tax Profiles Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Employee Tax Profiles & TDS Withholding</CardTitle>
            <p className="text-xs text-secondary mt-0.5">
              Verified declarations and projected annual tax withholdings.
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, SSN..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Tax Regime
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Projected Gross
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Total Exemptions
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Taxable Income
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Monthly TDS
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.employeeName} size="sm" />
                        <div>
                          <div className="font-semibold text-primary text-sm">{p.employeeName}</div>
                          <div className="text-xs text-muted font-mono">{p.panOrTaxId}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-primary font-medium">
                      <Badge tone="accent">{p.regime}</Badge>
                    </td>

                    <td className="px-5 py-3.5 text-xs font-semibold text-primary">
                      ${p.projectedAnnualGross.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-success-600 font-medium">
                      -${p.declaredInvestments.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-xs font-bold text-primary">
                      ${p.taxableIncome.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-xs font-bold text-error-600">
                      ${p.monthlyTds.toLocaleString()} / mo
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge tone={p.status === 'Verified' ? 'success' : 'warning'} dot>
                        {p.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEditModal(p)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => alert(`Generating Tax Form 16 / W-2 for ${p.employeeName}...`)}
                        >
                          <FileText className="h-3.5 w-3.5" /> Certificate
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Edit Tax Declaration Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedProfile ? `Tax Declaration: ${selectedProfile.employeeName}` : 'Edit Declaration'}
        description="Update annual investment proofs, HRA receipts, and deduction limits."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save & Recalculate TDS
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Tax Regime</Label>
            <Select
              value={regime}
              onChange={(e) => setRegime(e.target.value as TaxProfile['regime'])}
            >
              <option value="US Standard W-4">US Standard W-4 Form</option>
              <option value="New Regime (2024)">New Regime (2024 - Lower Slabs)</option>
              <option value="Old Regime with Exemptions">Old Regime (Max Deductions Allowed)</option>
              <option value="UK PAYE">UK PAYE Scheme</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>80C / 401(k) ($)</Label>
              <Input
                type="number"
                value={declared80C}
                onChange={(e) => setDeclared80C(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>HRA Rent Exemption ($)</Label>
              <Input
                type="number"
                value={declaredHra}
                onChange={(e) => setDeclaredHra(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Health 80D / Med ($)</Label>
              <Input
                type="number"
                value={declared80D}
                onChange={(e) => setDeclared80D(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="surface border border-base rounded-xl p-3 bg-accent-50/20 dark:bg-accent-950/20 text-xs space-y-1">
            <div className="font-semibold text-primary">Live Recalculation Preview</div>
            <div className="flex items-center justify-between text-secondary">
              <span>Total Declared Exemptions:</span>
              <strong className="text-success-600">${(declared80C + declaredHra + declared80D).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

