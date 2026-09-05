import { Inject, Injectable } from '@nestjs/common';
import { buildStorageKey } from './storage-key.util';
import { STORAGE_DRIVER } from './storage.constants';
import type { FileMeta, StorageDriver } from './storage.types';

@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

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

  upload(key: string, file: Buffer, meta: FileMeta): Promise<string> {
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
