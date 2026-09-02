import { useState } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Upload,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Filter,
  Play,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ArrowLeft,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { LineChart, BarChart, DonutChart } from '@/components/charts/Charts';
import {
  reportCards,
  scheduledReports,
  exportTemplates,
  type ReportCardItem,
  type ScheduledReport,
  type ExportTemplate,
} from '@/data/reportsData';

export function ReportsHubPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'scheduled' | 'import' | 'export'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Payroll' | 'Attendance' | 'HR & People'>('All');
  const [search, setSearch] = useState('');

  // Report Modal Preview State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportCardItem | null>(null);

  // Schedule Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [schedList, setSchedList] = useState<ScheduledReport[]>(scheduledReports);
  const [schedFrequency, setSchedFrequency] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly'>('Monthly');
  const [schedRecipients, setSchedRecipients] = useState('cfo@acme.com, vp.hr@acme.com');

  // Import Wizard State (4 Steps)
  const [importStep, setImportStep] = useState(1);
  const [importEntity, setImportEntity] = useState('Employee Master Records');
  const [uploadedFileName, setUploadedFileName] = useState('employee_batch_aug2024.csv');
  const [importValidated, setImportValidated] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const filteredReportCards = reportCards.filter((card) => {
    const matchesCat = selectedCategory === 'All' || card.category === selectedCategory;
    const matchesSearch =
      card.title.toLowerCase().includes(search.toLowerCase()) ||
      card.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const openGeneratePreview = (card: ReportCardItem) => {
    setActiveReport(card);
    setPreviewModalOpen(true);
  };

  const openScheduleModal = (card: ReportCardItem) => {
    setActiveReport(card);
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = () => {
    if (!activeReport) return;
    const newSched: ScheduledReport = {
      id: `sr-${Date.now()}`,
      reportName: activeReport.title,
      category: activeReport.category,
      frequency: schedFrequency,
      recipients: schedRecipients.split(',').map((s) => s.trim()),
      nextRun: '2024-09-01 00:00',
      format: activeReport.format,
      status: 'Active',
    };
    setSchedList((prev) => [newSched, ...prev]);
    setScheduleModalOpen(false);
  };

  const toggleScheduleStatus = (id: string) => {
    setSchedList((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'Active' ? 'Paused' : 'Active' } : s
      )
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Reports & Analytics Hub</h1>
          <p className="text-sm text-secondary mt-0.5">
            Real-time analytics, automated scheduled deliveries, and bulk CSV/Excel data import & export.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="surface border border-base rounded-xl p-1 flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'catalog'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Reports Catalog
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'scheduled'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Scheduled Subscriptions ({schedList.length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'import'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <Upload className="h-3.5 w-3.5" /> Data Import Wizard
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'export'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <Download className="h-3.5 w-3.5" /> Export Templates
          </button>
        </div>
      </div>

      {/* TAB 1: REPORTS CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Category Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['All', 'Payroll', 'Attendance', 'HR & People'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedCategory === cat
                      ? 'bg-accent-600 text-white shadow-sm'
                      : 'surface border border-base text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reports by title..."
                className="pl-8 text-xs h-9"
              />
            </div>
          </div>

          {/* Report Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredReportCards.map((report) => (
              <Card
                key={report.id}
                className="hover:shadow-card-hover transition-shadow flex flex-col justify-between overflow-hidden"
              >
                <div>
                  <CardHeader className="pb-2 flex items-start justify-between">
                    <div>
                      <Badge
                        tone={
                          report.category === 'Payroll'
                            ? 'success'
                            : report.category === 'Attendance'
                            ? 'accent'
                            : 'warning'
                        }
                        className="text-[10px]"
                      >
                        {report.category}
                      </Badge>
                      <CardTitle className="text-sm font-bold mt-2 line-clamp-1">
                        {report.title}
                      </CardTitle>
                    </div>
                  </CardHeader>

                  <CardBody className="pt-0 space-y-3">
                    <p className="text-xs text-secondary line-clamp-2 leading-relaxed">
                      {report.description}
                    </p>

                    {/* Miniature Chart Thumbnail Preview */}
                    <div className="h-28 rounded-xl border border-base bg-[rgb(var(--bg-muted))]/40 p-2 flex items-center justify-center overflow-hidden">
                      {report.chartType === 'line' && (
                        <LineChart data={report.chartData} height={95} color="#2563eb" />
                      )}
                      {report.chartType === 'bar' && (
                        <BarChart data={report.chartData} height={95} color="#16a34a" />
                      )}
                      {report.chartType === 'donut' && (
                        <DonutChart data={report.chartData as any} size={90} />
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                      <span>Frequency: <strong className="text-secondary">{report.scheduleFrequency}</strong></span>
                      <span>Format: <strong className="text-primary">{report.format}</strong></span>
                    </div>
                  </CardBody>
                </div>

                {/* Card Actions */}
                <div className="p-4 pt-0 flex items-center gap-2 border-t border-base mt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => openGeneratePreview(report)}
                  >
                    <Play className="h-3.5 w-3.5" /> Generate Now
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openScheduleModal(report)}
                    title="Schedule automated recurring email delivery"
                  >
                    <Clock className="h-3.5 w-3.5" /> Schedule
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULED SUBSCRIPTIONS */}
      {activeTab === 'scheduled' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Automated Scheduled Deliveries</CardTitle>
              <p className="text-xs text-secondary mt-0.5">
                Recurring executive digests delivered via email on schedule.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => openScheduleModal(reportCards[0])}>
              <Plus className="h-3.5 w-3.5" /> New Schedule
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Report Name
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Recipient List
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Next Scheduled Run
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Format
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Active
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {schedList.map((sched) => (
                    <tr key={sched.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-primary">
                        {sched.reportName}
                        <div className="text-xs text-muted font-normal">{sched.category}</div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-primary font-medium">
                        <Badge tone="accent">{sched.frequency}</Badge>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-secondary">
                        <div className="flex flex-wrap gap-1">
                          {sched.recipients.map((r) => (
                            <span key={r} className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-muted))] text-[11px]">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs font-mono text-secondary">
                        {sched.nextRun}
                      </td>

                      <td className="px-5 py-3.5 text-xs font-semibold text-primary">
                        {sched.format}
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge tone={sched.status === 'Active' ? 'success' : 'neutral'} dot>
                          {sched.status}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <Toggle
                          checked={sched.status === 'Active'}
                          onChange={() => toggleScheduleStatus(sched.id)}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* TAB 3: DATA IMPORT WIZARD (4-STEP STEPPER) */}
      {activeTab === 'import' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Stepper Steps */}
          <Card>
            <CardBody className="p-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { step: 1, title: '1. Upload File', desc: 'CSV or Excel' },
                  { step: 2, title: '2. Map Columns', desc: 'Field matching' },
                  { step: 3, title: '3. Validate', desc: 'Syntax & errors' },
                  { step: 4, title: '4. Confirm', desc: 'Execute batch' },
                ].map((s) => (
                  <div
                    key={s.step}
                    onClick={() => setImportStep(s.step)}
                    className={`cursor-pointer p-2 rounded-xl flex flex-col items-center transition-all ${
                      importStep === s.step
                        ? 'bg-accent-50 dark:bg-accent-950/40 border border-accent-500/40 text-accent-700 dark:text-accent-300 font-bold'
                        : importStep > s.step
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-muted'
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                        importStep === s.step
                          ? 'bg-accent-600 text-white'
                          : importStep > s.step
                          ? 'bg-success-600 text-white'
                          : 'bg-[rgb(var(--bg-muted))] text-muted'
                      }`}
                    >
                      {importStep > s.step ? <Check className="h-4 w-4" /> : s.step}
                    </div>
                    <span className="text-xs line-clamp-1">{s.title}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Stepper Body Cards */}
          <Card>
            <CardBody className="p-6">
              {/* STEP 1: Upload */}
              {importStep === 1 && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="text-base font-bold text-primary">Select Target Entity & Upload Spreadsheet</h3>
                    <p className="text-xs text-secondary mt-1">Upload CSV or XLSX file containing bulk records.</p>
                  </div>

                  <div>
                    <Label>Target Data Entity</Label>
                    <Select value={importEntity} onChange={(e) => setImportEntity(e.target.value)}>
                      <option>Employee Master Records</option>
                      <option>Time & Attendance Clock Logs</option>
                      <option>Salary Structure Assignments</option>
                      <option>Leave Balance Allotments</option>
                    </Select>
                  </div>

                  <div className="border-2 border-dashed border-base rounded-2xl p-8 text-center space-y-3 hover:border-accent-500/50 transition-colors">
                    <Upload className="h-10 w-10 text-accent-500 mx-auto" />
                    <div>
                      <div className="text-sm font-semibold text-primary">Drag & drop CSV or Excel file here</div>
                      <div className="text-xs text-muted mt-0.5">Supports .csv, .xlsx, .xls up to 25MB</div>
                    </div>
                    <div className="text-xs font-mono text-accent-600 bg-accent-50 dark:bg-accent-950/40 px-3 py-1.5 rounded-lg inline-block border border-accent-500/30">
                      Uploaded: {uploadedFileName} (142 rows detected)
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Map Columns */}
              {importStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-primary">Step 2: Map File Headers to System Schema</h3>
                      <p className="text-xs text-secondary">Match CSV column headers with HRMS database attributes.</p>
                    </div>
                    <Badge tone="success">9 of 9 Mapped</Badge>
                  </div>

                  <div className="surface border border-base rounded-xl divide-y divide-[rgb(var(--border-base))] text-xs">
                    {[
                      { csvHeader: 'emp_id', systemField: 'Employee ID (Required)', sample: 'EMP-001' },
                      { csvHeader: 'full_name', systemField: 'Full Legal Name (Required)', sample: 'Sarah Chen' },
                      { csvHeader: 'email_addr', systemField: 'Work Email (Required)', sample: 'sarah.chen@acme.com' },
                      { csvHeader: 'dept_name', systemField: 'Department', sample: 'Engineering' },
                      { csvHeader: 'base_pay', systemField: 'Monthly Basic Salary', sample: '$7,500.00' },
                      { csvHeader: 'join_date', systemField: 'Hire Date (YYYY-MM-DD)', sample: '2019-03-15' },
                    ].map((row) => (
                      <div key={row.csvHeader} className="p-3 grid grid-cols-3 items-center gap-2">
                        <span className="font-mono text-primary font-semibold">{row.csvHeader}</span>
                        <span className="text-secondary flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-muted" /> {row.systemField}
                        </span>
                        <span className="text-muted text-right font-mono text-[11px]">Preview: {row.sample}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: Validate */}
              {importStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-primary">Step 3: Validation & Error Detection</h3>
                      <p className="text-xs text-secondary">Automated syntax check across 142 parsed rows.</p>
                    </div>
                    <Badge tone="warning">140 Passed · 2 Warnings</Badge>
                  </div>

                  <div className="surface border border-base rounded-xl overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-[rgb(var(--bg-muted))] border-b border-base">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold text-secondary">Row #</th>
                          <th className="text-left px-4 py-2 font-semibold text-secondary">Employee</th>
                          <th className="text-left px-4 py-2 font-semibold text-secondary">Validation Status</th>
                          <th className="text-left px-4 py-2 font-semibold text-secondary">Resolution Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))]">
                        <tr>
                          <td className="px-4 py-2.5 font-mono text-primary">Row #14</td>
                          <td className="px-4 py-2.5 font-medium">David Kim (EMP-006)</td>
                          <td className="px-4 py-2.5"><Badge tone="success">Valid</Badge></td>
                          <td className="px-4 py-2.5 text-muted">All mandatory fields satisfied.</td>
                        </tr>
                        <tr className="bg-warning-50/20 dark:bg-warning-950/20">
                          <td className="px-4 py-2.5 font-mono text-warning-700 font-bold">Row #32</td>
                          <td className="px-4 py-2.5 font-medium">Alex Rivera</td>
                          <td className="px-4 py-2.5"><Badge tone="warning">Warning</Badge></td>
                          <td className="px-4 py-2.5 text-warning-700 dark:text-warning-300">
                            Date format MM/DD/YYYY auto-converted to ISO standard.
                          </td>
                        </tr>
                        <tr className="bg-warning-50/20 dark:bg-warning-950/20">
                          <td className="px-4 py-2.5 font-mono text-warning-700 font-bold">Row #58</td>
                          <td className="px-4 py-2.5 font-medium">Chloe Taylor</td>
                          <td className="px-4 py-2.5"><Badge tone="warning">Warning</Badge></td>
                          <td className="px-4 py-2.5 text-warning-700 dark:text-warning-300">
                            Missing Emergency Contact (Defaulted to null).
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 4: Confirm */}
              {importStep === 4 && (
                <div className="space-y-6 text-center py-4 max-w-md mx-auto">
                  <div className="h-14 w-14 rounded-2xl bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary">Ready to Execute Import</h3>
                    <p className="text-xs text-secondary mt-1">
                      142 records will be inserted into <strong>{importEntity}</strong>. Audit logs will record this transaction.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => setImportSuccess(true)}
                  >
                    {importSuccess ? '✓ Import Completed (142 Records)' : 'Confirm & Start Import'}
                  </Button>
                </div>
              )}

              {/* Stepper Buttons */}
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-base">
                <Button
                  variant="secondary"
                  disabled={importStep === 1}
                  onClick={() => setImportStep((s) => Math.max(1, s - 1))}
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Button>

                {importStep < 4 && (
                  <Button
                    variant="primary"
                    onClick={() => setImportStep((s) => Math.min(4, s + 1))}
                  >
                    Next Step <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* TAB 4: EXPORT TEMPLATES */}
      {activeTab === 'export' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Data Export Templates</CardTitle>
              <p className="text-xs text-secondary mt-0.5">
                Download structured dataset snapshots in CSV, Excel, or JSON formats.
              </p>
            </div>
            <Badge tone="accent">Encrypted Data Export</Badge>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Entity / Dataset
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Scope Description
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Total Records
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Last Exported
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Export Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {exportTemplates.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-primary">
                        {tpl.entity}
                      </td>

                      <td className="px-5 py-3.5 text-xs text-secondary max-w-md">
                        {tpl.description}
                      </td>

                      <td className="px-5 py-3.5 text-xs font-bold text-primary">
                        {tpl.recordCount.toLocaleString()} rows
                      </td>

                      <td className="px-5 py-3.5 text-xs font-mono text-muted">
                        {tpl.lastExported}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => alert(`Exporting ${tpl.entity} as CSV...`)}
                          >
                            <Download className="h-3.5 w-3.5" /> CSV
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => alert(`Exporting ${tpl.entity} as Excel...`)}
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
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
      )}

      {/* Generate Report Preview Modal */}
      <Modal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title={activeReport ? `Generated: ${activeReport.title}` : 'Report Preview'}
        description={`Category: ${activeReport?.category} · Format: ${activeReport?.format}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreviewModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                alert(`Downloading ${activeReport?.title} (${activeReport?.format})...`);
                setPreviewModalOpen(false);
              }}
            >
              <Download className="h-4 w-4" /> Download {activeReport?.format}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="surface border border-base rounded-xl p-4 bg-[rgb(var(--bg-muted))]/40 space-y-2 text-xs">
            <div className="flex items-center justify-between text-secondary">
              <span>Execution Time:</span>
              <strong className="text-primary font-mono">142ms</strong>
            </div>
            <div className="flex items-center justify-between text-secondary">
              <span>Records Parsed:</span>
              <strong className="text-primary font-mono">1,284 staff</strong>
            </div>
            <div className="flex items-center justify-between text-secondary">
              <span>Filter Scope:</span>
              <strong className="text-primary">All Departments · YTD 2024</strong>
            </div>
          </div>

          <div className="surface border border-base rounded-xl p-3">
            <div className="text-xs font-semibold text-primary mb-2">Visual Summary</div>
            <div className="h-44 flex items-center justify-center">
              {activeReport?.chartType === 'line' && (
                <LineChart data={activeReport.chartData} height={160} color="#2563eb" />
              )}
              {activeReport?.chartType === 'bar' && (
                <BarChart data={activeReport.chartData} height={160} color="#16a34a" />
              )}
              {activeReport?.chartType === 'donut' && (
                <DonutChart data={activeReport.chartData as any} size={150} />
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Automated Report"
        description={`Set up recurring delivery for: ${activeReport?.title || 'Report'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveSchedule}>
              Save Subscription
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Delivery Frequency</Label>
            <Select
              value={schedFrequency}
              onChange={(e) => setSchedFrequency(e.target.value as any)}
            >
              <option value="Daily">Daily (Every morning at 08:00)</option>
              <option value="Weekly">Weekly (Every Monday at 08:00)</option>
              <option value="Monthly">Monthly (1st of month)</option>
              <option value="Quarterly">Quarterly</option>
            </Select>
          </div>

          <div>
            <Label>Recipient Email Addresses (Comma Separated)</Label>
            <Input
              value={schedRecipients}
              onChange={(e) => setSchedRecipients(e.target.value)}
              placeholder="e.g. cfo@acme.com, hr@acme.com"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

