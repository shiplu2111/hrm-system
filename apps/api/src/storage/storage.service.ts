import { Inject, Injectable, Optional } from '@nestjs/common';
import { FeatureGateService } from '../billing/feature-gate.service';
import { buildStorageKey } from './storage-key.util';
import { STORAGE_DRIVER } from './storage.constants';
import type { FileMeta, StorageDriver } from './storage.types';

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    @Optional() private readonly featureGate?: FeatureGateService,
  ) {}

  buildEmployeeDocumentKey(
    tenantId: string,
    employeeId: string,
    originalFilename: string,
  ): string {
    return buildStorageKey(tenantId, 'documents', employeeId, originalFilename);
  }

  buildPayslipKey(
    tenantId: string,
    payrollRunId: string,
    originalFilename = 'payslip.pdf',
  ): string {
    return buildStorageKey(tenantId, 'payslips', payrollRunId, originalFilename);
  }

  buildEmploymentContractKey(
    tenantId: string,
    contractId: string,
    originalFilename: string,
  ): string {
    return buildStorageKey(tenantId, 'contracts', contractId, originalFilename);
  }

  buildExpenseReceiptKey(
    tenantId: string,
    claimId: string,
    originalFilename: string,
  ): string {
    return buildStorageKey(tenantId, 'expenses', claimId, originalFilename);
  }

  buildCertificationFileKey(
    tenantId: string,
    certificationId: string,
    originalFilename: string,
  ): string {
    return buildStorageKey(tenantId, 'certifications', certificationId, originalFilename);
  }

  buildApplicationResumeKey(
    tenantId: string,
    applicationId: string,
    originalFilename: string,
  ): string {
    return buildStorageKey(tenantId, 'recruitment', applicationId, originalFilename);
  }

  buildCandidateDocumentKey(
    tenantId: string,
    candidateId: string,
    originalFilename: string,
  ): string {
    return buildStorageKey(tenantId, 'candidates', candidateId, originalFilename);
  }

  buildOfferLetterKey(
    tenantId: string,
    offerLetterId: string,
    originalFilename = 'offer-letter.pdf',
  ): string {
    return buildStorageKey(tenantId, 'offer-letters', offerLetterId, originalFilename);
  }

  buildInvoicePdfKey(
    tenantId: string,
    invoiceId: string,
    originalFilename = 'invoice.pdf',
  ): string {
    return buildStorageKey(tenantId, 'invoices', invoiceId, originalFilename);
  }

  async upload(
    key: string,
    file: Buffer,
    meta: FileMeta,
    explicitTenantId?: string,
  ): Promise<string> {
    const tenantId = explicitTenantId ?? (key.includes('/') ? key.split('/')[0] : null);
    if (tenantId && this.featureGate) {
      const fileBytes = file.byteLength || (meta?.size ?? (meta as any)?.sizeBytes ?? 0);
      const fileGb = fileBytes / (1024 * 1024 * 1024);
      await this.featureGate.assertWithinLimit(tenantId, 'storage_gb', fileGb);
    }
    return this.driver.upload(key, file, meta);
  }

  getUrl(key: string, expirySeconds?: number): Promise<string> {
    return this.driver.getUrl(key, expirySeconds);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  exists(key: string): Promise<boolean> {
    return this.driver.exists(key);
  }

  read(key: string): Promise<{ buffer: Buffer; meta: FileMeta }> {
    return this.driver.read(key);
  }
}
