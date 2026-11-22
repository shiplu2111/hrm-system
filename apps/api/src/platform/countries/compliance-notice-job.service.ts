import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type {
  ComplianceDueDateRule,
  ComplianceNoticeGeneratedItem,
  ComplianceNoticeJobRunInput,
  ComplianceNoticeJobRunResult,
  ComplianceNoticeView,
  ComplianceRecurrence,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { NotificationEngineService } from '../../notifications/notification-engine.service';
import { buildComplianceDeadlineVariables } from '../../notifications/notification.helpers';
import {
  formatDateUtc,
  parseDateUtc,
  resolveNextDueDate,
} from './compliance-calendar.utils';

@Injectable()
export class ComplianceNoticeJobService {
  private readonly logger = new Logger(ComplianceNoticeJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  /**
   * Daily automated scan for upcoming statutory compliance deadlines (MODULES.md §02).
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleDailyCron(): Promise<void> {
    try {
      this.logger.log('Starting daily compliance calendar deadline notice job...');
      const result = await this.runNoticeJob();
      this.logger.log(
        `Compliance calendar notice job completed: scanned ${result.scannedEventsCount} event(s), generated ${result.noticesGeneratedCount} notice(s), skipped ${result.skippedExistingCount} existing.`,
      );
    } catch (err: any) {
      this.logger.error('Error executing daily compliance calendar cron job', err?.stack);
    }
  }

  /**
   * Evaluates all active compliance events against target asOfDate and generates upcoming notices.
   * Can be triggered on-demand via API or automated daily by Cron.
   */
  async runNoticeJob(
    input?: ComplianceNoticeJobRunInput,
  ): Promise<ComplianceNoticeJobRunResult> {
    const asOfDate = input?.asOfDate || formatDateUtc(new Date());
    const countryFilter = input?.countryId;

    const result: ComplianceNoticeJobRunResult = {
      asOfDate,
      scannedEventsCount: 0,
      eligibleTenantsCount: 0,
      noticesGeneratedCount: 0,
      skippedExistingCount: 0,
      generatedNotices: [],
      errors: [],
    };

    // 1. Fetch active compliance events
    const events = await this.prisma.unscoped.complianceEvent.findMany({
      where: {
        status: 'active',
        ...(countryFilter ? { countryId: countryFilter } : {}),
      },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        stateProvince: { select: { id: true, name: true, code: true } },
      },
    });

    result.scannedEventsCount = events.length;

    // 2. Evaluate each event for upcoming due date
    for (const event of events) {
      try {
        const nextDue = resolveNextDueDate(
          event.recurrence as ComplianceRecurrence,
          event.dueDateRule as ComplianceDueDateRule,
          asOfDate,
          event.noticeDaysBefore,
        );

        if (!nextDue || !nextDue.isNoticeDue) {
          // Event is not within its notice window relative to asOfDate
          continue;
        }

        // 3. Find matching active companies & tenants for this country & state
        const companies = await this.prisma.unscoped.company.findMany({
          where: {
            countryId: event.countryId,
            tenant: {
              status: 'active',
              deletedAt: null,
            },
            ...(event.stateProvinceId ? { stateProvinceId: event.stateProvinceId } : {}),
          },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                planId: true,
                status: true,
              },
            },
          },
        });

        for (const company of companies) {
          const tenant = company.tenant;
          result.eligibleTenantsCount++;

          // Check plan applicability filter (if specified on the event)
          if (
            event.applicablePlans &&
            event.applicablePlans.length > 0 &&
            tenant.planId &&
            !event.applicablePlans.includes(tenant.planId)
          ) {
            continue;
          }

          const dueDateObj = parseDateUtc(nextDue.dueDate);

          // 4. Check idempotency: check if notice was already generated for this (tenantId, eventId, dueDate)
          const existingNotice =
            await this.prisma.unscoped.complianceEventNotice.findUnique({
              where: {
                tenantId_complianceEventId_dueDate: {
                  tenantId: tenant.id,
                  complianceEventId: event.id,
                  dueDate: dueDateObj,
                },
              },
            });

          if (existingNotice) {
            result.skippedExistingCount++;
            continue;
          }

          // 5. Resolve recipient users in the tenant (HR Admins or Tenant Staff)
          const tenantUsers = await this.prisma.unscoped.user.findMany({
            where: {
              tenantId: tenant.id,
              isActive: true,
            },
            select: {
              id: true,
              email: true,
              employeeId: true,
              role: { select: { name: true } },
            },
          });

          // Prefer HR Admin / Company Admin / Tenant Owner users
          const targetUsers =
            tenantUsers.filter((u) => {
              const roleName = (u.role?.name || '').toLowerCase();
              return (
                roleName.includes('admin') ||
                roleName.includes('owner') ||
                roleName.includes('hr') ||
                roleName.includes('compliance')
              );
            });

          const recipientUserIds = (
            targetUsers.length > 0 ? targetUsers : tenantUsers
          ).map((u) => u.id);

          const fallbackEmployeeId =
            tenantUsers.find((u) => u.employeeId)?.employeeId ||
            (await this.findAnyTenantEmployeeId(tenant.id)) ||
            tenant.id;

          // 6. Emit through Notification Engine (Phase 1 Stage 9)
          await this.notificationEngine.emit({
            tenantId: tenant.id,
            companyId: company.id,
            eventType: 'compliance.deadline.upcoming',
            subjectEmployeeId: fallbackEmployeeId,
            directUserIds: recipientUserIds.length > 0 ? recipientUserIds : undefined,
            variables: buildComplianceDeadlineVariables({
              eventTitle: event.title,
              dueDate: nextDue.dueDate,
              daysRemaining: nextDue.daysRemaining,
              actionRequired: event.actionRequired || undefined,
              sourceReference: event.sourceReference || undefined,
            }),
            payload: {
              complianceEventId: event.id,
              dueDate: nextDue.dueDate,
              daysRemaining: nextDue.daysRemaining,
              category: event.category,
              sourceReference: event.sourceReference,
              filingPortalUrl: event.filingPortalUrl,
              penaltiesSummary: event.penaltiesSummary,
              actionRequired: event.actionRequired,
            },
          });

          // 7. Persist notice tracking record for idempotency and tenant compliance inbox
          await this.prisma.unscoped.complianceEventNotice.create({
            data: {
              tenantId: tenant.id,
              companyId: company.id,
              complianceEventId: event.id,
              dueDate: dueDateObj,
              noticeDate: parseDateUtc(asOfDate),
              daysRemaining: nextDue.daysRemaining,
              status: 'sent',
            },
          });

          result.noticesGeneratedCount++;
          result.generatedNotices.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            companyId: company.id,
            companyName: company.name,
            eventId: event.id,
            eventTitle: event.title,
            dueDate: nextDue.dueDate,
            daysRemaining: nextDue.daysRemaining,
          });
        }
      } catch (eventErr: any) {
        const msg = `Failed processing event "${event.title}" (${event.id}): ${eventErr?.message}`;
        this.logger.error(msg, eventErr?.stack);
        result.errors.push(msg);
      }
    }

    return result;
  }

  /**
   * List compliance notices for a specific tenant and optional company.
   */
  async getTenantComplianceNotices(
    tenantId: string,
    companyId?: string,
  ): Promise<ComplianceNoticeView[]> {
    const notices = await this.prisma.unscoped.complianceEventNotice.findMany({
      where: {
        tenantId,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        complianceEvent: true,
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return notices.map((n) => ({
      id: n.id,
      tenantId: n.tenantId,
      companyId: n.companyId,
      companyName: n.company?.name || '',
      complianceEventId: n.complianceEventId,
      title: n.complianceEvent?.title || 'Compliance Deadline',
      description: n.complianceEvent?.description || null,
      category: (n.complianceEvent?.category as any) || 'tax_filing',
      dueDate: formatDateUtc(n.dueDate),
      noticeDate: formatDateUtc(n.noticeDate),
      daysRemaining: n.daysRemaining,
      status: n.status as any,
      sourceReference: n.complianceEvent?.sourceReference || null,
      filingPortalUrl: n.complianceEvent?.filingPortalUrl || null,
      actionRequired: n.complianceEvent?.actionRequired || null,
      completedAt: n.completedAt ? n.completedAt.toISOString() : null,
      completedBy: n.completedBy,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  /**
   * Acknowledge or complete a compliance notice.
   */
  async updateNoticeStatus(
    tenantId: string,
    noticeId: string,
    status: 'acknowledged' | 'completed' | 'dismissed',
    userId?: string,
  ): Promise<ComplianceNoticeView> {
    const notice = await this.prisma.unscoped.complianceEventNotice.findFirst({
      where: { id: noticeId, tenantId },
      include: {
        company: { select: { id: true, name: true } },
        complianceEvent: true,
      },
    });

    if (!notice) {
      throw new Error(`Compliance notice with ID ${noticeId} not found`);
    }

    const updated = await this.prisma.unscoped.complianceEventNotice.update({
      where: { id: noticeId },
      data: {
        status,
        ...(status === 'completed'
          ? {
              completedAt: new Date(),
              completedBy: userId || 'user',
            }
          : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        complianceEvent: true,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      companyId: updated.companyId,
      companyName: updated.company?.name || '',
      complianceEventId: updated.complianceEventId,
      title: updated.complianceEvent?.title || 'Compliance Deadline',
      description: updated.complianceEvent?.description || null,
      category: (updated.complianceEvent?.category as any) || 'tax_filing',
      dueDate: formatDateUtc(updated.dueDate),
      noticeDate: formatDateUtc(updated.noticeDate),
      daysRemaining: updated.daysRemaining,
      status: updated.status as any,
      sourceReference: updated.complianceEvent?.sourceReference || null,
      filingPortalUrl: updated.complianceEvent?.filingPortalUrl || null,
      actionRequired: updated.complianceEvent?.actionRequired || null,
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
      completedBy: updated.completedBy,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  private async findAnyTenantEmployeeId(tenantId: string): Promise<string | null> {
    const emp = await this.prisma.unscoped.employee.findFirst({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    return emp?.id || null;
  }
}
