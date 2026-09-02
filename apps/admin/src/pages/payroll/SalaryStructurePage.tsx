import { useState } from 'react';
import {
  Users,
  DollarSign,
  Search,
  Pencil,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Check,
  Building,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import {
  employeeSalaryStructures,
  type EmployeeSalaryStructure,
} from '@/data/payrollData';

export function SalaryStructurePage() {
  const [structures, setStructures] = useState<EmployeeSalaryStructure[]>(
    employeeSalaryStructures
  );
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSalaryStructure | null>(null);

  // Edit structure form state
  const [editBasic, setEditBasic] = useState(0);
  const [editHra, setEditHra] = useState(0);
  const [editSpecial, setEditSpecial] = useState(0);
  const [editTax, setEditTax] = useState(0);
  const [editPf, setEditPf] = useState(0);
  const [editInsurance, setEditInsurance] = useState(0);

  const openEditModal = (emp: EmployeeSalaryStructure) => {
    setSelectedEmp(emp);
    setEditBasic(emp.basicSalary);
    const hra = emp.earnings.find((e) => e.name.includes('House') || e.name.includes('HRA'))?.amount || 0;
    const special = emp.earnings.find((e) => e.name.includes('Special'))?.amount || 0;
    const tax = emp.deductions.find((d) => d.name.includes('Tax'))?.amount || 0;
    const pf = emp.deductions.find((d) => d.name.includes('401') || d.name.includes('PF'))?.amount || 0;
    const ins = emp.deductions.find((d) => d.name.includes('Health') || d.name.includes('Insurance'))?.amount || 0;

    setEditHra(hra);
    setEditSpecial(special);
    setEditTax(tax);
    setEditPf(pf);
    setEditInsurance(ins);
    setModalOpen(true);
  };

  const calculatedGross = editBasic + editHra + editSpecial + 800; // includes 800 conveyance
  const calculatedDeductions = editTax + editPf + editInsurance;
  const calculatedNet = calculatedGross - calculatedDeductions;

  const handleSave = () => {
    if (!selectedEmp) return;
    setStructures((prev) =>
      prev.map((item) => {
        if (item.id === selectedEmp.id) {
          return {
            ...item,
            basicSalary: editBasic,
            grossSalary: calculatedGross,
            totalDeductions: calculatedDeductions,
            netSalary: calculatedNet,
            earnings: item.earnings.map((e) => {
              if (e.name.includes('Basic')) return { ...e, amount: editBasic };
              if (e.name.includes('HRA') || e.name.includes('House')) return { ...e, amount: editHra };
              if (e.name.includes('Special')) return { ...e, amount: editSpecial };
              return e;
            }),
            deductions: item.deductions.map((d) => {
              if (d.name.includes('Tax')) return { ...d, amount: editTax };
              if (d.name.includes('401') || d.name.includes('PF')) return { ...d, amount: editPf };
              if (d.name.includes('Health') || d.name.includes('Insurance')) return { ...d, amount: editInsurance };
              return d;
            }),
          };
        }
        return item;
      })
    );
    setModalOpen(false);
  };

  const filteredStructures = structures.filter((s) => {
    const matchesSearch =
      s.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      s.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      s.designation.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'All' || s.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const totalPayrollGross = structures.reduce((sum, s) => sum + s.grossSalary, 0);
  const totalPayrollNet = structures.reduce((sum, s) => sum + s.netSalary, 0);
  const totalPayrollDeductions = structures.reduce((sum, s) => sum + s.totalDeductions, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employee Salary Structure Assignment</h1>
          <p className="text-sm text-secondary mt-0.5">
            Manage per-employee compensation breakdown, statutory tax deductions, and take-home pay.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">${totalPayrollGross.toLocaleString()}</div>
            <div className="text-xs text-secondary mt-0.5">Total Monthly Gross Committed</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-error-600 dark:text-error-400">
              ${totalPayrollDeductions.toLocaleString()}
            </div>
            <div className="text-xs text-secondary mt-0.5">Total Monthly Deductions & Tax</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 flex items-center justify-center">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-success-600 dark:text-success-400">
              ${totalPayrollNet.toLocaleString()}
            </div>
            <div className="text-xs text-secondary mt-0.5">Total Net Salary (Take-Home)</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee by name, ID, or designation..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary font-medium">Department:</span>
          <Select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-40 text-xs"
          >
            <option value="All">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
          </Select>
        </div>
      </div>

      {/* Structures Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Assigned Salary Structures</CardTitle>
          <Badge tone="neutral">{filteredStructures.length} records</Badge>
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
                    Basic Salary
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Allowances & Bonus
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Gross Pay
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Deductions (Tax/PF)
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Net Pay
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredStructures.map((item) => (
                  <tr key={item.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={item.employeeName} size="sm" />
                        <div>
                          <div className="font-semibold text-primary text-sm">{item.employeeName}</div>
                          <div className="text-xs text-muted">
                            {item.employeeId} · {item.department}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-medium text-primary text-xs">
                      ${item.basicSalary.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-secondary">
                      <div className="flex flex-wrap gap-1">
                        {item.earnings
                          .filter((e) => !e.name.includes('Basic'))
                          .map((e) => (
                            <span
                              key={e.name}
                              className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[11px]"
                            >
                              {e.name.split(' ')[0]}: ${e.amount}
                            </span>
                          ))}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-primary text-xs">
                      ${item.grossSalary.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-error-600 dark:text-error-400 font-medium">
                      -${item.totalDeductions.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 font-bold text-success-700 dark:text-success-300 bg-success-50 dark:bg-success-950/40 px-2.5 py-1 rounded-lg text-xs">
                        ${item.netSalary.toLocaleString()}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Button variant="secondary" size="sm" onClick={() => openEditModal(item)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Edit Structure Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedEmp ? `Salary Structure: ${selectedEmp.employeeName}` : 'Edit Structure'}
        description={`Designation: ${selectedEmp?.designation} · ${selectedEmp?.department}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              <Check className="h-4 w-4" /> Save Structure
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Earnings Section */}
          <div>
            <div className="text-xs font-bold text-success-600 dark:text-success-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Earnings Breakdown
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Basic Salary</Label>
                <Input
                  type="number"
                  value={editBasic}
                  onChange={(e) => setEditBasic(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>House Rent (HRA)</Label>
                <Input
                  type="number"
                  value={editHra}
                  onChange={(e) => setEditHra(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Special Allowance</Label>
                <Input
                  type="number"
                  value={editSpecial}
                  onChange={(e) => setEditSpecial(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Deductions Section */}
          <div className="pt-3 border-t border-base">
            <div className="text-xs font-bold text-error-600 dark:text-error-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" /> Deductions Breakdown
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Income Tax (TDS)</Label>
                <Input
                  type="number"
                  value={editTax}
                  onChange={(e) => setEditTax(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>401(k) / PF</Label>
                <Input
                  type="number"
                  value={editPf}
                  onChange={(e) => setEditPf(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Health Insurance</Label>
                <Input
                  type="number"
                  value={editInsurance}
                  onChange={(e) => setEditInsurance(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Live Recalculation Summary */}
          <div className="surface border border-base rounded-xl p-3 bg-accent-50/30 dark:bg-accent-950/20 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[11px] text-secondary">Gross Salary</div>
              <div className="text-sm font-bold text-primary">${calculatedGross.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[11px] text-secondary">Total Deductions</div>
              <div className="text-sm font-bold text-error-600">-${calculatedDeductions.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[11px] text-secondary">Estimated Net Pay</div>
              <div className="text-sm font-bold text-success-600">${calculatedNet.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

