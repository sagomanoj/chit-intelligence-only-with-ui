import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CalculationService } from './calculation.service';

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
});
