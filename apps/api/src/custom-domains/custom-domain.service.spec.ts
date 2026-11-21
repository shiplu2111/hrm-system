import { Test, TestingModule } from '@nestjs/testing';
import { CustomDomainService } from './custom-domain.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DnsVerificationService } from './dns/dns-verification.service';
import { AutomaticTlsProvider } from './tls/tls-certificate.provider';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('CustomDomainService', () => {
  let service: CustomDomainService;
  let prisma: any;
  let auditService: any;
  let dnsService: any;
  let tlsProvider: any;

  const tenantId = '33333333-3333-3333-3333-333333333333';
  const domainId = 'dom-1111-2222-3333-4444';

  beforeEach(async () => {
    prisma = {
      unscoped: {
        tenantCustomDomain: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn().mockImplementation(({ data }) => ({
            id: domainId,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          update: jest.fn().mockImplementation(({ where, data }) => ({
            id: where.id,
            tenantId,
            domain: 'hr.acme.com',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          delete: jest.fn().mockResolvedValue({ id: domainId }),
        },
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    dnsService = {
      generateDnsRecords: jest.fn().mockReturnValue([
        {
          type: 'TXT',
          name: '_hrm-verify.hr.acme.com',
          expectedValue: 'hrm-verify-token',
          status: 'missing',
          purpose: 'Verification',
        },
        {
          type: 'CNAME',
          name: 'hr.acme.com',
          expectedValue: 'cname.cmsnbd.com',
          status: 'missing',
          purpose: 'Traffic',
        },
      ]),
      verifyDnsRecords: jest.fn(),
    };

    tlsProvider = {
      provisionCertificate: jest.fn().mockResolvedValue({
        certificateId: 'cert_mock_123',
        issuer: "Let's Encrypt Authority R3",
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 86400000),
        san: ['hr.acme.com'],
        serialNumber: 'ABCDEF123456',
        fingerprint: 'sha256fingerprint',
        autoRenew: true,
      }),
      revokeCertificate: jest.fn().mockResolvedValue(undefined),
      checkCertificate: jest.fn().mockResolvedValue({ valid: true, expiresAt: new Date() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomDomainService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: DnsVerificationService, useValue: dnsService },
        { provide: AutomaticTlsProvider, useValue: tlsProvider },
      ],
    }).compile();

    service = module.get<CustomDomainService>(CustomDomainService);
  });

  describe('createCustomDomain', () => {
    it('creates custom domain, returns DNS instructions, and logs audit', async () => {
      prisma.unscoped.tenantCustomDomain.findUnique.mockResolvedValueOnce(null);

      const domain = await service.createCustomDomain(tenantId, {
        domain: 'hr.acme.com',
      });

      expect(domain.domain).toBe('hr.acme.com');
      expect(domain.status).toBe('pending_verification');
      expect(domain.sslStatus).toBe('pending');
      expect(domain.verificationToken).toMatch(/^hrm-verify-[a-f0-9]{32}$/);
      expect(domain.dnsRecords).toHaveLength(2);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          action: 'create',
          module: 'settings',
        }),
      );
    });

    it('rejects reserved platform domains', async () => {
      await expect(
        service.createCustomDomain(tenantId, { domain: 'app.cmsnbd.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects domain already registered by another tenant', async () => {
      prisma.unscoped.tenantCustomDomain.findUnique.mockResolvedValueOnce({
        id: 'other-id',
        tenantId: 'different-tenant-id',
        domain: 'hr.acme.com',
      });

      await expect(
        service.createCustomDomain(tenantId, { domain: 'hr.acme.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyCustomDomain', () => {
    it('successfully verifies DNS records and automatically provisions TLS certificate', async () => {
      prisma.unscoped.tenantCustomDomain.findFirst.mockResolvedValueOnce({
        id: domainId,
        tenantId,
        domain: 'hr.acme.com',
        verificationToken: 'hrm-verify-token',
        status: 'pending_verification',
        dnsRecords: [],
      });

      dnsService.verifyDnsRecords.mockResolvedValueOnce({
        verified: true,
        dnsRecords: [
          { type: 'TXT', status: 'configured', currentValue: 'hrm-verify-token' },
          { type: 'CNAME', status: 'configured', currentValue: 'cname.cmsnbd.com' },
        ],
      });

      const result = await service.verifyCustomDomain(tenantId, domainId);

      expect(result.verified).toBe(true);
      expect(result.status).toBe('active');
      expect(tlsProvider.provisionCertificate).toHaveBeenCalledWith('hr.acme.com');

      // Verify DB updated with active status and TLS cert details
      expect(prisma.unscoped.tenantCustomDomain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: domainId },
          data: expect.objectContaining({
            status: 'active',
            sslStatus: 'active',
            sslCertificateId: 'cert_mock_123',
          }),
        }),
      );

      // Verify audit log
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          action: 'update',
          module: 'settings',
        }),
      );
    });

    it('handles pending/mismatched DNS records without provisioning TLS', async () => {
      prisma.unscoped.tenantCustomDomain.findFirst.mockResolvedValueOnce({
        id: domainId,
        tenantId,
        domain: 'hr.acme.com',
        verificationToken: 'hrm-verify-token',
        status: 'pending_verification',
        dnsRecords: [],
      });

      dnsService.verifyDnsRecords.mockResolvedValueOnce({
        verified: false,
        dnsRecords: [
          { type: 'TXT', status: 'missing', currentValue: null },
          { type: 'CNAME', status: 'missing', currentValue: null },
        ],
        errorMessage: 'TXT verification record not found',
      });

      const result = await service.verifyCustomDomain(tenantId, domainId);

      expect(result.verified).toBe(false);
      expect(result.status).toBe('pending_verification');
      expect(tlsProvider.provisionCertificate).not.toHaveBeenCalled();
    });
  });

  describe('deleteCustomDomain', () => {
    it('deletes custom domain and revokes certificate', async () => {
      prisma.unscoped.tenantCustomDomain.findFirst.mockResolvedValueOnce({
        id: domainId,
        tenantId,
        domain: 'hr.acme.com',
        sslCertificateId: 'cert_mock_123',
      });

      await service.deleteCustomDomain(tenantId, domainId);

      expect(tlsProvider.revokeCertificate).toHaveBeenCalledWith('cert_mock_123', 'hr.acme.com');
      expect(prisma.unscoped.tenantCustomDomain.delete).toHaveBeenCalledWith({
        where: { id: domainId },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          action: 'delete',
        }),
      );
    });
  });
});
