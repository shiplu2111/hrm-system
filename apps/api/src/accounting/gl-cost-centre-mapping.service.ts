import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  GlCostCentreMappingGroup,
  GlCostCentreOverrideRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { ReplaceGlCostCentreMappingsDto } from './dto/accounting.dto';
import {
  costCentreAccountError,
  costCentreSourceKey,
  findDuplicate,
  parseCostCentreSourceKey,
  type CostCentreSource,
} from './gl-mapping.rules';

type OverrideRow = {
  id: string;
  costCentreId: string;
  sourceKey: string;
  payComponentId: string | null;
  glAccountId: string;
  updatedAt: Date;
  glAccount: { code: string; name: string };
  payComponent: { name: string } | null;
};

const OVERRIDE_INCLUDE = {
  glAccount: { select: { code: true, name: true } },
  payComponent: { select: { name: true } },
} as const;

@Injectable()
export class GlCostCentreMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async listGroups(companyId: string): Promise<GlCostCentreMappingGroup[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const [costCentres, overrides] = await Promise.all([
      this.prisma.unscoped.costCentre.findMany({
        where: { companyId },
        orderBy: { code: 'asc' },
        include: {
          _count: { select: { employees: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.unscoped.glCostCentreMapping.findMany({
        where: { companyId },
        include: OVERRIDE_INCLUDE,
      }),
    ]);

    return costCentres.map((costCentre) => ({
      costCentreId: costCentre.id,
      costCentreCode: costCentre.code,
      costCentreName: costCentre.name,
      employeeCount: costCentre._count.employees,
      overrides: this.sortOverrides(
        overrides.filter((row) => row.costCentreId === costCentre.id),
      ),
    }));
  }

  async replaceOverrides(
    companyId: string,
    costCentreId: string,
    dto: ReplaceGlCostCentreMappingsDto,
    user: AuthenticatedUser,
  ): Promise<GlCostCentreMappingGroup> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const costCentre = await this.prisma.unscoped.costCentre.findFirst({
      where: { id: costCentreId, companyId },
      include: {
        _count: { select: { employees: { where: { deletedAt: null } } } },
      },
    });
    if (!costCentre) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Cost centre not found in this company',
      });
    }

    const parsed = dto.overrides.map((override) => {
      const source = parseCostCentreSourceKey(override.sourceKey);
      if (!source) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Unknown payroll source "${override.sourceKey}"`,
        });
      }
      return { source, sourceKey: costCentreSourceKey(source), glAccountId: override.glAccountId };
    });

    if (findDuplicate(parsed, (row) => row.sourceKey)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Each payroll source can only have one override per cost centre',
      });
    }

    const componentIds = parsed
      .map((row) => row.source)
      .filter((source): source is Extract<CostCentreSource, { kind: 'component' }> =>
        source.kind === 'component',
      )
      .map((source) => source.payComponentId);
    const components = componentIds.length
      ? await this.prisma.unscoped.payComponent.findMany({
          where: { id: { in: componentIds }, companyId },
          select: { id: true, name: true, type: true },
        })
      : [];
    if (components.length !== componentIds.length) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Pay component not found in this company',
      });
    }
    const deduction = components.find((component) => component.type !== 'earning');
    if (deduction) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${deduction.name} is a deduction — only earnings and employer super are employee costs that can be split by cost centre`,
      });
    }

    const accountIds = [...new Set(parsed.map((row) => row.glAccountId))];
    const accounts = accountIds.length
      ? await this.prisma.unscoped.glAccount.findMany({
          where: { id: { in: accountIds }, companyId },
        })
      : [];
    if (accounts.length !== accountIds.length) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'GL account not found in this company',
      });
    }
    for (const account of accounts) {
      const error = costCentreAccountError(account);
      if (error) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: error });
      }
    }

    const before = await this.prisma.unscoped.glCostCentreMapping.findMany({
      where: { costCentreId },
      include: OVERRIDE_INCLUDE,
    });

    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.glCostCentreMapping.deleteMany({ where: { costCentreId } });
      if (parsed.length > 0) {
        await tx.glCostCentreMapping.createMany({
          data: parsed.map((row) => ({
            tenantId: company.tenantId,
            companyId,
            costCentreId,
            sourceKey: row.sourceKey,
            payComponentId: row.source.kind === 'component' ? row.source.payComponentId : null,
            glAccountId: row.glAccountId,
          })),
        });
      }
    });

    const after = await this.prisma.unscoped.glCostCentreMapping.findMany({
      where: { costCentreId },
      include: OVERRIDE_INCLUDE,
    });

    const summarize = (rows: OverrideRow[]) =>
      this.sortOverrides(rows).map((row) => ({
        source: this.sourceLabel(row),
        account: row.glAccountCode,
      }));
    const oldValue = summarize(before);
    const newValue = summarize(after);
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'update',
        module: 'accounting',
        recordId: costCentreId,
        oldValue: { costCentre: costCentre.code, overrides: oldValue },
        newValue: { costCentre: costCentre.code, overrides: newValue },
      });
    }

    return {
      costCentreId: costCentre.id,
      costCentreCode: costCentre.code,
      costCentreName: costCentre.name,
      employeeCount: costCentre._count.employees,
      overrides: this.sortOverrides(after),
    };
  }

  private sortOverrides(rows: OverrideRow[]): GlCostCentreOverrideRecord[] {
    const rank = (sourceKey: string) =>
      sourceKey === 'default' ? 0 : sourceKey.startsWith('component:') ? 1 : 2;
    return rows
      .map((row) => this.toRecord(row))
      .sort(
        (a, b) =>
          rank(a.sourceKey) - rank(b.sourceKey) ||
          (a.payComponentName ?? '').localeCompare(b.payComponentName ?? ''),
      );
  }

  private toRecord(row: OverrideRow): GlCostCentreOverrideRecord {
    return {
      id: row.id,
      sourceKey: row.sourceKey,
      payComponentId: row.payComponentId,
      payComponentName: row.payComponent?.name ?? null,
      glAccountId: row.glAccountId,
      glAccountCode: row.glAccount.code,
      glAccountName: row.glAccount.name,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private sourceLabel(row: GlCostCentreOverrideRecord): string {
    if (row.sourceKey === 'default') return 'All employee costs';
    if (row.payComponentName) return row.payComponentName;
    return 'Employer superannuation expense';
  }
}
