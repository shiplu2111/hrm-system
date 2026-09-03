import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { TenantSettingCategory } from '@prisma/client';
import type { SmtpSettingsView } from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { UpdateSmtpSettingsDto } from './dto/smtp-settings.dto';
import {
  type DecryptedSmtpSettings,
  type StoredSmtpSettings,
  sanitizeSmtpForAudit,
  smtpSettingKeyForCompany,
  toSmtpSettingsView,
} from './smtp-settings.utils';

@Injectable()
export class SmtpSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly auditService: AuditService,
  ) {}

  async getSmtpSettings(companyId: string): Promise<SmtpSettingsView> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.findSettingRow(companyId);
    const stored = row ? this.parseStored(row.value) : null;
    return toSmtpSettingsView(stored, row?.updatedAt.toISOString() ?? null);
  }

  async updateSmtpSettings(
    companyId: string,
    dto: UpdateSmtpSettingsDto,
    user: AuthenticatedUser,
    meta?: { ipAddress?: string; device?: string },
  ): Promise<SmtpSettingsView> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const key = smtpSettingKeyForCompany(companyId);
    const existingRow = await this.findSettingRow(companyId);
    const existingStored = existingRow ? this.parseStored(existingRow.value) : null;

    let passwordEnc = existingStored?.passwordEnc ?? null;
    const passwordProvided =
      dto.password !== undefined && dto.password.trim().length > 0;

    if (passwordProvided) {
      passwordEnc = this.fieldEncryption.encrypt(dto.password!.trim());
    } else if (!existingStored && !passwordEnc) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'SMTP password is required when configuring for the first time',
      });
    }

    const nextStored: StoredSmtpSettings = {
      host: dto.host.trim(),
      port: dto.port,
      username: dto.username?.trim() ?? '',
      passwordEnc,
      fromAddress: dto.fromAddress.trim(),
      fromName: dto.fromName.trim(),
      useTls: dto.useTls,
    };

    const row = await this.prisma.unscoped.tenantSetting.upsert({
      where: {
        tenantId_category_key: {
          tenantId: company.tenantId,
          category: TenantSettingCategory.smtp,
          key,
        },
      },
      create: {
        tenantId: company.tenantId,
        category: TenantSettingCategory.smtp,
        key,
        value: nextStored as object,
        updatedBy: user.id,
      },
      update: {
        value: nextStored as object,
        updatedBy: user.id,
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: existingRow ? 'update' : 'create',
      module: 'settings',
      recordId: row.id,
      oldValue: sanitizeSmtpForAudit(existingStored),
      newValue: sanitizeSmtpForAudit(nextStored),
      ipAddress: meta?.ipAddress,
      device: meta?.device,
    });

    return toSmtpSettingsView(nextStored, row.updatedAt.toISOString());
  }

  async resolveDecryptedSettings(
    companyId: string,
    overrides?: Partial<DecryptedSmtpSettings>,
  ): Promise<DecryptedSmtpSettings> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.findSettingRow(companyId);
    const stored = row ? this.parseStored(row.value) : null;

    const merged: DecryptedSmtpSettings = {
      host: overrides?.host ?? stored?.host ?? '',
      port: overrides?.port ?? stored?.port ?? 587,
      username: overrides?.username ?? stored?.username ?? '',
      password: null,
      fromAddress: overrides?.fromAddress ?? stored?.fromAddress ?? '',
      fromName: overrides?.fromName ?? stored?.fromName ?? '',
      useTls: overrides?.useTls ?? stored?.useTls ?? true,
    };

    const overridePassword = overrides?.password;
    if (
      overridePassword !== undefined &&
      overridePassword !== null &&
      overridePassword.trim()
    ) {
      merged.password = overridePassword.trim();
    } else if (stored?.passwordEnc) {
      merged.password = this.fieldEncryption.decrypt(stored.passwordEnc);
    }

    if (!merged.host || !merged.fromAddress || !merged.fromName) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'SMTP host, from address, and from name are required',
      });
    }

    if (!merged.password) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'SMTP password is required',
      });
    }

    return merged;
  }

  private async findSettingRow(companyId: string) {
    const tenantId = this.companyScope.requireTenantId();
    const key = smtpSettingKeyForCompany(companyId);
    return this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: TenantSettingCategory.smtp,
          key,
        },
      },
    });
  }

  private parseStored(value: unknown): StoredSmtpSettings {
    if (!value || typeof value !== 'object') {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: 'Invalid SMTP settings payload',
      });
    }
    const raw = value as Record<string, unknown>;
    return {
      host: String(raw.host ?? ''),
      port: Number(raw.port ?? 587),
      username: String(raw.username ?? ''),
      passwordEnc:
        raw.passwordEnc != null ? String(raw.passwordEnc) : null,
      fromAddress: String(raw.fromAddress ?? ''),
      fromName: String(raw.fromName ?? ''),
      useTls: Boolean(raw.useTls ?? true),
    };
  }
}
