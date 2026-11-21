import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { FeatureGateService, computeRolloutBucket } from '../src/billing/feature-gate.service';
import { PlatformFeatureFlagsService } from '../src/platform/feature-flags/platform-feature-flags.service';

describe('FeatureGate Overrides & Rollout Engine (E2E Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let featureGate: FeatureGateService;
  let flagsService: PlatformFeatureFlagsService;

  let testTenantId: string;
  let testTenant2Id: string;
  let platformUserId: string;
  const flagKey = `test_flag_${Date.now()}`;
  const rolloutFlagKey = `rollout_flag_${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    featureGate = app.get<FeatureGateService>(FeatureGateService);
    flagsService = app.get<PlatformFeatureFlagsService>(PlatformFeatureFlagsService);

    // Find existing platform user for audit log foreign key
    const pUser = await prisma.unscoped.platformUser.findFirstOrThrow();
    platformUserId = pUser.id;

    // Create 2 test tenants
    const tenant1 = await prisma.unscoped.tenant.create({
      data: {
        name: `FeatureGate Test Tenant 1 ${Date.now()}`,
        subdomain: `test-fg-1-${Date.now()}`,
        planId: 'starter',
        status: 'active',
      },
    });
    testTenantId = tenant1.id;

    const tenant2 = await prisma.unscoped.tenant.create({
      data: {
        name: `FeatureGate Test Tenant 2 ${Date.now()}`,
        subdomain: `test-fg-2-${Date.now()}`,
        planId: 'starter',
        status: 'active',
      },
    });
    testTenant2Id = tenant2.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testTenantId) {
      await prisma.unscoped.tenantFeatureOverride.deleteMany({ where: { tenantId: testTenantId } });
      await prisma.unscoped.tenant.delete({ where: { id: testTenantId } }).catch(() => null);
    }
    if (testTenant2Id) {
      await prisma.unscoped.tenantFeatureOverride.deleteMany({ where: { tenantId: testTenant2Id } });
      await prisma.unscoped.tenant.delete({ where: { id: testTenant2Id } }).catch(() => null);
    }
    await prisma.unscoped.platformFeatureFlag.deleteMany({
      where: { key: { in: [flagKey, rolloutFlagKey] } },
    });
    await app.close();
  });

  describe('1. Platform Feature Flags CRUD and Audit', () => {
    it('creates a platform feature flag and writes to platform_audit_logs', async () => {
      const flag = await flagsService.createFlag(
        {
          key: flagKey,
          description: 'Gradual beta feature for scheduling',
          defaultState: false,
          rolloutPercentage: 0,
        },
        { id: platformUserId, email: 'platform-admin@system.local' },
        '127.0.0.1',
        'e2e-test',
      );

      expect(flag.key).toBe(flagKey);
      expect(flag.defaultState).toBe(false);
      expect(flag.rolloutPercentage).toBe(0);

      // Verify audit log
      const audit = await prisma.unscoped.platformAuditLog.findFirst({
        where: { action: 'platform_feature_flag.create', recordId: flagKey },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeDefined();
      expect(audit?.module).toBe('feature_flags');
    });

    it('updates a platform feature flag and writes to platform_audit_logs with old and new values', async () => {
      const updated = await flagsService.updateFlag(
        flagKey,
        { rolloutPercentage: 25, defaultState: true },
        { id: platformUserId },
      );

      expect(updated.rolloutPercentage).toBe(25);
      expect(updated.defaultState).toBe(true);

      const audit = await prisma.unscoped.platformAuditLog.findFirst({
        where: { action: 'platform_feature_flag.update', recordId: flagKey },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeDefined();
      expect((audit?.newValue as any)?.rolloutPercentage).toBe(25);
      expect((audit?.oldValue as any)?.rolloutPercentage).toBe(0);
    });
  });

  describe('2. Tenant Feature Overrides CRUD, Expiry, and Audit', () => {
    it('sets a tenant feature override with expires_at and writes to platform_audit_logs', async () => {
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString(); // 7 days in future
      const override = await flagsService.setTenantOverride(
        testTenantId,
        {
          key: flagKey,
          value: true,
          reason: 'Pilot customer request',
          expiresAt,
        },
        { id: platformUserId, email: 'admin@system.local' },
      );

      expect(override.key).toBe(flagKey);
      expect(override.value).toBe(true);
      expect(override.isExpired).toBe(false);
      expect(override.reason).toBe('Pilot customer request');

      const audit = await prisma.unscoped.platformAuditLog.findFirst({
        where: { action: 'tenant_feature_override.set', recordId: `${testTenantId}:${flagKey}` },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeDefined();
      expect(audit?.module).toBe('feature_gates');
    });

    it('removes a tenant feature override and writes to platform_audit_logs', async () => {
      await flagsService.removeTenantOverride(testTenantId, flagKey, {
        id: platformUserId,
      });

      const list = await flagsService.listTenantOverrides(testTenantId);
      expect(list.find((o) => o.key === flagKey)).toBeUndefined();

      const audit = await prisma.unscoped.platformAuditLog.findFirst({
        where: { action: 'tenant_feature_override.remove', recordId: `${testTenantId}:${flagKey}` },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toBeDefined();
    });
  });

  describe('3. Strict Resolution Order: Tenant Override -> Flag Rollout -> Plan Default', () => {
    it('Order 1: Active tenant override (false) disables feature even if plan allows it (core_hr)', async () => {
      // Starter plan includes 'core_hr'. We set an explicit override of false.
      await flagsService.setTenantOverride(testTenantId, {
        key: 'core_hr',
        value: false,
        reason: 'Block core_hr test',
      });

      const evalResult = await featureGate.evaluateFeature(testTenantId, 'core_hr');
      expect(evalResult.enabled).toBe(false);
      expect(evalResult.source).toBe('tenant_override');

      const has = await featureGate.hasFeature(testTenantId, 'core_hr');
      expect(has).toBe(false);

      // Clean up override
      await flagsService.removeTenantOverride(testTenantId, 'core_hr');
    });

    it('Order 1: Expired tenant override is ignored and resolution falls through to next order', async () => {
      // Expired 1 hour ago
      const past = new Date(Date.now() - 3600000).toISOString();
      await flagsService.setTenantOverride(testTenantId, {
        key: 'core_hr',
        value: false,
        reason: 'Expired block',
        expiresAt: past,
      });

      // Override is expired, so it must fall through to plan default (which is true for core_hr on Starter)
      const evalResult = await featureGate.evaluateFeature(testTenantId, 'core_hr');
      expect(evalResult.enabled).toBe(true);
      expect(evalResult.source).toBe('plan_default');

      await flagsService.removeTenantOverride(testTenantId, 'core_hr');
    });

    it('Order 2: Platform Feature Flag gradual rollout enables feature when bucket < percentage', async () => {
      // Create flag with 0% rollout and default false
      await flagsService.createFlag({
        key: rolloutFlagKey,
        description: 'Testing gradual rollout',
        defaultState: false,
        rolloutPercentage: 0,
      });

      // Pre-check: rollout 0% -> disabled
      let evalResult = await featureGate.evaluateFeature(testTenantId, rolloutFlagKey);
      expect(evalResult.enabled).toBe(false);
      expect(evalResult.source).toBe('flag_default');

      // Check tenant's bucket
      const bucket = computeRolloutBucket(testTenantId, rolloutFlagKey);

      // Now set rolloutPercentage to (bucket + 1) -> tenant is now enrolled!
      await flagsService.updateFlag(rolloutFlagKey, {
        rolloutPercentage: bucket + 1,
        defaultState: false,
      });

      evalResult = await featureGate.evaluateFeature(testTenantId, rolloutFlagKey);
      expect(evalResult.enabled).toBe(true);
      expect(evalResult.source).toBe('flag_rollout');
      expect(evalResult.bucket).toBe(bucket);
    });

    it('Order 2: Platform Feature Flag global killswitch (defaultState: false, rollout: 0) disables feature', async () => {
      await flagsService.updateFlag(rolloutFlagKey, {
        rolloutPercentage: 0,
        defaultState: false,
      });

      const evalResult = await featureGate.evaluateFeature(testTenantId, rolloutFlagKey);
      expect(evalResult.enabled).toBe(false);
      expect(evalResult.source).toBe('flag_default');
    });

    it('Order 3: Plan default governs features with no tenant override and no platform flag', async () => {
      // Starter plan does NOT include 'roster' (requires Business/Enterprise)
      const evalResult = await featureGate.evaluateFeature(testTenantId, 'roster');
      expect(evalResult.enabled).toBe(false);
      expect(evalResult.source).toBe('plan_default');

      // Grant tenant override for roster -> immediately enabled
      await flagsService.setTenantOverride(testTenantId, {
        key: 'roster',
        value: true,
        reason: 'VIP preview',
      });

      const evalWithOverride = await featureGate.evaluateFeature(testTenantId, 'roster');
      expect(evalWithOverride.enabled).toBe(true);
      expect(evalWithOverride.source).toBe('tenant_override');

      // Clean up override -> returns to plan default (false)
      await flagsService.removeTenantOverride(testTenantId, 'roster');
      const evalAfterRemove = await featureGate.evaluateFeature(testTenantId, 'roster');
      expect(evalAfterRemove.enabled).toBe(false);
      expect(evalAfterRemove.source).toBe('plan_default');
    });
  });
});
