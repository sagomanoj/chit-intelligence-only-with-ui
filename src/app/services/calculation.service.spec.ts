import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Chit, ChitTerm } from './local-storage.service';
import { firstValueFrom } from 'rxjs';
import { CalculationService, ProfitRequest } from './calculation.service';

describe('CalculationService', () => {
  let service: CalculationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalculationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('winning auction return', () => {
    const chit: Chit = {
      id: 'arun', name: 'ArunChit', chitValue: 600000, totalMembers: 20, installmentAmount: 30000,
      frequencyInMonths: 2, agentCommissionPercent: 0, agentCommissionAmount: 0,
      dividendDistributionType: 2, organizerPayoutTerm: 1, status: 'ACTIVE', createdAt: '', updatedAt: ''
    };
    const win: ChitTerm = {
      id: 'win', chitId: chit.id, termNumber: 5, winningBidAmount: 50000, isSelfPrized: true,
      auctionDate: '', agentCommission: 0, dividendPerMember: 0, totalDividend: 0,
      netInstallmentPaid: 0, payoutReceived: 520000, createdAt: '', updatedAt: ''
    };

    it('includes unrecorded payments and uses the payment frequency for both rates', () => {
      expect(service.winningAuctionReturn(chit, [])).toBeNull();
      expect(service.winningAuctionReturn(chit, [win])).toMatchObject({
        net: -50000, annualizedProfitPercentage: -3.51, profitInterestRupee: -0.29, estimated: true
      });
    });

    it('counts the winning payment once when keeping the full payout', () => {
      const group = { ...chit, totalMembers: 2, excludeCurrentTermShare: false };
      const records = [
        { ...win, termNumber: 1, isSelfPrized: false, netInstallmentPaid: 25000 },
        { ...win, termNumber: 2, payoutReceived: 60000, dividendPerMember: 2000 }
      ];
      expect(service.winningAuctionReturn(group, records)).toMatchObject({ net: 7000, estimated: false });
    });
  });

  describe('calculateProfit', () => {
    it('should correctly calculate profit/loss with excludeOwnShare = true', async () => {
      const req: ProfitRequest = {
        chitValue: 700000,
        winningAmount: 100000,
        currentTermNumber: 6,
        totalMembers: 14,
        dividendDistributionType: 1,
        pastDividend: 0,
        pastInvestment: 250000,
        frequencyInMonths: 1,
        agentCommissionAmount: 0,
        enableReinvestment: false,
        excludeOwnShare: true
      };

      const res = await firstValueFrom(service.calculateProfit(req));
      expect(res.installmentAmount).toBe(50000);
      expect(res.remainingTerms).toBe(8);
      expect(res.takeHomeAmount).toBe(550000);
      expect(res.futureInvestment).toBe(400000);
      expect(res.totalInvestment).toBe(650000);
      expect(res.netProfit).toBe(100000);
      expect(res.status).toBe('LOSS');
      expect(res.breakEvenDiscountAmount).toBe(0);
    });

    it('should correctly calculate break-even discount when past dividends were saved', async () => {
      const req: ProfitRequest = {
        chitValue: 700000,
        winningAmount: 50000,
        currentTermNumber: 6,
        totalMembers: 14,
        dividendDistributionType: 1,
        pastDividend: 50000,
        pastInvestment: 200000,
        frequencyInMonths: 1,
        agentCommissionAmount: 0,
        enableReinvestment: false,
        excludeOwnShare: true
      };

      const res = await firstValueFrom(service.calculateProfit(req));
      expect(res.breakEvenDiscountAmount).toBe(50000);
      expect(res.takeHomeAmount).toBe(600000); // 700k - 50k - 50k
      expect(res.totalInvestment).toBe(600000); // 200k + 400k
      expect(res.netProfit).toBe(0);
      expect(res.status).toBe('NO PROFIT / NO LOSS');
    });

    it('includes the changing auction discount share in the highest loss-free bid', async () => {
      const request: ProfitRequest = {
        chitValue: 100000, totalMembers: 10, currentTermNumber: 3, pastInvestment: 18000,
        dividendDistributionType: 1, pastDividend: 0, frequencyInMonths: 1, agentCommissionAmount: 0,
        excludeOwnShare: false, enableReinvestment: false, winningAmount: 2222, currentMemberDividend: 222
      };
      const atLimit = await firstValueFrom(service.calculateProfit(request));
      expect(atLimit.breakEvenDiscountAmount).toBe(2222);
      expect(atLimit.status).toBe('NO PROFIT / NO LOSS');
      expect((await firstValueFrom(service.calculateProfit({ ...request, winningAmount: 2223 }))).status).toBe('LOSS');
      expect((await firstValueFrom(service.calculateProfit({ ...request, pastInvestment: 30000 }))).breakEvenDiscountAmount).toBeNull();
    });

    it('should handle reinvestment calculations properly', async () => {
      const req: ProfitRequest = {
        chitValue: 700000,
        winningAmount: 100000,
        currentTermNumber: 6,
        totalMembers: 14,
        dividendDistributionType: 1,
        pastDividend: 0,
        pastInvestment: 250000,
        frequencyInMonths: 1,
        agentCommissionAmount: 0,
        enableReinvestment: true,
        excludeOwnShare: true,
        interestPercent: 24
      };

      const res = await firstValueFrom(service.calculateProfit(req));
      expect(res.monthlyInterest).toBe(11000);
      expect(res.interestPerTerm).toBe(11000);
      expect(res.totalReinvestmentInterest).toBe(88000); // 11,000 * 8 terms
      expect(res.extraPaymentPerTerm).toBe(39000); // 50,000 - 11,000
      expect(res.totalExtraPayment).toBe(312000); // 39,000 * 8
      expect(res.coverageStatus).toBe('PARTIAL');
    });

    it('should respect 0% explicit interest rate', async () => {
      const req: ProfitRequest = {
        chitValue: 500000,
        winningAmount: 50000,
        currentTermNumber: 5,
        totalMembers: 10,
        dividendDistributionType: 1,
        pastDividend: 0,
        pastInvestment: 200000,
        frequencyInMonths: 1,
        agentCommissionAmount: 0,
        enableReinvestment: true,
        excludeOwnShare: true,
        interestPercent: 0
      };

      const res = await firstValueFrom(service.calculateProfit(req));
      expect(res.annualInterestPercent).toBe(0);
      expect(res.monthlyInterest).toBe(0);
      expect(res.totalReinvestmentInterest).toBe(0);
    });
  });
});
