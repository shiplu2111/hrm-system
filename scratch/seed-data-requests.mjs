// scratch/seed-data-requests.mjs
import { PrismaClient, DataRequestType, DataRequestStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function seed() {
  const tenants = await prisma.tenant.findMany({ take: 3 });
  const acme = tenants.find((t) => t.subdomain === 'acme') || tenants[0];
  const techflow = tenants.find((t) => t.subdomain === 'techflow') || tenants[1] || tenants[0];
  const sampleEmployees = await prisma.employee.findMany({ take: 3 });
  const now = new Date();

  console.log(`Seeding sample data requests for ${acme.name} & ${techflow?.name}...`);

  // Build legal retention exceptions
  const legalExceptions = [
    {
      category: 'tax_accounting',
      title: 'Tax & Fiscal Accounting Retention',
      statutoryBasis: 'Commercial Code §257 & Statutory Tax Procedures Act §44',
      retentionPeriodYears: 7,
      retainedRecordTypes: [
        'tax_profiles',
        'withholding_summaries',
        'statutory_deduction_ledgers',
        'year_end_tax_statements',
      ],
      retainedRecordCount: 3,
      justification:
        'Statutory financial and tax documentation must be retained for 7 years for government fiscal audits. Cannot be expunged prior to limitation period.',
    },
    {
      category: 'statutory_payroll',
      title: 'Statutory Payroll Journal & Wage Records',
      statutoryBasis: 'Fair Labor Standards Act §11(c) & Employment Standards Act',
      retentionPeriodYears: 7,
      retainedRecordTypes: [
        'gross_to_net_payroll_runs',
        'payslip_ledgers',
        'wage_calculation_records',
        'overtime_journals',
      ],
      retainedRecordCount: 12,
      justification:
        'Historical wage calculation and compensation records preserved in anonymized form to defend potential wage claims and satisfy statutory labor audit obligations.',
    },
    {
      category: 'audit_log',
      title: 'Platform & Tenant Security Audit Trail Immutability',
      statutoryBasis: 'AUDIT_LOG.md §6, SOC 2 Type II Compliance, ISO/IEC 27001 §A.12.4.1',
      retentionPeriodYears: 10,
      retainedRecordTypes: [
        'platform_audit_logs',
        'tenant_audit_logs',
        'authentication_event_records',
      ],
      retainedRecordCount: 14,
      justification:
        'Audit logs are append-only and cryptographically immutable. All system events preserve pseudonymous identifiers to maintain forensic integrity.',
    },
    {
      category: 'pension_benefits',
      title: 'Pension & Statutory Retirement Benefit Accruals',
      statutoryBasis: 'Statutory Pension Vesting Protection Act & ERISA Retention Rules',
      retentionPeriodYears: 10,
      retainedRecordTypes: [
        'pension_accrual_records',
        'provident_fund_ledgers',
        'superannuation_contributions',
      ],
      retainedRecordCount: 1,
      justification:
        'Vesting eligibility and employer contribution records preserved to ensure compliance with lifetime retirement benefit obligations.',
    },
  ];

  // 1. Pending Overdue Request (Critical SLA breach demonstration)
  const emp1 = sampleEmployees[0];
  await prisma.dataRequest.create({
    data: {
      tenantId: acme.id,
      type: DataRequestType.employee_deletion,
      status: DataRequestStatus.pending,
      targetEmployeeId: emp1?.id || null,
      requestedByUserId: '00000000-0000-0000-0000-000000000005',
      requestedByName: 'Aisha Al-Mansoor (DPO Lead)',
      reason: 'Urgent cross-border regulatory erasure request under GDPR Art. 17.',
      deadline: new Date(now.getTime() - 3 * 3600 * 1000 - 24 * 60 * 1000), // Overdue by 3h 24m
    },
  });

  // 2. Pending Urgent Request (Warning SLA - 2 days left)
  await prisma.dataRequest.create({
    data: {
      tenantId: techflow?.id || acme.id,
      type: DataRequestType.tenant_export,
      status: DataRequestStatus.pending,
      requestedByUserId: '00000000-0000-0000-0000-000000000004',
      requestedByName: 'Marcus Brody (Legal Counsel)',
      reason: 'Contract termination portability bundle requested by tenant admin.',
      deadline: new Date(now.getTime() + 2 * 24 * 3600 * 1000 + 5 * 3600 * 1000), // 2 days 5 hours left
    },
  });

  // 3. Pending Nominal Request (28 days left)
  const emp2 = sampleEmployees[1] || sampleEmployees[0];
  await prisma.dataRequest.create({
    data: {
      tenantId: acme.id,
      type: DataRequestType.employee_anonymization,
      status: DataRequestStatus.pending,
      targetEmployeeId: emp2?.id || null,
      requestedByUserId: '00000000-0000-0000-0000-000000000003',
      requestedByName: 'Elena Rostova (Compliance Analyst)',
      reason: 'Standard Right to be Forgotten request submitted via employee self-service portal.',
      deadline: new Date(now.getTime() + 28 * 24 * 3600 * 1000 + 14 * 3600 * 1000), // 28 days left
    },
  });

  // 4. Completed Anonymization Request with Legal Retention Exceptions and Completion Record
  const emp3 = sampleEmployees[2] || sampleEmployees[0];
  const anonCompletedAt = new Date(now.getTime() - 24 * 3600 * 1000);
  const anonCompRecord = {
    completedAt: anonCompletedAt.toISOString(),
    completedByUserId: '00000000-0000-0000-0000-000000000001',
    completedByName: 'Platform Owner',
    summary:
      'Successfully scrubbed PII for employee record. Retained 12 statutory payroll journals and 3 tax profiles under statutory retention exceptions.',
    scrubbedFields: [
      'firstName',
      'lastName',
      'personalInfo',
      'email',
      'phone',
      'address',
      'nationalId',
      'taxId',
      'bankDetails',
    ],
    legalExceptionsApplied: legalExceptions,
    recordsPreservedCount: 15,
    jobId: 'job_anon_acme_init',
    complianceNotes:
      'Verified under GDPR Article 17(3)(b) & (e) and SECURITY.md §9. Immutable audit logs intact per AUDIT_LOG.md §6.',
  };

  await prisma.dataRequest.create({
    data: {
      tenantId: acme.id,
      type: DataRequestType.employee_anonymization,
      status: DataRequestStatus.completed,
      targetEmployeeId: emp3?.id || null,
      requestedByUserId: '00000000-0000-0000-0000-000000000001',
      requestedByName: 'Platform Owner',
      reason: 'Former employee formal right to be forgotten after resignation.',
      deadline: new Date(now.getTime() + 15 * 24 * 3600 * 1000),
      approvedByUserId: '00000000-0000-0000-0000-000000000001',
      approvedByName: 'Platform Owner',
      approvedAt: anonCompletedAt,
      legalRetentionExceptions: legalExceptions,
      completionRecord: anonCompRecord,
      anonymizedSummary: {
        employeeNumber: 'EMP-001',
        scrubbedFields: anonCompRecord.scrubbedFields,
        statutoryPayrollRecordsPreserved: 12,
        taxSummariesRetained: 3,
        auditLogsRetained: true,
        anonymizedAt: anonCompletedAt.toISOString(),
      },
      jobId: 'job_anon_acme_init',
      startedAt: anonCompletedAt,
      completedAt: anonCompletedAt,
    },
  });

  // 5. Rejected Request
  await prisma.dataRequest.create({
    data: {
      tenantId: acme.id,
      type: DataRequestType.employee_deletion,
      status: DataRequestStatus.rejected,
      targetEmployeeId: null,
      requestedByUserId: '00000000-0000-0000-0000-000000000003',
      requestedByName: 'Elena Rostova (Compliance Analyst)',
      reason: 'Unverified third-party consumer request submitted via public form.',
      deadline: new Date(now.getTime() + 10 * 24 * 3600 * 1000),
      rejectedByUserId: '00000000-0000-0000-0000-000000000001',
      rejectedByName: 'Platform Owner',
      rejectedAt: new Date(now.getTime() - 12 * 3600 * 1000),
      rejectionReason:
        'Identity verification failed. Requester could not provide notarized power of attorney or government photo ID.',
    },
  });

  console.log('Seeded 5 sample compliance data requests successfully.');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  prisma.$disconnect();
  process.exit(1);
});
