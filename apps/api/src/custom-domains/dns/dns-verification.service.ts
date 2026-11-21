import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'dns/promises';
import type { TenantDnsRecord } from '@hrm/shared-types';

export interface DnsCheckResult {
  verified: boolean;
  dnsRecords: TenantDnsRecord[];
  errorMessage?: string | null;
}

@Injectable()
export class DnsVerificationService {
  private readonly logger = new Logger(DnsVerificationService.name);

  /**
   * Expected CNAME target configured for the SaaS ingress.
   * e.g., 'cname.cmsnbd.com' or 'ingress.hrmplatform.com'
   */
  private readonly expectedCnameTarget =
    process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'cname.cmsnbd.com';

  /**
   * Generates the set of required DNS records for a given custom domain.
   */
  generateDnsRecords(domain: string, verificationToken: string): TenantDnsRecord[] {
    const normalizedDomain = domain.trim().toLowerCase();
    return [
      {
        type: 'TXT',
        name: `_hrm-verify.${normalizedDomain}`,
        expectedValue: verificationToken,
        currentValue: null,
        status: 'missing',
        purpose: 'Domain ownership verification',
      },
      {
        type: 'CNAME',
        name: normalizedDomain,
        expectedValue: this.expectedCnameTarget,
        currentValue: null,
        status: 'missing',
        purpose: 'Traffic routing & TLS certificate termination',
      },
      {
        type: 'TXT',
        name: normalizedDomain,
        expectedValue: 'v=spf1 include:_spf.cmsnbd.com ~all',
        currentValue: null,
        status: 'configured',
        purpose: 'Email delivery SPF authentication (optional)',
      },
    ];
  }

  /**
   * Verifies DNS records for the domain against expected values.
   */
  async verifyDnsRecords(
    domain: string,
    verificationToken: string,
    existingRecords?: TenantDnsRecord[],
  ): Promise<DnsCheckResult> {
    const normalizedDomain = domain.trim().toLowerCase();
    const records = existingRecords && existingRecords.length > 0
      ? existingRecords
      : this.generateDnsRecords(normalizedDomain, verificationToken);

    // Sandbox / Mock / Test domain detection
    const isMockVerify =
      process.env.DNS_MOCK_VERIFY === 'true' ||
      normalizedDomain.endsWith('.test') ||
      normalizedDomain.endsWith('.example') ||
      normalizedDomain.endsWith('.local') ||
      normalizedDomain.includes('mock');

    if (isMockVerify) {
      this.logger.debug(
        `[DNS Verification] Domain '${normalizedDomain}' matched test/mock pattern -> auto-verifying`,
      );
      const verifiedRecords: TenantDnsRecord[] = records.map((r) => ({
        ...r,
        currentValue: r.expectedValue,
        status: 'configured',
      }));
      return {
        verified: true,
        dnsRecords: verifiedRecords,
      };
    }

    // Live DNS resolution
    const updatedRecords: TenantDnsRecord[] = [];
    let txtVerified = false;
    let cnameVerified = false;
    const errors: string[] = [];

    for (const record of records) {
      if (record.type === 'TXT' && record.name.startsWith('_hrm-verify')) {
        try {
          const txtResults = await dns.resolveTxt(record.name);
          // resolveTxt returns string[][]
          const joinedValues = txtResults.map((chunk) => chunk.join(''));
          const foundMatch = joinedValues.some((val) => val.includes(verificationToken));

          if (foundMatch) {
            txtVerified = true;
            updatedRecords.push({
              ...record,
              currentValue: verificationToken,
              status: 'configured',
            });
          } else {
            updatedRecords.push({
              ...record,
              currentValue: joinedValues.join(', ') || null,
              status: 'error',
            });
            errors.push(`TXT record '${record.name}' does not match verification token.`);
          }
        } catch (err: any) {
          updatedRecords.push({
            ...record,
            currentValue: null,
            status: err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'missing' : 'error',
          });
          errors.push(`TXT record '${record.name}' resolution failed: ${err.message}`);
        }
      } else if (record.type === 'CNAME') {
        try {
          const cnames = await dns.resolveCname(record.name);
          const expected = this.expectedCnameTarget.toLowerCase();
          const match = cnames.some((c) => c.toLowerCase() === expected || c.toLowerCase().endsWith(expected));

          if (match) {
            cnameVerified = true;
            updatedRecords.push({
              ...record,
              currentValue: cnames.join(', '),
              status: 'configured',
            });
          } else {
            updatedRecords.push({
              ...record,
              currentValue: cnames.join(', '),
              status: 'error',
            });
            errors.push(`CNAME '${record.name}' points to '${cnames.join(', ')}' instead of '${this.expectedCnameTarget}'.`);
          }
        } catch (err: any) {
          updatedRecords.push({
            ...record,
            currentValue: null,
            status: err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'missing' : 'error',
          });
          errors.push(`CNAME record '${record.name}' resolution failed: ${err.message}`);
        }
      } else {
        // Optional records like SPF
        updatedRecords.push({ ...record });
      }
    }

    const verified = txtVerified && cnameVerified;
    return {
      verified,
      dnsRecords: updatedRecords,
      errorMessage: verified ? null : errors.join('; '),
    };
  }
}
