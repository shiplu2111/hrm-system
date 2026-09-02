import { useState } from 'react';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Shield,
  Pencil,
  Trash2,
  Search,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { salaryComponents, type SalaryComponent } from '@/data/payrollData';

export function SalaryComponentsPage() {
  const [components, setComponents] = useState<SalaryComponent[]>(salaryComponents);
  const [activeTab, setActiveTab] = useState<'Earning' | 'Deduction'>('Earning');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SalaryComponent | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Earning' | 'Deduction'>('Earning');
  const [type, setType] = useState<SalaryComponent['type']>('Fixed');
  const [calculationBasis, setCalculationBasis] = useState('');
  const [taxable, setTaxable] = useState(true);
  const [description, setDescription] = useState('');

  const openCreateModal = () => {
    setEditingItem(null);
    setCode('');
    setName('');
    setCategory(activeTab);
    setType('Fixed');
    setCalculationBasis('Flat Amount');
    setTaxable(activeTab === 'Earning');
    setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (comp: SalaryComponent) => {
    setEditingItem(comp);
    setCode(comp.code);
    setName(comp.name);
    setCategory(comp.category);
    setType(comp.type);
    setCalculationBasis(comp.calculationBasis);
    setTaxable(comp.taxable);
    setDescription(comp.description);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !code.trim()) return;
    if (editingItem) {
      setComponents((prev) =>
        prev.map((c) =>
          c.id === editingItem.id
            ? { ...c, code, name, category, type, calculationBasis, taxable, description }
            : c
        )
      );
    } else {
      const newComp: SalaryComponent = {
        id: `sc-${Date.now()}`,
        code: code.toUpperCase(),
        name,
        category,
        type,
        calculationBasis: calculationBasis || 'Standard Rule',
        taxable,
        adminDefined: false,
        active: true,
        description,
      };
      setComponents((prev) => [...prev, newComp]);
    }
    setModalOpen(false);
  };

  const toggleActive = (id: string) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
  };

  const deleteComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const filteredComponents = components
    .filter((c) => c.category === activeTab)
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.calculationBasis.toLowerCase().includes(search.toLowerCase())
    );

  const earningsCount = components.filter((c) => c.category === 'Earning').length;
  const deductionsCount = components.filter((c) => c.category === 'Deduction').length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Salary Components (Earnings & Deductions)</h1>
          <p className="text-sm text-secondary mt-0.5">
            Define basic pay, allowances, statutory deductions, tax rules, and formula-driven pay items.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          <Plus className="h-4 w-4" /> Add Component
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{earningsCount}</div>
            <div className="text-xs text-secondary">Earning Components</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 flex items-center justify-center shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{deductionsCount}</div>
            <div className="text-xs text-secondary">Deduction Components</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {components.filter((c) => c.adminDefined).length}
            </div>
            <div className="text-xs text-secondary">Statutory / Admin Defined</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {components.filter((c) => c.taxable).length}
            </div>
            <div className="text-xs text-secondary">Taxable Pay Items</div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 p-1 surface border border-base rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('Earning')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'Earning'
                ? 'bg-success-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Earnings ({earningsCount})
          </button>
          <button
            onClick={() => setActiveTab('Deduction')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'Deduction'
                ? 'bg-error-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Deductions ({deductionsCount})
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab.toLowerCase()}s by name or code...`}
            className="pl-9"
          />
        </div>
      </div>

      {/* Components Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>
            {activeTab === 'Earning' ? 'Earnings Components' : 'Deduction Components'}
          </CardTitle>
          <Badge tone={activeTab === 'Earning' ? 'success' : 'error'}>
            {filteredComponents.length} Active Rules
          </Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Code / Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Calculation Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Computation Basis
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Tax Treatment
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Source
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
                {filteredComponents.map((comp) => (
                  <tr key={comp.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <div className="font-semibold text-primary text-sm flex items-center gap-2">
                          {comp.name}
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-muted">
                            {comp.code}
                          </span>
                        </div>
                        <div className="text-xs text-secondary mt-0.5 line-clamp-1">
                          {comp.description}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-primary font-medium">
                      <Badge
                        tone={
                          comp.type === 'Fixed'
                            ? 'neutral'
                            : comp.type === 'Formula'
                            ? 'accent'
                            : comp.type === 'Percentage of Basic'
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {comp.type}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-xs font-mono text-secondary">
                      {comp.calculationBasis}
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge tone={comp.taxable ? 'warning' : 'neutral'} dot={comp.taxable}>
                        {comp.taxable ? 'Taxable' : 'Tax Exempt'}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5">
                      {comp.adminDefined ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-700 dark:text-accent-300 bg-accent-50 dark:bg-accent-950/40 px-2 py-0.5 rounded">
                          <Shield className="h-3 w-3" /> Statutory
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted font-medium">Custom Defined</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <Toggle
                        checked={comp.active}
                        onChange={() => toggleActive(comp.id)}
                        size="sm"
                      />
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(comp)}
                          className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!comp.adminDefined && (
                          <button
                            onClick={() => deleteComponent(comp.id)}
                            className="p-1.5 rounded-lg text-secondary hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/40 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Salary Component' : 'Add Salary Component'}
        description="Configure component code, calculation rules, and taxability."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingItem ? 'Save Changes' : 'Create Component'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Component Category</Label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'Earning' | 'Deduction')}
              >
                <option value="Earning">Earning (Credit)</option>
                <option value="Deduction">Deduction (Debit)</option>
              </Select>
            </div>
            <div>
              <Label>Unique Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. HRA, PERF_BONUS"
              />
            </div>
          </div>

          <div>
            <Label>Component Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. House Rent Allowance"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Calculation Type</Label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as SalaryComponent['type'])}
              >
                <option value="Fixed">Fixed Amount</option>
                <option value="Percentage of Basic">Percentage of Basic</option>
                <option value="Formula">Formula Driven</option>
                <option value="Variable">Variable / Monthly Discretionary</option>
              </Select>
            </div>
            <div>
              <Label>Tax Treatment</Label>
              <Select
                value={taxable ? 'taxable' : 'exempt'}
                onChange={(e) => setTaxable(e.target.value === 'taxable')}
              >
                <option value="taxable">Taxable (Subject to TDS)</option>
                <option value="exempt">Tax Exempt</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Calculation Basis / Formula Expression</Label>
            <Input
              value={calculationBasis}
              onChange={(e) => setCalculationBasis(e.target.value)}
              placeholder="e.g. 40% of Basic or (Hourly_Rate * 1.5)"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes regarding this compensation element"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

