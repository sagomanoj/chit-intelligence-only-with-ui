import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CalculationService, ProfitRequest } from './calculation.service';

function createProfitRequest(overrides: Partial<ProfitRequest> = {}): ProfitRequest {
  return {
    chitValue: 100000,
    winningAmount: 0,
    currentTermNumber: 1,
    totalMembers: 10,
    dividendDistributionType: 1,
    pastDividend: 0,
    pastInvestment: 0,
    frequencyInMonths: 1,
    agentCommissionAmount: 0,
    enableReinvestment: false,
    excludeOwnShare: false,
    ...overrides
  };
}

describe('CalculationService', () => {
  let service: CalculationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalculationService);
  });

  it('preserves a negative net profit when the bid produces a loss', async () => {
    const response = await firstValueFrom(service.calculateProfit({
      chitValue: 100000,
      winningAmount: 11000,
      currentTermNumber: 1,
      totalMembers: 10,
      dividendDistributionType: 1,
      pastDividend: 0,
      pastInvestment: 0,
      frequencyInMonths: 1,
      agentCommissionAmount: 0,
      enableReinvestment: false,
      excludeOwnShare: false
    }));

    expect(response.netProfit).toBeLessThan(0);
    expect(response.status).toBe('LOSS');
  });

  it('allows zero discount bids to be evaluated', async () => {
    const response = await firstValueFrom(service.calculateProfit({
      chitValue: 100000,
      winningAmount: 0,
      currentTermNumber: 1,
      totalMembers: 10,
      dividendDistributionType: 1,
      pastDividend: 0,
      pastInvestment: 0,
      frequencyInMonths: 1,
      agentCommissionAmount: 0,
      enableReinvestment: false,
      excludeOwnShare: false
    }));

    expect(response.takeHomeAmount).toBe(100000);
    expect(response.netProfit).toBeGreaterThan(0);
  });

  it('never returns a negative out-of-pocket value for reinvestment coverage', async () => {
    const response = await firstValueFrom(service.calculateReinvestment({
      winningAmount: 100000,
      interestPercent: 1200,
      remainingTerms: 1,
      installmentAmount: 10000
    }));

    expect(response.coverageStatus).toBe('FULLY_COVERED');
    expect(response.outOfPocket).toBe(0);
  });

  it('uses reinvestment interest to reduce future out-of-pocket investment and increase net profit', async () => {
    const withoutReinvestment = await firstValueFrom(
      service.calculateProfit(createProfitRequest())
    );
    const withReinvestment = await firstValueFrom(service.calculateProfit(createProfitRequest({
      enableReinvestment: true,
      interestPercent: 12
    })));

    expect(withoutReinvestment.futureInvestment).toBe(90000);
    expect(withReinvestment.totalReinvestmentInterest).toBe(9000);
    expect(withReinvestment.futureInvestment).toBe(81000);
    expect(withReinvestment.totalInvestment).toBe(81000);
    expect(withReinvestment.netProfit).toBe(19000);
    expect(withReinvestment.netProfit - withoutReinvestment.netProfit).toBe(9000);
  });

  it('subtracts the excluded current share only from take-home so it changes profit/loss', async () => {
    const included = await firstValueFrom(
      service.calculateProfit(createProfitRequest({ excludeOwnShare: false }))
    );
    const excluded = await firstValueFrom(
      service.calculateProfit(createProfitRequest({ excludeOwnShare: true }))
    );

    expect(excluded.installmentAmount).toBe(10000);
    expect(excluded.takeHomeAmount).toBe(included.takeHomeAmount - 10000);
    expect(excluded.futureInvestment).toBe(included.futureInvestment);
    expect(excluded.netProfit).toBe(included.netProfit - 10000);
  });

  it('keeps an explicitly entered annual rate instead of the rounded monthly equivalent', async () => {
    const response = await firstValueFrom(service.calculateProfit(createProfitRequest({
      enableReinvestment: true,
      interestPercent: 25,
      interestRupee: 2.08
    })));

    expect(response.annualInterestPercent).toBe(25);
    expect(response.interestRupee).toBeCloseTo(25 / 12, 6);
    expect(response.monthlyInterest).toBe(2083.33);
  });

  it('rejects negative past investment', async () => {
    await expect(firstValueFrom(service.calculateProfit(createProfitRequest({
      pastInvestment: -1
    })))).rejects.toThrow('Past investment cannot be negative.');
  });

  it('rejects bids whose discount, commission, and excluded share consume the chit value', async () => {
    await expect(firstValueFrom(service.calculateProfit(createProfitRequest({
      winningAmount: 85000,
      agentCommissionAmount: 5000,
      excludeOwnShare: true
    })))).rejects.toThrow('must be less than the chit value');
  });

  it('requires a valid non-negative interest rate when reinvestment is enabled', async () => {
    const missingRate = firstValueFrom(service.calculateProfit(createProfitRequest({
      enableReinvestment: true
    })));
    const negativeRate = firstValueFrom(service.calculateProfit(createProfitRequest({
      enableReinvestment: true,
      interestPercent: -0.01
    })));
    const nonFiniteRate = firstValueFrom(service.calculateProfit(createProfitRequest({
      enableReinvestment: true,
      interestPercent: Number.NaN
    })));

    await expect(missingRate).rejects.toThrow('interest rate is required');
    await expect(negativeRate).rejects.toThrow('non-negative');
    await expect(nonFiniteRate).rejects.toThrow('non-negative');
  });

  it('requires whole numbers for total members and the current term', async () => {
    const fractionalMembers = firstValueFrom(service.calculateProfit(createProfitRequest({
      totalMembers: 10.5
    })));
    const fractionalTerm = firstValueFrom(service.calculateProfit(createProfitRequest({
      currentTermNumber: 1.5
    })));

    await expect(fractionalMembers).rejects.toThrow('positive whole number');
    await expect(fractionalTerm).rejects.toThrow('whole number');
  });
});
