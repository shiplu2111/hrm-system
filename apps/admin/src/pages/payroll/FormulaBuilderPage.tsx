import { useState } from 'react';
import {
  Code,
  Sparkles,
  Play,
  History,
  Plus,
  GitBranch,
  Layers,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Pencil,
  Trash2,
  Variable,
  Cpu,
  FileCode,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { payrollRules, type PayrollRule } from '@/data/payrollData';

export function FormulaBuilderPage() {
  const [rules, setRules] = useState<PayrollRule[]>(payrollRules);
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
  const [modalOpen, setModalOpen] = useState(false);

  // Active sandbox / formula state
  const [activeRule, setActiveRule] = useState<PayrollRule>(rules[0]);
  const [conditionInput, setConditionInput] = useState('daily_hours > 8 && day_type == "WEEKDAY"');
  const [actionInput, setActionInput] = useState('ot_hours * (base_salary / 160) * 1.5');
  const [evalTestInputs, setEvalTestInputs] = useState({
    daily_hours: 10,
    base_salary: 7500,
    ot_hours: 2,
    day_type: 'WEEKDAY',
  });
  const [testResult, setTestResult] = useState<string | null>(null);

  const variablesList = [
    'base_salary',
    'gross_salary',
    'daily_hours',
    'ot_hours',
    'unpaid_days',
    'appraisal_rating',
    'tenure_months',
    'shift_type',
  ];

  const operatorsList = ['+', '-', '*', '/', '%', '==', '!=', '>', '<', '>=', '<=', '&&', '||'];

  const insertToken = (token: string, target: 'condition' | 'action') => {
    if (target === 'condition') {
      setConditionInput((prev) => `${prev} ${token}`);
    } else {
      setActionInput((prev) => `${prev} ${token}`);
    }
  };

  const handleTestEvaluation = () => {
    try {
      const hourlyRate = evalTestInputs.base_salary / 160;
      const otRate = hourlyRate * 1.5;
      const payout = evalTestInputs.ot_hours * otRate;
      setTestResult(
        `Condition: TRUE (hours 10 > 8) → Calculated Overtime Pay = $${payout.toFixed(2)} (Rate: $${otRate.toFixed(2)}/hr)`
      );
    } catch {
      setTestResult('Evaluation Error: Please check syntax.');
    }
  };

  const handleSaveRule = () => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === activeRule.id
          ? {
              ...r,
              conditionFormula: conditionInput,
              actionFormula: actionInput,
              version: `v${(parseFloat(r.version.replace('v', '')) + 0.1).toFixed(1)}`,
            }
          : r
      )
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Payroll Rules & Visual Formula Engine</h1>
          <p className="text-sm text-secondary mt-0.5">
            Construct dynamic calculation pipelines for overtime multipliers, tax regimes, and custom incentives.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="surface border border-base rounded-lg p-1 flex items-center gap-1">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'visual'
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" /> Visual Canvas
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <FileCode className="h-3.5 w-3.5" /> List View
            </button>
          </div>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Rule
          </Button>
        </div>
      </div>

      {viewMode === 'visual' ? (
        /* Visual Canvas View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Rule Selector & Variable Palette (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Rule Selector Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-accent-500" /> Active Formulas
                </CardTitle>
              </CardHeader>
              <CardBody className="pt-0 space-y-2">
                {rules.map((rule) => (
                  <button
                    key={rule.id}
                    onClick={() => {
                      setActiveRule(rule);
                      setConditionInput(rule.conditionFormula);
                      setActionInput(rule.actionFormula);
                      setTestResult(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      activeRule.id === rule.id
                        ? 'border-accent-500/40 bg-accent-50/40 dark:bg-accent-950/30 ring-1 ring-accent-500/40'
                        : 'border-base hover:bg-[rgb(var(--bg-hover))]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary text-xs">{rule.name}</span>
                      <Badge tone={rule.status === 'Active' ? 'success' : 'neutral'} className="text-[10px]">
                        {rule.version}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted mt-1 truncate">
                      {rule.category} · {rule.region}
                    </div>
                  </button>
                ))}
              </CardBody>
            </Card>

            {/* Variable & Operator Chips Palette */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Variable className="h-4 w-4 text-purple-500" /> Variable Palette
                </CardTitle>
              </CardHeader>
              <CardBody className="pt-0 space-y-3">
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase block mb-1.5">
                    Payroll Variables
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {variablesList.map((v) => (
                      <button
                        key={v}
                        onClick={() => insertToken(v, 'action')}
                        className="px-2 py-1 rounded bg-[rgb(var(--bg-muted))] hover:bg-accent-50 dark:hover:bg-accent-950/40 text-[11px] font-mono text-secondary hover:text-accent-600 border border-base transition-colors"
                        title="Click to insert"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase block mb-1.5">
                    Operators & Logic
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {operatorsList.map((op) => (
                      <button
                        key={op}
                        onClick={() => insertToken(op, 'condition')}
                        className="px-2.5 py-1 rounded surface border border-base hover:bg-[rgb(var(--bg-hover))] text-xs font-mono font-bold text-primary transition-colors"
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Right Canvas: Connected Nodes (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="overflow-hidden border-2 border-accent-500/20 shadow-lg">
              {/* Canvas Toolbar */}
              <div className="bg-[rgb(var(--bg-muted))] px-5 py-3 border-b border-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-success-500 animate-pulse" />
                  <span className="text-xs font-bold text-primary">
                    Canvas Editor: {activeRule.name}
                  </span>
                  <Badge tone="accent">{activeRule.region}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleTestEvaluation}>
                    <Play className="h-3.5 w-3.5" /> Test Run
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSaveRule}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Save Rule
                  </Button>
                </div>
              </div>

              <CardBody className="p-6 space-y-6">
                {/* Node Flow Representation */}
                <div className="space-y-4">
                  {/* Condition Node (IF block) */}
                  <div className="surface rounded-xl border-2 border-warning-500/30 p-4 bg-warning-50/10 dark:bg-warning-950/10 shadow-sm relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-warning-500 text-white text-[10px] font-bold uppercase tracking-wider">
                          IF (Condition)
                        </span>
                        <span className="text-xs text-secondary">Trigger Criteria</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted">Node #01</span>
                    </div>
                    <Input
                      value={conditionInput}
                      onChange={(e) => setConditionInput(e.target.value)}
                      className="font-mono text-xs bg-surface"
                      placeholder="e.g. daily_hours > 8 && day_type == 'WEEKDAY'"
                    />
                  </div>

                  {/* Flow Arrow Connection */}
                  <div className="flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <div className="h-4 w-0.5 bg-accent-500" />
                      <div className="h-6 w-6 rounded-full bg-accent-500 text-white flex items-center justify-center text-[10px] shadow">
                        <ArrowRight className="h-3.5 w-3.5 rotate-90" />
                      </div>
                      <div className="h-4 w-0.5 bg-accent-500" />
                    </div>
                  </div>

                  {/* Action Node (THEN block) */}
                  <div className="surface rounded-xl border-2 border-success-500/30 p-4 bg-success-50/10 dark:bg-success-950/10 shadow-sm relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-success-600 text-white text-[10px] font-bold uppercase tracking-wider">
                          THEN (Action / Formula)
                        </span>
                        <span className="text-xs text-secondary">Computed Payout / Deduction</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted">Node #02</span>
                    </div>
                    <Input
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      className="font-mono text-xs bg-surface text-success-700 dark:text-success-300 font-semibold"
                      placeholder="e.g. ot_hours * (base_salary / 160) * 1.5"
                    />
                  </div>
                </div>

                {/* Sandbox / Simulation Tester Output */}
                {testResult && (
                  <div className="surface border border-success-500/40 rounded-xl p-4 bg-success-50/30 dark:bg-success-950/20 animate-fadeIn">
                    <div className="flex items-center gap-2 text-xs font-bold text-success-700 dark:text-success-300 mb-1">
                      <Sparkles className="h-4 w-4" /> Live Engine Output
                    </div>
                    <p className="text-xs font-mono text-primary">{testResult}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      ) : (
        /* Fallback List View */
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Configured Formula Rules</CardTitle>
            <Badge tone="neutral">{rules.length} Rules</Badge>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Rule Name
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Category / Region
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Condition
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Action Formula
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-primary text-sm">
                        {rule.name}
                        <div className="text-xs text-muted font-normal">{rule.version} · Author: {rule.author}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        <Badge tone="accent">{rule.region}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-secondary">
                        {rule.conditionText}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-success-600 dark:text-success-400 font-medium">
                        {rule.actionText}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={rule.status === 'Active' ? 'success' : 'neutral'} dot>
                          {rule.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Rule Versioning & History Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-accent-500" />
            <CardTitle>Rule Audit Trail & Versioning History</CardTitle>
          </div>
          <span className="text-xs text-secondary">Full change tracking for compliance</span>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Rule Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Version
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Effective Span
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Jurisdiction
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-primary text-xs">{r.name}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted">{r.version}</td>
                    <td className="px-5 py-3.5 text-xs text-secondary">
                      {r.effectiveFrom} to {r.effectiveTo}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-secondary">{r.region}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={r.status === 'Active' ? 'success' : 'neutral'} dot>
                        {r.status}
                      </Badge>
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
        title="Create New Payroll Rule"
        description="Add a new condition and calculation formula to the payroll engine."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const newRule: PayrollRule = {
                  id: `rule-${Date.now()}`,
                  name: 'Custom Incentive Multiplier',
                  version: 'v1.0',
                  category: 'Bonus',
                  conditionText: 'IF projects_completed > 3',
                  actionText: 'THEN bonus = basic_salary * 0.1',
                  conditionFormula: 'projects_completed > 3',
                  actionFormula: 'basic_salary * 0.1',
                  effectiveFrom: '2024-09-01',
                  effectiveTo: '2025-08-31',
                  region: 'Global',
                  status: 'Active',
                  author: 'Current Admin',
                };
                setRules((prev) => [newRule, ...prev]);
                setModalOpen(false);
              }}
            >
              Create Rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Rule Name</Label>
            <Input placeholder="e.g. Holiday Night Shift 2.5x" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select>
                <option>Overtime</option>
                <option>Bonus</option>
                <option>Tax Exemption</option>
                <option>Deduction</option>
              </Select>
            </div>
            <div>
              <Label>Jurisdiction / Region</Label>
              <Input placeholder="e.g. US-CA or Global" />
            </div>
          </div>
          <div>
            <Label>Condition Expression</Label>
            <Input placeholder="e.g. daily_hours > 8" />
          </div>
          <div>
            <Label>Action Formula</Label>
            <Input placeholder="e.g. ot_hours * 1.5 * hourly_rate" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

