import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RuleSandboxService } from './rule-sandbox.service';
import { PrismaService } from '../../database/prisma.service';

describe('RuleSandboxService', () => {
  let service: RuleSandboxService;

  const mockCountry = {
    id: 'country-au-uuid',
    name: 'Australia',
    isoCode: 'AUS',
    currency: 'AUD',
  };

  const mockState = {
    id: 'state-nsw-uuid',
    name: 'New South Wales',
    code: 'NSW',
    countryId: 'country-au-uuid',
  };

  const mockPublishedTaxRule = {
    id: 'rule-tax-v1',
    countryId: 'country-au-uuid',
    stateProvinceId: null,
    ruleType: 'tax',
    version: 1,
    status: 'published',
    effectiveFrom: new Date('2024-07-01T00:00:00.000Z'),
    effectiveTo: null,
    sourceReference: 'ATO 2024/25 Tax Rates',
    changeNote: 'Baseline tax brackets',
    payload: {
      taxYear: 2024,
      currency: 'AUD',
      hasFilingStatuses: false,
      brackets: [
        { from: 0, to: 18200, rate: 0, fixedAmount: 0 },
        { from: 18200, to: 45000, rate: 16, fixedAmount: 0 },
        { from: 45000, to: 135000, rate: 30, fixedAmount: 4288 },
        { from: 135000, to: 190000, rate: 37, fixedAmount: 31288 },
        { from: 190000, to: null, rate: 45, fixedAmount: 51638 },
      ],
      rebates: [
        {
          id: 'lito',
          name: 'Low Income Tax Offset',
          code: 'LITO',
          type: 'tapered',
          amount: 700,
          threshold: 37500,
          phaseOutRate: 0.015,
        },
      ],
    },
  };

  const mockDraftTaxRule = {
    id: 'rule-tax-v2-draft',
    countryId: 'country-au-uuid',
    stateProvinceId: null,
    ruleType: 'tax',
    version: 2,
    status: 'draft',
    effectiveFrom: new Date('2027-07-01T00:00:00.000Z'),
    effectiveTo: null,
    sourceReference: 'Proposed 2027 Tax Reform Draft',
    changeNote: 'Reduced middle tier to 28%',
    payload: {
      taxYear: 2027,
      currency: 'AUD',
      hasFilingStatuses: false,
      brackets: [
        { from: 0, to: 20000, rate: 0, fixedAmount: 0 },
        { from: 20000, to: 50000, rate: 15, fixedAmount: 0 },
        { from: 50000, to: 150000, rate: 28, fixedAmount: 4500 },
        { from: 150000, to: null, rate: 45, fixedAmount: 32500 },
      ],
      rebates: [],
    },
  };

  const mockPublishedOtRule = {
    id: 'rule-ot-v1',
    countryId: 'country-au-uuid',
    stateProvinceId: null,
    ruleType: 'ot',
    version: 1,
    status: 'published',
    effectiveFrom: new Date('2024-07-01T00:00:00.000Z'),
    effectiveTo: null,
    sourceReference: 'Fair Work Act 2009',
    changeNote: 'Standard working hours and OT multipliers',
    payload: {
      standardDailyHours: 7.6,
      standardWeeklyHours: 38.0,
      weekdayMultiplier: 1.5,
      weekendMultiplier: 2.0,
      holidayMultiplier: 2.5,
      nightMultiplier: 1.15,
      maxMonthlyOvertimeHours: 40,
      actionOnCapBreach: 'flag',
    },
  };

  const mockPublishedPensionRule = {
    id: 'rule-pension-v1',
    countryId: 'country-au-uuid',
    stateProvinceId: null,
    ruleType: 'pension',
    version: 1,
    status: 'published',
    effectiveFrom: new Date('2024-07-01T00:00:00.000Z'),
    effectiveTo: null,
    sourceReference: 'Superannuation Guarantee (Administration) Act 1992',
    changeNote: 'Statutory SG 11.5%',
    payload: {
      schemeName: 'Superannuation Guarantee',
      fundCode: 'SG',
      contributionBase: 'basic',
      employerContributionRate: 11.5,
      employeeContributionRate: 0,
      preTax: true,
    },
  };

  const mockPrisma = {
    unscoped: {
      country: {
        findUnique: jest.fn(),
      },
      stateProvince: {
        findFirst: jest.fn(),
      },
      countryRule: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleSandboxService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<RuleSandboxService>(RuleSandboxService);
  });

  describe('simulate', () => {
    it('should throw NotFoundException if country does not exist', async () => {
      mockPrisma.unscoped.country.findUnique.mockResolvedValue(null);

      await expect(
        service.simulate({
          countryId: 'non-existent',
          calculationDate: '2026-07-01',
          employeeProfile: { baseSalary: 8000 },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if calculation date is invalid', async () => {
      mockPrisma.unscoped.country.findUnique.mockResolvedValue(mockCountry);

      await expect(
        service.simulate({
          countryId: mockCountry.id,
          calculationDate: 'invalid-date',
          employeeProfile: { baseSalary: 8000 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should run deterministic simulation with published rules and return full step-by-step breakdown', async () => {
      mockPrisma.unscoped.country.findUnique.mockResolvedValue(mockCountry);
      mockPrisma.unscoped.stateProvince.findFirst.mockResolvedValue(null);

      // Return published rules by category
      mockPrisma.unscoped.countryRule.findMany.mockImplementation((args: any) => {
        const rt = args?.where?.ruleType;
        if (rt === 'tax') return Promise.resolve([mockPublishedTaxRule]);
        if (rt === 'ot') return Promise.resolve([mockPublishedOtRule]);
        if (rt === 'pension') return Promise.resolve([mockPublishedPensionRule]);
        return Promise.resolve([]);
      });

      const result = await service.simulate({
        countryId: mockCountry.id,
        calculationDate: '2026-07-01',
        employeeProfile: {
          baseSalary: 8000,
          payFrequency: 'monthly',
          overtime: {
            weekdayHours: 10,
            weekendHours: 5,
            holidayHours: 2,
            nightHours: 4,
          },
          leave: {
            unpaidLeaveDays: 1,
          },
        },
      });

      expect(result.countryName).toBe('Australia');
      expect(result.currency).toBe('AUD');
      expect(result.calculationDate).toBe('2026-07-01');
      expect(result.isDraftTest).toBe(false);

      // Gross pay breakdown
      expect(result.gross.baseSalary).toBe(8000);
      expect(result.gross.hourlyRate).toBeGreaterThan(0);
      expect(result.gross.overtimeLines.length).toBe(4);
      expect(result.gross.totalOvertimePay).toBeGreaterThan(0);
      expect(result.gross.leaveDeductionLines.length).toBe(1);
      expect(result.gross.totalLeaveDeductions).toBeGreaterThan(0);
      expect(result.gross.totalGrossPay).toBeGreaterThan(0);

      // Tax breakdown
      expect(result.tax.annualTaxableIncome).toBeGreaterThan(0);
      expect(result.tax.brackets.length).toBe(5);
      expect(result.tax.annualGrossTax).toBeGreaterThan(0);
      expect(result.tax.periodTaxDeduction).toBeGreaterThan(0);

      // Contributions breakdown (SG 11.5% on basic)
      expect(result.contributions.items.length).toBe(1);
      expect(result.contributions.items[0].employerRate).toBe(11.5);
      expect(result.contributions.items[0].employerAmount).toBe(920); // 8000 * 11.5% = 920

      // Net Pay summary
      expect(result.summary.grossEarnings).toBe(result.gross.totalGrossPay);
      expect(result.summary.netPay).toBe(
        Math.round((result.gross.totalGrossPay - result.summary.totalDeductions) * 100) / 100,
      );
      expect(result.summary.totalEmployerCost).toBe(
        Math.round((result.gross.totalGrossPay + result.summary.totalEmployerContributions) * 100) / 100,
      );

      // Resolution chain audit overview
      expect(result.resolutionChainOverview.length).toBe(5);
      expect(result.resolvedCategories['tax'].resolvedVersionNumber).toBe(1);
      expect(result.resolvedCategories['tax'].isDraftOverride).toBe(false);
      expect(result.resolvedCategories['ot'].resolvedVersionNumber).toBe(1);
    });

    it('should allow testing a draft version before publishing it (draft override precedence)', async () => {
      mockPrisma.unscoped.country.findUnique.mockResolvedValue(mockCountry);
      mockPrisma.unscoped.stateProvince.findFirst.mockResolvedValue(null);

      // Draft tax rule requested
      mockPrisma.unscoped.countryRule.findFirst.mockResolvedValue(mockDraftTaxRule);

      mockPrisma.unscoped.countryRule.findMany.mockImplementation((args: any) => {
        const rt = args?.where?.ruleType;
        if (rt === 'ot') return Promise.resolve([mockPublishedOtRule]);
        if (rt === 'pension') return Promise.resolve([mockPublishedPensionRule]);
        return Promise.resolve([]);
      });

      const result = await service.simulate({
        countryId: mockCountry.id,
        calculationDate: '2026-07-01',
        draftRuleVersionId: mockDraftTaxRule.id,
        employeeProfile: {
          baseSalary: 10000,
        },
      });

      expect(result.isDraftTest).toBe(true);
      expect(result.testedDraftVersionId).toBe(mockDraftTaxRule.id);

      // The tax category must resolve to draft version 2 with isDraftOverride = true
      const taxCat = result.resolvedCategories['tax'];
      expect(taxCat.isDraftOverride).toBe(true);
      expect(taxCat.resolvedVersionNumber).toBe(2);
      expect(taxCat.resolvedStatus).toBe('draft');
      expect(taxCat.changeNote).toBe('Reduced middle tier to 28%');

      // The draft brackets should be used in the computation
      expect(result.tax.brackets[0].from).toBe(0);
      expect(result.tax.brackets[0].to).toBe(20000);
      expect(result.tax.brackets[1].rate).toBe(15);
    });

    it('should detect overtime cap breach and apply flag or auto_cap action', async () => {
      mockPrisma.unscoped.country.findUnique.mockResolvedValue(mockCountry);
      mockPrisma.unscoped.stateProvince.findFirst.mockResolvedValue(null);

      // Mock OT rule with 20h cap and action 'flag'
      const cappedOtRule = {
        ...mockPublishedOtRule,
        payload: {
          ...mockPublishedOtRule.payload,
          maxMonthlyOvertimeHours: 20,
          actionOnCapBreach: 'flag',
        },
      };

      mockPrisma.unscoped.countryRule.findMany.mockImplementation((args: any) => {
        const rt = args?.where?.ruleType;
        if (rt === 'ot') return Promise.resolve([cappedOtRule]);
        return Promise.resolve([]);
      });

      // Employee logs 30 hours of OT (exceeding 20h cap)
      const result = await service.simulate({
        countryId: mockCountry.id,
        calculationDate: '2026-07-01',
        employeeProfile: {
          baseSalary: 6000,
          overtime: {
            weekdayHours: 20,
            weekendHours: 10,
          },
        },
      });

      expect(result.gross.overtimeCapBreach).toBeDefined();
      expect(result.gross.overtimeCapBreach?.breached).toBe(true);
      expect(result.gross.overtimeCapBreach?.capHours).toBe(20);
      expect(result.gross.overtimeCapBreach?.actualHours).toBe(30);
      expect(result.gross.overtimeCapBreach?.action).toBe('flag');
    });
  });

  describe('getDraftCandidates', () => {
    it('should list unpublished draft and pending_approval versions for sandbox selection', async () => {
      mockPrisma.unscoped.countryRule.findMany.mockResolvedValue([
        mockDraftTaxRule,
        {
          id: 'rule-ph-v4',
          countryId: 'country-au-uuid',
          stateProvinceId: null,
          ruleType: 'public_holiday',
          version: 4,
          status: 'pending_approval',
          effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
          effectiveTo: null,
          sourceReference: '2027 Gazetted Holidays',
          changeNote: 'New penalty rates',
          stateProvince: null,
        },
      ]);

      const candidates = await service.getDraftCandidates('country-au-uuid');
      expect(candidates.length).toBe(2);
      expect(candidates[0].version).toBe(2);
      expect(candidates[0].status).toBe('draft');
      expect(candidates[1].status).toBe('pending_approval');
    });
  });
});
