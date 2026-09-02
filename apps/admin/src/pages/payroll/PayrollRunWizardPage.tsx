import { useState } from 'react';
import {
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Users,
  Building,
  FileCheck,
  Lock,
  Calculator,
  Sliders,
  Send,
  Download,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Select } from '@/components/ui/Form';
import { Progress } from '@/components/ui/Progress';
import { payrollPeriods, type PayrollPeriod } from '@/data/payrollData';

export function PayrollRunWizardPage() {
  const [activeView, setActiveView] = useState<'wizard' | 'status-board' | 'simulation'>('wizard');
  const [currentStep, setCurrentStep] = useState(1);

  // Wizard state
  const [selectedSchedule, setSelectedSchedule] = useState('US Regular Monthly Payroll');
  const [selectedPeriod, setSelectedPeriod] = useState('August 2024 (Monthly)');
  const [calcProgress, setCalcProgress] = useState(100);
  const [isCalculated, setIsCalculated] = useState(true);
  const [approvedStatus, setApprovedStatus] = useState(false);
  const [finalizedStatus, setFinalizedStatus] = useState(false);

  // What-If Simulation State
  const [simBase, setSimBase] = useState(7500);
  const [simOtHours, setSimOtHours] = useState(12);
  const [simBonusPercent, setSimBonusPercent] = useState(10);
  const [simTaxRate, setSimTaxRate] = useState(24);
  const [simBenefits, setSimBenefits] = useState(250);

  // Simulation Calculations
  const simHourly = simBase / 160;
  const simOtPay = simOtHours * (simHourly * 1.5);
  const simBonus = (simBase * simBonusPercent) / 100;
  const simGross = simBase + simOtPay + simBonus + 800; // 800 fixed allowance
  const simTax = (simGross * simTaxRate) / 100;
  const simTotalDeductions = simTax + simBenefits + simBase * 0.06; // 6% 401k
  const simNet = simGross - simTotalDeductions;
  const simEmployerCost = simGross + simBase * 0.08 + 850; // healthcare match + employer tax

  const pipelineStages = [
    { name: 'Draft', count: 1, amount: '$1.45M', tone: 'neutral' as const },
    { name: 'Calculated', count: 0, amount: '$0', tone: 'accent' as const },
    { name: 'Under Review', count: 1, amount: '$1.42M', tone: 'warning' as const },
    { name: 'Approved', count: 1, amount: '$1.42M', tone: 'success' as const },
    { name: 'Finalized', count: 0, amount: '$0', tone: 'accent' as const },
    { name: 'Paid', count: 2, amount: '$2.75M', tone: 'success' as const },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Payroll Processing & Pay Run Hub</h1>
          <p className="text-sm text-secondary mt-0.5">
            5-step automated pay run wizard, lifecycle status board, and what-if salary simulator.
          </p>
        </div>

        {/* View Switcher */}
        <div className="surface border border-base rounded-xl p-1 flex items-center gap-1">
          <button
            onClick={() => setActiveView('wizard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeView === 'wizard'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <Calculator className="h-3.5 w-3.5" /> Run Wizard
          </button>
          <button
            onClick={() => setActiveView('status-board')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeView === 'status-board'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Status Board
          </button>
          <button
            onClick={() => setActiveView('simulation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeView === 'simulation'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> What-If Simulator
          </button>
        </div>
      </div>

      {/* VIEW 1: PAYROLL RUN WIZARD (STEPPER UI) */}
      {activeView === 'wizard' && (
        <div className="space-y-6">
          {/* Stepper Header */}
          <Card>
            <CardBody className="p-4 sm:p-6">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { step: 1, title: '1. Select Period', desc: 'Pay schedule & dates' },
                  { step: 2, title: '2. Review Attendance', desc: 'Leave & OT sync' },
                  { step: 3, title: '3. Calculate', desc: 'Gross-to-Net engine' },
                  { step: 4, title: '4. Audit & Approve', desc: 'Sign-off & compliance' },
                  { step: 5, title: '5. Finalize', desc: 'Lock & publish payslips' },
                ].map((s) => {
                  const isActive = currentStep === s.step;
                  const isCompleted = currentStep > s.step;
                  return (
                    <div
                      key={s.step}
                      onClick={() => setCurrentStep(s.step)}
                      className={`cursor-pointer flex flex-col items-center p-2 rounded-xl transition-all ${
                        isActive
                          ? 'bg-accent-50/70 dark:bg-accent-950/40 border border-accent-500/40 text-accent-700 dark:text-accent-300'
                          : isCompleted
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-muted'
                      }`}
                    >
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${
                          isActive
                            ? 'bg-accent-600 text-white shadow-sm'
                            : isCompleted
                            ? 'bg-success-600 text-white'
                            : 'bg-[rgb(var(--bg-muted))] text-muted'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : s.step}
                      </div>
                      <span className="text-xs font-bold leading-tight line-clamp-1">{s.title}</span>
                      <span className="text-[10px] text-muted hidden sm:block">{s.desc}</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Stepper Body */}
          <Card>
            <CardBody className="p-6">
              {/* STEP 1: Select Period */}
              {currentStep === 1 && (
                <div className="space-y-4 max-w-2xl mx-auto">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-primary">Step 1: Select Pay Group & Period</h3>
                    <p className="text-xs text-secondary mt-1">
                      Choose which pay frequency and billing cycle to process.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Pay Schedule Group</Label>
                      <Select
                        value={selectedSchedule}
                        onChange={(e) => setSelectedSchedule(e.target.value)}
                      >
                        <option>US Regular Monthly Payroll</option>
                        <option>Engineering Bi-Weekly Cycle</option>
                        <option>UK London Monthly Cycle</option>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Payroll Month / Cycle</Label>
                        <Select
                          value={selectedPeriod}
                          onChange={(e) => setSelectedPeriod(e.target.value)}
                        >
                          <option>August 2024 (Monthly)</option>
                          <option>September 2024 (Monthly)</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Target Payment Date</Label>
                        <Input type="date" defaultValue="2024-08-31" />
                      </div>
                    </div>

                    <div className="surface border border-base rounded-xl p-4 space-y-2">
                      <div className="text-xs font-semibold text-primary">Cycle Summary</div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-secondary">
                        <div>Enrolled Staff: <strong className="text-primary">142</strong></div>
                        <div>Cut-Off Date: <strong className="text-primary">Aug 25, 2024</strong></div>
                        <div>Currency: <strong className="text-primary">USD ($)</strong></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Attendance & Leave Review */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-primary">Step 2: Attendance, Leave & OT Verification</h3>
                      <p className="text-xs text-secondary mt-0.5">
                        Synchronized from Time & Attendance module for 142 employees.
                      </p>
                    </div>
                    <Badge tone="success">100% Synced</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="surface rounded-xl border border-base p-3 text-center">
                      <div className="text-xl font-bold text-primary">2,984</div>
                      <div className="text-xs text-secondary">Present Workdays</div>
                    </div>
                    <div className="surface rounded-xl border border-base p-3 text-center">
                      <div className="text-xl font-bold text-success-600">47</div>
                      <div className="text-xs text-secondary">Approved Leaves</div>
                    </div>
                    <div className="surface rounded-xl border border-base p-3 text-center">
                      <div className="text-xl font-bold text-accent-600">324 hrs</div>
                      <div className="text-xs text-secondary">Approved Overtime</div>
                    </div>
                    <div className="surface rounded-xl border border-base p-3 text-center">
                      <div className="text-xl font-bold text-warning-600">3</div>
                      <div className="text-xs text-secondary">Loss of Pay (LOP) Days</div>
                    </div>
                  </div>

                  <div className="surface border border-base rounded-xl p-3 text-xs text-secondary flex items-center justify-between">
                    <span>All attendance logs verified. No unapproved timecard anomalies.</span>
                    <Button variant="secondary" size="sm">Re-sync Attendance</Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Calculation */}
              {currentStep === 3 && (
                <div className="space-y-6 max-w-2xl mx-auto text-center">
                  <div>
                    <h3 className="text-lg font-bold text-primary">Step 3: Gross-to-Net Engine Execution</h3>
                    <p className="text-xs text-secondary mt-1">
                      Applying salary structures, OT formula multipliers, and statutory tax slabs.
                    </p>
                  </div>

                  <div className="surface rounded-2xl border border-base p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-primary">
                      <span>Engine Calculation Progress</span>
                      <span>{calcProgress}% Complete</span>
                    </div>
                    <Progress value={calcProgress} />

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-base text-left">
                      <div>
                        <span className="text-[11px] text-secondary">Total Gross Payout</span>
                        <div className="text-base font-bold text-primary">$1,420,000</div>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary">Total Taxes & Deductions</span>
                        <div className="text-base font-bold text-error-600">-$340,800</div>
                      </div>
                      <div>
                        <span className="text-[11px] text-secondary">Net Disbursal Amount</span>
                        <div className="text-base font-bold text-success-600">$1,079,200</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Audit & Approvals */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-primary">Step 4: Department Variance & Final Approval</h3>
                      <p className="text-xs text-secondary mt-0.5">
                        Compare payroll variance against previous month and authorize payment.
                      </p>
                    </div>
                    <Badge tone="accent">Variance +2.1% (In Budget)</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="surface rounded-xl border border-base p-4">
                      <div className="text-xs text-secondary">Engineering (42 staff)</div>
                      <div className="text-lg font-bold text-primary mt-1">$580,000</div>
                      <span className="text-[11px] text-success-600 font-medium">+1.4% vs July</span>
                    </div>
                    <div className="surface rounded-xl border border-base p-4">
                      <div className="text-xs text-secondary">Sales & Marketing (58 staff)</div>
                      <div className="text-lg font-bold text-primary mt-1">$490,000</div>
                      <span className="text-[11px] text-success-600 font-medium">+2.8% (Commissions)</span>
                    </div>
                    <div className="surface rounded-xl border border-base p-4">
                      <div className="text-xs text-secondary">Operations & HR (42 staff)</div>
                      <div className="text-lg font-bold text-primary mt-1">$350,000</div>
                      <span className="text-[11px] text-muted font-medium">0.0% Flat</span>
                    </div>
                  </div>

                  <div className="surface border border-base rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-primary text-sm">Finance & HR Sign-Off</div>
                      <div className="text-xs text-secondary">
                        Authorized by VP of Finance on August 30, 2024.
                      </div>
                    </div>
                    <Button
                      variant={approvedStatus ? 'secondary' : 'primary'}
                      onClick={() => setApprovedStatus(true)}
                    >
                      {approvedStatus ? '✓ Approved' : 'Sign & Approve Run'}
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 5: Finalize & Publish */}
              {currentStep === 5 && (
                <div className="space-y-6 max-w-xl mx-auto text-center">
                  <div className="h-14 w-14 rounded-2xl bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary">Step 5: Finalize & Distribute</h3>
                    <p className="text-xs text-secondary mt-1">
                      Lock the August 2024 payroll period, generate 142 PDF payslips, and push batch to bank.
                    </p>
                  </div>

                  <div className="surface border border-base rounded-xl p-4 text-left space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">142 Employee Payslips</span>
                      <Badge tone="success">Ready</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">Bank NACHA / ACH File</span>
                      <Badge tone="accent">Generated</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary">General Ledger (GL) Export</span>
                      <Badge tone="neutral">Ready to Sync</Badge>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => setFinalizedStatus(true)}
                  >
                    {finalizedStatus ? '✓ Period Locked & Published' : 'Finalize & Publish Run'}
                  </Button>
                </div>
              )}

              {/* Stepper Navigation Buttons */}
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-base">
                <Button
                  variant="secondary"
                  disabled={currentStep === 1}
                  onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Button>

                {currentStep < 5 && (
                  <Button
                    variant="primary"
                    onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
                  >
                    Next Step <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* VIEW 2: PAYROLL STATUS BOARD (KANBAN PIPELINE) */}
      {activeView === 'status-board' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-primary">Payroll Lifecycle Pipeline</h2>
              <p className="text-xs text-secondary">
                Track payroll cycles from initial draft creation to finalized bank disbursal.
              </p>
            </div>
            <Button variant="primary" onClick={() => setActiveView('wizard')}>
              <Play className="h-4 w-4" /> Start New Pay Run
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {pipelineStages.map((stage) => (
              <div
                key={stage.name}
                className="surface rounded-xl border border-base p-3 space-y-3 shadow-sm flex flex-col"
              >
                <div className="flex items-center justify-between border-b border-base pb-2">
                  <span className="text-xs font-bold text-primary">{stage.name}</span>
                  <Badge tone={stage.tone} className="text-[10px]">
                    {stage.count}
                  </Badge>
                </div>

                <div className="space-y-2 flex-1">
                  {stage.count > 0 ? (
                    <div className="surface border border-base rounded-lg p-2.5 space-y-1 hover:border-strong transition-colors cursor-pointer">
                      <div className="text-xs font-semibold text-primary">August 2024</div>
                      <div className="text-[11px] text-muted">142 Employees</div>
                      <div className="text-xs font-bold text-success-600 dark:text-success-400">
                        {stage.amount}
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 rounded-lg border border-dashed border-base flex items-center justify-center text-[11px] text-muted">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: WHAT-IF SALARY SIMULATOR */}
      {activeView === 'simulation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-accent-500" /> Simulation Parameters
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <Label>Monthly Basic Salary</Label>
                    <span className="font-bold text-primary">${simBase.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="3000"
                    max="25000"
                    step="250"
                    value={simBase}
                    onChange={(e) => setSimBase(parseFloat(e.target.value))}
                    className="w-full accent-accent-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <Label>Overtime Hours Claimed</Label>
                    <span className="font-bold text-primary">{simOtHours} hrs (${simOtPay.toFixed(0)})</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="2"
                    value={simOtHours}
                    onChange={(e) => setSimOtHours(parseFloat(e.target.value))}
                    className="w-full accent-accent-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <Label>Performance Bonus %</Label>
                    <span className="font-bold text-primary">{simBonusPercent}% (${simBonus.toFixed(0)})</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={simBonusPercent}
                    onChange={(e) => setSimBonusPercent(parseFloat(e.target.value))}
                    className="w-full accent-accent-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-base">
                  <div>
                    <Label>Marginal Tax Slab (%)</Label>
                    <Input
                      type="number"
                      value={simTaxRate}
                      onChange={(e) => setSimTaxRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Voluntary Benefits ($)</Label>
                    <Input
                      type="number"
                      value={simBenefits}
                      onChange={(e) => setSimBenefits(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Live Preview Card (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <Card className="border-2 border-success-500/30 bg-success-50/10 dark:bg-success-950/10 shadow-lg">
              <CardHeader className="border-b border-base pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Live Net Take-Home Projection</span>
                  <Badge tone="success">Calculated</Badge>
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-3xl font-extrabold text-success-600 dark:text-success-400">
                    ${simNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-secondary mt-1">Estimated Employee Monthly Net Pay</div>
                </div>

                <div className="surface rounded-xl border border-base p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-secondary">
                    <span>Gross Earnings:</span>
                    <span className="font-semibold text-primary">${simGross.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-secondary">
                    <span>Income Tax Deduction:</span>
                    <span className="font-semibold text-error-600">-${simTax.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-secondary">
                    <span>401(k) Employee Contrib:</span>
                    <span className="font-semibold text-error-600">-${(simBase * 0.06).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-secondary">
                    <span>Insurance & Benefits:</span>
                    <span className="font-semibold text-error-600">-${simBenefits.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-base flex items-center justify-between font-bold text-primary">
                    <span>Total Employer Cost to Company (CTC):</span>
                    <span className="text-accent-600 dark:text-accent-400">${simEmployerCost.toFixed(2)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

