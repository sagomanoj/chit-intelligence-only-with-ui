import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { ChitService } from './chit.service';

describe('ChitService', () => {
  let service: ChitService;
  const storage = (() => {
    let backing = new Map<string, string>();
    return {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => {
        backing.set(key, value);
      },
      removeItem: (key: string) => {
        backing.delete(key);
      },
      clear: () => {
        backing = new Map<string, string>();
      }
    };
  })();

  beforeEach(() => {
    vi.stubGlobal('localStorage', storage);
    storage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChitService);
  });

  it('creates and reloads a chit from local storage', async () => {
    const created = await firstValueFrom(service.createChit({
      name: 'Example chit',
      chitAmount: 100000,
      totalMembers: 10,
      frequencyInMonths: 1,
      startDate: '2026-06-16',
      chitType: 'NO_COMMISSION',
      currentTermNumber: 0,
      openingPastInvestment: 0,
      notes: ''
    }));

    const list = await firstValueFrom(service.getChits());
    const loaded = await firstValueFrom(service.getChit(created.id));

    expect(list.length).toBe(1);
    expect(loaded?.name).toBe('Example chit');
    expect(loaded?.installmentAmount).toBe(10000);
  });

  it('prevents a chit from being marked as taken twice', async () => {
    const chit = await firstValueFrom(service.createChit({
      name: 'Taken chit',
      chitAmount: 100000,
      totalMembers: 10,
      frequencyInMonths: 1,
      startDate: '2026-06-16',
      chitType: 'AGENT_FIXED_AMOUNT_EACH_TERM',
      currentTermNumber: 0,
      openingPastInvestment: 0,
      agentCommissionAmount: 500,
      notes: ''
    }));

    await firstValueFrom(service.addTerm(chit.id, {
      termNumber: 1,
      termDate: '2026-06-16',
      isChitTaken: true,
      investedAmount: 10000,
      takenAmount: 25000,
      notes: ''
    }));

    await expect(firstValueFrom(service.addTerm(chit.id, {
      termNumber: 2,
      termDate: '2026-07-16',
      isChitTaken: true,
      investedAmount: 10000,
      takenAmount: 20000,
      notes: ''
    }))).rejects.toThrow();
  });
});
