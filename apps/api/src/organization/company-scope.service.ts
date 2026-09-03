import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CompanyScopeService {
  constructor(private readonly prisma: PrismaService) {}

  requireTenantId(): string {
    const tenantId = getTenantIdFromSession();
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tenant context is required',
      });
    }
    return tenantId;
  }

  async listCompanies() {
    this.requireTenantId();
    return this.prisma.scoped.company.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        countryId: true,
        financialYearStart: true,
      },
    });
  }

  async assertCompanyInTenant(companyId: string) {
    this.requireTenantId();
    const company = await this.prisma.scoped.company.findFirst({
      where: { id: companyId },
      select: { id: true, tenantId: true, name: true },
    });

    if (!company) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Company not found',
      });
    }

    return company;
  }
}
