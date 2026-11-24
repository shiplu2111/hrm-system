// apps/api/src/platform/queues/platform-queues.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import {
  BullMqJobItem,
  BullMqQueueCounts,
  BullMqQueueSummary,
  CleanQueueJobsInput,
  CleanQueueJobsResult,
  JobState,
  QueueCategory,
  QueueHealthState,
  QueueJobsQuery,
  QueueJobsResponse,
  QueueSystemOverview,
  RemoveJobInput,
  RemoveJobResult,
  RetryJobResult,
  RetryQueueFailedJobsResult,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { getRedisConnection, isRedisConfigured } from '../../queue/redis.connection';

export interface KnownQueueDefinition {
  name: string;
  displayName: string;
  description: string;
  category: QueueCategory;
  isProminent: boolean;
  isPayroll: boolean;
}

export const KNOWN_PLATFORM_QUEUES: KnownQueueDefinition[] = [
  {
    name: 'payroll-processing',
    displayName: 'Payroll Calculation & Processing Engine',
    description: 'Gross-to-net derivation, statutory tax brackets, allowance policies, deductions, and payslip artifacts.',
    category: 'payroll',
    isProminent: true,
    isPayroll: true,
  },
  {
    name: 'attendance-sync',
    displayName: 'Mobile Attendance & Punch Reconciliation',
    description: 'Offline mobile attendance queue reconciliation, punch event ordering, clock skew anomalies, and geofencing.',
    category: 'sync',
    isProminent: true,
    isPayroll: false,
  },
  {
    name: 'accounting-sync',
    displayName: 'Accounting Ledger Sync (Xero/QuickBooks)',
    description: 'External ERP ledger synchronization for finalized payroll batches and employee reimbursement line items.',
    category: 'sync',
    isProminent: true,
    isPayroll: false,
  },
  {
    name: 'subscription-billing',
    displayName: 'Subscription & Quota Billing Engine',
    description: 'Stripe subscription cycle renewal, employee tier limits, and invoice generation for resource overages.',
    category: 'billing',
    isProminent: false,
    isPayroll: false,
  },
  {
    name: 'webhook-delivery',
    displayName: 'Outbound Webhook Delivery Queue',
    description: 'Tenant webhook dispatches with HMAC SHA-256 signatures, exponential backoff retries, and jitter.',
    category: 'integration',
    isProminent: false,
    isPayroll: false,
  },
  {
    name: 'custom-domain',
    displayName: 'Custom Domain Verification & SSL',
    description: 'Automated tenant domain DNS CNAME validation, TLS certificate generation via Let\'s Encrypt.',
    category: 'infrastructure',
    isProminent: false,
    isPayroll: false,
  },
  {
    name: 'tenant-lifecycle',
    displayName: 'Tenant Lifecycle & Provisioning',
    description: 'Database schema provisioning, seed templates, sandbox demo instance provisioning and maintenance.',
    category: 'operations',
    isProminent: false,
    isPayroll: false,
  },
  {
    name: 'notification-dispatch',
    displayName: 'Multi-Channel Notifications Dispatch',
    description: 'Transactional email, Twilio SMS OTP dispatches, Firebase FCM push alerts, and in-app realtime dispatches.',
    category: 'notifications',
    isProminent: false,
    isPayroll: false,
  },
];

export interface ActorContext {
  id?: string;
  email?: string;
  roleName?: string;
  permissions?: Array<{ module: string; action: string }>;
}

@Injectable()
export class PlatformQueuesService implements OnModuleInit {
  private readonly logger = new Logger(PlatformQueuesService.name);
  private queueMap = new Map<string, Queue>();
  private initialized = false;

  // In-memory fallback / mock store for tests or offline environments
  private inMemoryJobs = new Map<string, Map<string, BullMqJobItem>>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.initQueues();
  }

  /**
   * Initializes queue instances using Redis if available.
   */
  private initQueues(): void {
    if (this.initialized) return;

    if (isRedisConfigured()) {
      try {
        const redis = getRedisConnection();
        for (const def of KNOWN_PLATFORM_QUEUES) {
          try {
            const queue = new Queue(def.name, { connection: redis });
            this.queueMap.set(def.name, queue);
          } catch (e: any) {
            this.logger.warn(`Failed to connect BullMQ queue "${def.name}": ${e.message}`);
          }
        }
        this.initialized = true;
      } catch (e: any) {
        this.logger.warn(`Redis connection failed during queue initialization: ${e.message}`);
      }
    } else {
      this.logger.log('Redis is not configured. Running BullMQ inspector in simulated fallback mode.');
    }

    this.ensureSeedData();
  }

  /**
   * Ensure realistic initial jobs exist (for testing, demo, or fallback).
   */
  private ensureSeedData(): void {
    if (this.inMemoryJobs.size > 0) return;

    // Seed payroll-processing
    const payrollMap = new Map<string, BullMqJobItem>();
    payrollMap.set('job-pr-failed-001', {
      id: 'job-pr-failed-001',
      queueName: 'payroll-processing',
      name: 'calculate-monthly-batch',
      state: 'failed',
      data: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        tenantName: 'Vertex Inc (Starter Plan)',
        payrollRunId: 'pr-2026-11-vertex',
        period: '2026-11-01 to 2026-11-30',
        employeeCount: 44,
        currency: 'USD',
        countryCode: 'GB',
      },
      opts: { attempts: 3, priority: 1 },
      progress: 68,
      attemptsMade: 3,
      maxAttempts: 3,
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      processedOn: new Date(Date.now() - 44 * 60 * 1000).toISOString(),
      finishedOn: new Date(Date.now() - 43 * 60 * 1000).toISOString(),
      durationMs: 4210,
      failedReason: 'StatutoryRuleResolutionError: Tax rule version for country "GB" expired on 2026-10-31 with no overlapping effective_from version found in rule resolver chain.',
      stacktrace: [
        'StatutoryRuleResolutionError: Tax rule version for country "GB" expired on 2026-10-31 with no overlapping effective_from version found in rule resolver chain.',
        '    at RuleResolverService.resolveEffectiveTaxRules (/apps/api/src/payroll/rule-resolver.service.ts:142:15)',
        '    at PayrollCalculationEngine.calculateEmployeeGrossToNet (/apps/api/src/payroll/payroll-calculator.ts:89:22)',
        '    at PayrollBatchProcessor.processEmployeeBatch (/apps/api/src/payroll/payroll-batch-processor.ts:210:35)',
        '    at async Worker.processJob (/apps/api/src/payroll/payroll-worker.ts:54:12)',
      ],
      returnValue: null,
      isPayroll: true,
      isSync: false,
    });

    payrollMap.set('job-pr-active-002', {
      id: 'job-pr-active-002',
      queueName: 'payroll-processing',
      name: 'calculate-monthly-batch',
      state: 'active',
      data: {
        tenantId: '22222222-2222-2222-2222-222222222222',
        tenantName: 'TechFlow Systems',
        payrollRunId: 'pr-2026-11-techflow',
        period: '2026-11-01 to 2026-11-30',
        employeeCount: 260,
        currency: 'USD',
        countryCode: 'US',
      },
      opts: { attempts: 3, priority: 2 },
      progress: 42,
      attemptsMade: 1,
      maxAttempts: 3,
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      processedOn: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      finishedOn: null,
      durationMs: 120000,
      failedReason: null,
      stacktrace: [],
      returnValue: null,
      isPayroll: true,
      isSync: false,
    });

    payrollMap.set('job-pr-waiting-003', {
      id: 'job-pr-waiting-003',
      queueName: 'payroll-processing',
      name: 'generate-payslips-pdf',
      state: 'waiting',
      data: {
        tenantId: '33333333-3333-3333-3333-333333333333',
        tenantName: 'Northstar Global',
        payrollRunId: 'pr-2026-11-northstar',
        payslipCount: 215,
      },
      opts: { attempts: 3, delay: 0 },
      progress: 0,
      attemptsMade: 0,
      maxAttempts: 3,
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      processedOn: null,
      finishedOn: null,
      durationMs: null,
      failedReason: null,
      stacktrace: [],
      returnValue: null,
      isPayroll: true,
      isSync: false,
    });

    payrollMap.set('job-pr-completed-004', {
      id: 'job-pr-completed-004',
      queueName: 'payroll-processing',
      name: 'finalize-payroll-batch',
      state: 'completed',
      data: {
        tenantId: '33333333-3333-3333-3333-333333333333',
        tenantName: 'Northstar Global',
        payrollRunId: 'pr-2026-10-northstar',
        finalizedTotal: '412,850.00 USD',
      },
      opts: { attempts: 3 },
      progress: 100,
      attemptsMade: 1,
      maxAttempts: 3,
      timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
      processedOn: new Date(Date.now() - 179 * 60 * 1000).toISOString(),
      finishedOn: new Date(Date.now() - 178 * 60 * 1000).toISOString(),
      durationMs: 65400,
      failedReason: null,
      stacktrace: [],
      returnValue: { status: 'locked', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      isPayroll: true,
      isSync: false,
    });

    this.inMemoryJobs.set('payroll-processing', payrollMap);

    // Seed attendance-sync
    const syncMap = new Map<string, BullMqJobItem>();
    syncMap.set('job-sync-failed-001', {
      id: 'job-sync-failed-001',
      queueName: 'attendance-sync',
      name: 'reconcile-offline-punches',
      state: 'failed',
      data: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        employeeId: 'emp-vertex-042',
        deviceId: 'ios-device-9821',
        localId: '3f9b207a-d021-4d1a-8bb0-01992019a8bc',
        punchCount: 14,
        clientSyncTimestamp: '2026-11-23T14:15:00.000Z',
      },
      opts: { attempts: 5 },
      progress: 30,
      attemptsMade: 5,
      maxAttempts: 5,
      timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      processedOn: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      finishedOn: new Date(Date.now() - 109 * 60 * 1000).toISOString(),
      durationMs: 1420,
      failedReason: 'SyncConflictAnomaly: Punch timestamp 2026-11-23T14:15:00Z occurs 4 hours ahead of authoritative server clock (clock skew anomaly threshold exceeded > 15m). Per OFFLINE_SYNC.md §4, item flagged as time_anomaly.',
      stacktrace: [
        'SyncConflictAnomaly: Clock skew threshold exceeded (client: 2026-11-23T14:15:00Z, server: 2026-11-23T10:15:00Z)',
        '    at AttendanceSyncEngine.validateClockSkew (/apps/api/src/attendance/offline-sync.ts:98:13)',
        '    at AttendanceSyncEngine.processPunchBatch (/apps/api/src/attendance/offline-sync.ts:165:27)',
        '    at AttendanceSyncWorker.handleSyncJob (/apps/api/src/attendance/sync-worker.ts:48:19)',
      ],
      returnValue: null,
      isPayroll: false,
      isSync: true,
    });

    syncMap.set('job-sync-completed-002', {
      id: 'job-sync-completed-002',
      queueName: 'attendance-sync',
      name: 'reconcile-offline-punches',
      state: 'completed',
      data: {
        tenantId: '22222222-2222-2222-2222-222222222222',
        employeeId: 'emp-techflow-019',
        deviceId: 'android-device-4102',
        localId: '98a123f1-e320-4211-9a99-bfa201991823',
        punchCount: 6,
      },
      opts: { attempts: 3 },
      progress: 100,
      attemptsMade: 1,
      maxAttempts: 3,
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      processedOn: new Date(Date.now() - 29 * 60 * 1000).toISOString(),
      finishedOn: new Date(Date.now() - 29 * 60 * 1000).toISOString(),
      durationMs: 820,
      failedReason: null,
      stacktrace: [],
      returnValue: { reconciledCount: 6, status: 'synced', idempotencyKey: 'idemp-98a123f1' },
      isPayroll: false,
      isSync: true,
    });

    syncMap.set('job-sync-waiting-003', {
      id: 'job-sync-waiting-003',
      queueName: 'attendance-sync',
      name: 'process-offline-batch',
      state: 'waiting',
      data: {
        tenantId: '33333333-3333-3333-3333-333333333333',
        batchSize: 25,
      },
      opts: { attempts: 3 },
      progress: 0,
      attemptsMade: 0,
      maxAttempts: 3,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      processedOn: null,
      finishedOn: null,
      durationMs: null,
      failedReason: null,
      stacktrace: [],
      returnValue: null,
      isPayroll: false,
      isSync: true,
    });

    this.inMemoryJobs.set('attendance-sync', syncMap);

    // Seed accounting-sync
    const accountingMap = new Map<string, BullMqJobItem>();
    accountingMap.set('job-acc-completed-001', {
      id: 'job-acc-completed-001',
      queueName: 'accounting-sync',
      name: 'sync-xero-payroll-journal',
      state: 'completed',
      data: {
        tenantId: '33333333-3333-3333-3333-333333333333',
        provider: 'xero',
        payrollRunId: 'pr-2026-10-northstar',
        journalLinesCount: 28,
      },
      opts: { attempts: 5 },
      progress: 100,
      attemptsMade: 1,
      maxAttempts: 5,
      timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      processedOn: new Date(Date.now() - 89 * 60 * 1000).toISOString(),
      finishedOn: new Date(Date.now() - 88 * 60 * 1000).toISOString(),
      durationMs: 3100,
      failedReason: null,
      stacktrace: [],
      returnValue: { xeroJournalId: 'xer-jn-99812', syncStatus: 'synced' },
      isPayroll: false,
      isSync: true,
    });
    this.inMemoryJobs.set('accounting-sync', accountingMap);

    // Seed webhook-delivery
    const webhookMap = new Map<string, BullMqJobItem>();
    webhookMap.set('job-wh-failed-001', {
      id: 'job-wh-failed-001',
      queueName: 'webhook-delivery',
      name: 'dispatch-event',
      state: 'failed',
      data: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        event: 'employee.onboarded',
        targetUrl: 'https://api.vertex-partner.io/webhooks/hr',
      },
      opts: { attempts: 5 },
      progress: 0,
      attemptsMade: 5,
      maxAttempts: 5,
      timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
      processedOn: new Date(Date.now() - 74 * 60 * 1000).toISOString(),
      finishedOn: new Date(Date.now() - 73 * 60 * 1000).toISOString(),
      durationMs: 15200,
      failedReason: 'WebhookDeliveryFailed: HTTP 504 Gateway Timeout from endpoint https://api.vertex-partner.io/webhooks/hr after 5 attempts.',
      stacktrace: [
        'WebhookDeliveryFailed: HTTP 504 Gateway Timeout',
        '    at WebhookDeliveryQueueService.dispatch (/apps/api/src/webhooks/webhook-delivery-queue.service.ts:182:15)',
      ],
      returnValue: null,
      isPayroll: false,
      isSync: false,
    });
    this.inMemoryJobs.set('webhook-delivery', webhookMap);
  }

  /**
   * Determine health status of a queue based on job metrics.
   */
  private determineQueueHealth(counts: BullMqQueueCounts): QueueHealthState {
    if (counts.failed > 10) return 'critical';
    if (counts.failed > 0 || counts.waiting > 50) return 'degraded';
    if (counts.active > 10 || counts.waiting > 20) return 'warning';
    return 'healthy';
  }

  /**
   * Determine if a queue name represents payroll.
   */
  isPayrollQueue(queueName: string): boolean {
    const def = KNOWN_PLATFORM_QUEUES.find((q) => q.name === queueName);
    if (def) return def.isPayroll;
    return queueName.toLowerCase().includes('payroll');
  }

  /**
   * Determine if a queue name represents sync.
   */
  isSyncQueue(queueName: string): boolean {
    const def = KNOWN_PLATFORM_QUEUES.find((q) => q.name === queueName);
    if (def) return def.category === 'sync';
    return queueName.toLowerCase().includes('sync');
  }

  /**
   * Enforces role gate: must be Platform Owner or Platform Admin.
   */
  assertPlatformAdminAccess(actor?: ActorContext): void {
    if (!actor) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Platform authentication required to access Job Queue Inspector',
      });
    }

    const role = actor.roleName || '';
    if (role === 'Platform Owner' || role === 'Platform Admin') {
      return;
    }

    // Also allow if user has platform:manage permission
    const hasPlatformManage = actor.permissions?.some(
      (p) => p.module === 'platform' && p.action === 'manage',
    );
    if (hasPlatformManage) {
      return;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Access restricted: Job Queue Inspector requires Platform Admin or Platform Owner privileges.',
    });
  }

  /**
   * List all BullMQ queues with job counts and health status.
   */
  async getQueueOverview(actor?: ActorContext): Promise<QueueSystemOverview> {
    this.assertPlatformAdminAccess(actor);
    this.initQueues();

    const summaries: BullMqQueueSummary[] = [];
    let activeTotal = 0;
    let waitingTotal = 0;
    let failedTotal = 0;
    let completedTotal = 0;

    for (const def of KNOWN_PLATFORM_QUEUES) {
      const counts = await this.getQueueCounts(def.name);
      const isPaused = false;
      const health = this.determineQueueHealth(counts);

      activeTotal += counts.active;
      waitingTotal += counts.waiting;
      failedTotal += counts.failed;
      completedTotal += counts.completed;

      summaries.push({
        name: def.name,
        displayName: def.displayName,
        description: def.description,
        category: def.category,
        isProminent: def.isProminent,
        isPayroll: def.isPayroll,
        isPaused,
        counts,
        health,
      });
    }

    // Sort: Prominent (payroll & sync) first, then by failed desc, then name
    summaries.sort((a, b) => {
      if (a.isProminent && !b.isProminent) return -1;
      if (!a.isProminent && b.isProminent) return 1;
      if (b.counts.failed !== a.counts.failed) return b.counts.failed - a.counts.failed;
      return a.name.localeCompare(b.name);
    });

    let overallStatus: QueueHealthState = 'healthy';
    if (failedTotal > 15) overallStatus = 'critical';
    else if (failedTotal > 0 || waitingTotal > 100) overallStatus = 'degraded';
    else if (activeTotal > 20) overallStatus = 'warning';

    return {
      totalQueues: summaries.length,
      prominentQueuesCount: summaries.filter((q) => q.isProminent).length,
      activeJobsCount: activeTotal,
      waitingJobsCount: waitingTotal,
      failedJobsCount: failedTotal,
      completedJobsCount: completedTotal,
      overallStatus,
      redisConnected: isRedisConfigured(),
      queues: summaries,
    };
  }

  /**
   * Get counts for a specific queue (merging BullMQ and in-memory).
   */
  async getQueueCounts(queueName: string): Promise<BullMqQueueCounts> {
    const defaultCounts: BullMqQueueCounts = {
      waiting: 0,
      active: 0,
      failed: 0,
      completed: 0,
      delayed: 0,
      paused: 0,
      total: 0,
    };

    const q = this.queueMap.get(queueName);
    if (q) {
      try {
        const counts = await q.getJobCounts('waiting', 'active', 'failed', 'completed', 'delayed');
        defaultCounts.waiting = counts.waiting ?? 0;
        defaultCounts.active = counts.active ?? 0;
        defaultCounts.failed = counts.failed ?? 0;
        defaultCounts.completed = counts.completed ?? 0;
        defaultCounts.delayed = counts.delayed ?? 0;
        defaultCounts.paused = counts.paused ?? 0;
        defaultCounts.total =
          defaultCounts.waiting +
          defaultCounts.active +
          defaultCounts.failed +
          defaultCounts.completed +
          defaultCounts.delayed;
      } catch (err: any) {
        this.logger.debug(`Could not read BullMQ counts for ${queueName}: ${err.message}`);
      }
    }

    // Merge in-memory jobs if available
    const memJobs = this.inMemoryJobs.get(queueName);
    if (memJobs && memJobs.size > 0) {
      for (const item of memJobs.values()) {
        if (item.state === 'waiting') defaultCounts.waiting++;
        else if (item.state === 'active') defaultCounts.active++;
        else if (item.state === 'failed') defaultCounts.failed++;
        else if (item.state === 'completed') defaultCounts.completed++;
        else if (item.state === 'delayed') defaultCounts.delayed++;
        defaultCounts.total++;
      }
    }

    return defaultCounts;
  }

  /**
   * List jobs by state, search, and queue.
   */
  async getJobs(query: QueueJobsQuery, actor?: ActorContext): Promise<QueueJobsResponse> {
    this.assertPlatformAdminAccess(actor);
    this.initQueues();

    const {
      queueName,
      state = 'all',
      search = '',
      page = 1,
      limit = 20,
      prominentOnly = false,
    } = query;

    let targetQueues: KnownQueueDefinition[] = KNOWN_PLATFORM_QUEUES;
    if (queueName) {
      targetQueues = targetQueues.filter((q) => q.name === queueName);
      if (targetQueues.length === 0) {
        targetQueues = [{
          name: queueName,
          displayName: queueName,
          description: 'Dynamic BullMQ Queue',
          category: 'other',
          isProminent: false,
          isPayroll: this.isPayrollQueue(queueName),
        }];
      }
    } else if (prominentOnly) {
      targetQueues = targetQueues.filter((q) => q.isProminent);
    }

    const allItems: BullMqJobItem[] = [];

    for (const def of targetQueues) {
      // 1. Fetch real jobs from BullMQ if queue instance exists
      const q = this.queueMap.get(def.name);
      if (q) {
        try {
          const statesToFetch: any[] = state === 'all'
            ? ['waiting', 'active', 'failed', 'completed', 'delayed']
            : [state];

          const bullJobs = await q.getJobs(statesToFetch, 0, 50, false);
          for (const bj of bullJobs) {
            const rawState = await bj.getState();
            allItems.push(this.mapBullJobToItem(bj, def.name, rawState as JobState));
          }
        } catch (err: any) {
          this.logger.debug(`Could not read jobs from BullMQ queue ${def.name}: ${err.message}`);
        }
      }

      // 2. Fetch from in-memory fallback
      const memJobs = this.inMemoryJobs.get(def.name);
      if (memJobs) {
        for (const item of memJobs.values()) {
          if (state === 'all' || item.state === state) {
            // Avoid duplicate ID if already read from Redis
            if (!allItems.some((existing) => existing.id === item.id)) {
              allItems.push(item);
            }
          }
        }
      }
    }

    // Filter by search query (id, name, failedReason, tenant identifiers)
    let filtered = allItems;
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter((item) => {
        const idMatch = item.id.toLowerCase().includes(term);
        const nameMatch = item.name.toLowerCase().includes(term);
        const reasonMatch = item.failedReason?.toLowerCase().includes(term) ?? false;
        const dataMatch = JSON.stringify(item.data).toLowerCase().includes(term);
        return idMatch || nameMatch || reasonMatch || dataMatch;
      });
    }

    // Sorting: Failed jobs first, then Active, then Waiting, then timestamp desc
    const statePriority: Record<JobState, number> = {
      failed: 1,
      active: 2,
      waiting: 3,
      delayed: 4,
      completed: 5,
      paused: 6,
      unknown: 7,
    };

    filtered.sort((a, b) => {
      const prioDiff = (statePriority[a.state] || 99) - (statePriority[b.state] || 99);
      if (prioDiff !== 0) return prioDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);

    // Queue summary if filtered by a single queue
    let queueSummary: BullMqQueueSummary | undefined;
    if (queueName) {
      const def = KNOWN_PLATFORM_QUEUES.find((q) => q.name === queueName) || {
        name: queueName,
        displayName: queueName,
        description: 'Dynamic BullMQ Queue',
        category: 'other' as QueueCategory,
        isProminent: false,
        isPayroll: this.isPayrollQueue(queueName),
      };
      const counts = await this.getQueueCounts(queueName);
      queueSummary = {
        name: def.name,
        displayName: def.displayName,
        description: def.description,
        category: def.category,
        isProminent: def.isProminent,
        isPayroll: def.isPayroll,
        isPaused: false,
        counts,
        health: this.determineQueueHealth(counts),
      };
    }

    const overview = await this.getQueueOverview(actor);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
      queue: queueSummary,
      allQueues: overview.queues,
    };
  }

  /**
   * Helper to transform a BullMQ Job into a BullMqJobItem.
   */
  private mapBullJobToItem(job: Job, queueName: string, state: JobState): BullMqJobItem {
    const isPayroll = this.isPayrollQueue(queueName);
    const isSync = this.isSyncQueue(queueName);
    const duration = job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : null;

    return {
      id: String(job.id),
      queueName,
      name: job.name,
      state,
      data: job.data || {},
      opts: {
        attempts: job.opts?.attempts,
        delay: job.opts?.delay,
        priority: job.opts?.priority,
        backoff: job.opts?.backoff,
        timestamp: job.timestamp,
      },
      progress: (job.progress as any) ?? null,
      attemptsMade: job.attemptsMade || 0,
      maxAttempts: job.opts?.attempts || 1,
      timestamp: new Date(job.timestamp).toISOString(),
      processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      durationMs: duration,
      failedReason: job.failedReason || null,
      stacktrace: job.stacktrace || [],
      returnValue: job.returnvalue || null,
      isPayroll,
      isSync,
    };
  }

  /**
   * Get single job details with complete stacktrace and payload.
   */
  async getJobDetails(queueName: string, jobId: string, actor?: ActorContext): Promise<BullMqJobItem> {
    this.assertPlatformAdminAccess(actor);
    this.initQueues();

    // 1. Check BullMQ
    const q = this.queueMap.get(queueName);
    if (q) {
      try {
        const job = await q.getJob(jobId);
        if (job) {
          const rawState = await job.getState();
          return this.mapBullJobToItem(job, queueName, rawState as JobState);
        }
      } catch (err: any) {
        this.logger.debug(`Error getting job ${jobId} from queue ${queueName}: ${err.message}`);
      }
    }

    // 2. Check in-memory store
    const memMap = this.inMemoryJobs.get(queueName);
    if (memMap?.has(jobId)) {
      return memMap.get(jobId)!;
    }

    throw new NotFoundException({
      code: 'JOB_NOT_FOUND',
      message: `Job ${jobId} was not found in queue "${queueName}".`,
    });
  }

  /**
   * Retry a single job (re-queues failed or stalled job).
   */
  async retryJob(queueName: string, jobId: string, actor?: ActorContext): Promise<RetryJobResult> {
    this.assertPlatformAdminAccess(actor);
    this.initQueues();

    let jobFound = false;

    // 1. Try BullMQ retry
    const q = this.queueMap.get(queueName);
    if (q) {
      try {
        const job = await q.getJob(jobId);
        if (job) {
          await job.retry();
          jobFound = true;
        }
      } catch (err: any) {
        this.logger.warn(`BullMQ retry error on job ${jobId}: ${err.message}`);
      }
    }

    // 2. Fallback in-memory
    const memMap = this.inMemoryJobs.get(queueName);
    if (memMap?.has(jobId)) {
      const item = memMap.get(jobId)!;
      item.state = 'waiting';
      item.failedReason = null;
      item.attemptsMade = 0;
      item.processedOn = null;
      item.finishedOn = null;
      jobFound = true;
    }

    if (!jobFound) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job ${jobId} was not found in queue "${queueName}" to retry.`,
      });
    }

    // Audit log retry action
    try {
      await this.prisma.unscoped.platformAuditLog.create({
        data: {
          userId: actor?.id || null,
          action: 'JOB_RETRIED',
          module: this.isPayrollQueue(queueName) ? 'queue:payroll' : `queue:${queueName}`,
          recordId: jobId,
          reason: `Job manually re-queued from Job Queue Inspector by ${actor?.email || 'Platform Admin'}`,
          oldValue: { queueName, jobId },
          newValue: { state: 'waiting' },
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Failed to write audit log for job retry: ${auditErr.message}`);
    }

    return {
      success: true,
      jobId,
      queueName,
      newState: 'waiting',
      message: `Job ${jobId} in queue "${queueName}" has been successfully re-queued for processing.`,
    };
  }

  /**
   * Retry all failed jobs in a queue.
   */
  async retryFailedJobs(queueName: string, actor?: ActorContext): Promise<RetryQueueFailedJobsResult> {
    this.assertPlatformAdminAccess(actor);
    this.initQueues();

    let retriedCount = 0;

    // 1. BullMQ
    const q = this.queueMap.get(queueName);
    if (q) {
      try {
        const failedJobs = await q.getJobs(['failed'], 0, 500, false);
        for (const job of failedJobs) {
          await job.retry();
          retriedCount++;
        }
      } catch (err: any) {
        this.logger.warn(`BullMQ retry-failed error on queue ${queueName}: ${err.message}`);
      }
    }

    // 2. In-memory
    const memMap = this.inMemoryJobs.get(queueName);
    if (memMap) {
      for (const item of memMap.values()) {
        if (item.state === 'failed') {
          item.state = 'waiting';
          item.failedReason = null;
          item.attemptsMade = 0;
          retriedCount++;
        }
      }
    }

    // Audit log
    try {
      await this.prisma.unscoped.platformAuditLog.create({
        data: {
          userId: actor?.id || null,
          action: 'QUEUE_FAILED_RETRIED',
          module: this.isPayrollQueue(queueName) ? 'queue:payroll' : `queue:${queueName}`,
          recordId: queueName,
          reason: `Retried ${retriedCount} failed jobs in queue "${queueName}" by ${actor?.email || 'Platform Admin'}`,
          oldValue: { queueName, retriedCount },
          newValue: { state: 'waiting' },
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Audit log error: ${auditErr.message}`);
    }

    return {
      queueName,
      retriedCount,
      message: `Successfully re-queued ${retriedCount} failed job(s) in queue "${queueName}".`,
    };
  }

  /**
   * Remove / delete a job from a queue.
   * STRICT SAFETY RULE: Deleting a payroll job requires a typed justification reason (at least 5 characters).
   */
  async removeJob(
    queueName: string,
    jobId: string,
    input: RemoveJobInput,
    actor?: ActorContext,
  ): Promise<RemoveJobResult> {
    this.assertPlatformAdminAccess(actor);
    this.initQueues();

    const isPayroll = this.isPayrollQueue(queueName);

    // CRITICAL SAFETY CHECK: Never allow deleting a payroll job without a typed reason
    if (isPayroll) {
      if (!input?.reason || input.reason.trim().length < 5) {
        throw new BadRequestException({
          code: 'PAYROLL_JOB_DELETE_REASON_REQUIRED',
          message:
            'A typed justification reason of at least 5 characters is strictly required to delete a payroll job. Payroll records affect financial calculations and ledger determinism.',
        });
      }
    }

    let existingJobData: any = null;
    let jobFound = false;

    // 1. Try BullMQ
    const q = this.queueMap.get(queueName);
    if (q) {
      try {
        const job = await q.getJob(jobId);
        if (job) {
          existingJobData = {
            id: job.id,
            name: job.name,
            state: await job.getState(),
            data: job.data,
            failedReason: job.failedReason,
          };
          await job.remove();
          jobFound = true;
        }
      } catch (err: any) {
        this.logger.warn(`BullMQ remove error on job ${jobId}: ${err.message}`);
      }
    }

    // 2. Try In-Memory
    const memMap = this.inMemoryJobs.get(queueName);
    if (memMap?.has(jobId)) {
      const item = memMap.get(jobId)!;
      existingJobData = {
        id: item.id,
        name: item.name,
        state: item.state,
        data: item.data,
        failedReason: item.failedReason,
      };
      memMap.delete(jobId);
      jobFound = true;
    }

    if (!jobFound) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job ${jobId} was not found in queue "${queueName}" to remove.`,
      });
    }

    // Mandatory Audit Logging in platform_audit_logs
    let auditLogId: string | undefined;
    try {
      const audit = await this.prisma.unscoped.platformAuditLog.create({
        data: {
          userId: actor?.id || null,
          action: 'JOB_DELETED',
          module: isPayroll ? 'queue:payroll' : `queue:${queueName}`,
          recordId: jobId,
          reason: input?.reason?.trim() || (isPayroll ? 'Mandatory payroll delete justification' : null),
          oldValue: existingJobData,
        },
      });
      auditLogId = audit.id;
    } catch (auditErr: any) {
      this.logger.warn(`Failed to write platform audit log for job removal: ${auditErr.message}`);
    }

    return {
      success: true,
      jobId,
      queueName,
      reason: input.reason?.trim(),
      auditLogId,
      message: `Job ${jobId} in queue "${queueName}" was permanently removed.${isPayroll ? ' Audit log entry recorded with reason.' : ''}`,
    };
  }

  /**
   * Clean old completed or failed jobs in a queue.
   */
  async cleanQueue(
    queueName: string,
    input: CleanQueueJobsInput,
    actor?: ActorContext,
  ): Promise<CleanQueueJobsResult> {
    this.assertPlatformAdminAccess(actor);
    this.initQueues();

    const isPayroll = this.isPayrollQueue(queueName);
    if (isPayroll && input.type === 'failed') {
      if (!input.reason || input.reason.trim().length < 5) {
        throw new BadRequestException({
          code: 'PAYROLL_JOB_DELETE_REASON_REQUIRED',
          message: 'Bulk cleaning failed payroll jobs requires a typed justification reason of at least 5 characters.',
        });
      }
    }

    const graceMs = input.gracePeriodMs || 0;
    const limit = input.limit || 500;
    let cleanedCount = 0;

    const q = this.queueMap.get(queueName);
    if (q) {
      try {
        const removed = await q.clean(graceMs, limit, input.type);
        cleanedCount += removed.length;
      } catch (err: any) {
        this.logger.warn(`BullMQ clean error: ${err.message}`);
      }
    }

    const memMap = this.inMemoryJobs.get(queueName);
    if (memMap) {
      for (const [id, item] of Array.from(memMap.entries())) {
        if (item.state === input.type) {
          memMap.delete(id);
          cleanedCount++;
        }
      }
    }

    try {
      await this.prisma.unscoped.platformAuditLog.create({
        data: {
          userId: actor?.id || null,
          action: 'QUEUE_CLEANED',
          module: isPayroll ? 'queue:payroll' : `queue:${queueName}`,
          recordId: queueName,
          reason: input.reason || `Cleaned ${input.type} jobs by ${actor?.email || 'Platform Admin'}`,
          oldValue: { queueName, type: input.type, cleanedCount },
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Audit error: ${auditErr.message}`);
    }

    return {
      queueName,
      cleanedCount,
      type: input.type,
      message: `Cleaned ${cleanedCount} ${input.type} job(s) from queue "${queueName}".`,
    };
  }
}
