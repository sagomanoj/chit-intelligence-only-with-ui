import { TestBed } from '@angular/core/testing';
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
