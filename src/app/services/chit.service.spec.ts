import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { ChitService, ChitUpsertRequest } from './chit.service';

describe('ChitService', () => {
  let service: ChitService;
  const storageKey = 'chit-intelligence.local.chits';
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const request = (overrides: Partial<ChitUpsertRequest> = {}): ChitUpsertRequest => ({
    name: 'Example chit',
    chitAmount: 100000,
    totalMembers: 10,
    frequencyInMonths: 1,
    startDate: '2026-06-16',
    chitType: 'NO_COMMISSION',
    currentTermNumber: 0,
    openingPastInvestment: 0,
    notes: '',
    ...overrides
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

  it('rejects fractional member and current-term values instead of rounding them', async () => {
    await expect(firstValueFrom(service.createChit(request({ totalMembers: 10.5 })))).rejects.toThrow(/whole number/i);
    await expect(firstValueFrom(service.createChit(request({ currentTermNumber: 1.5 })))).rejects.toThrow(/whole number/i);
  });

  it('enforces the next sequential whole-number term', async () => {
    const chit = await firstValueFrom(service.createChit(request()));

    await expect(firstValueFrom(service.addTerm(chit.id, {
      termNumber: 2,
      termDate: '2026-07-16',
      isChitTaken: false
    }))).rejects.toThrow(/next term must be term 1/i);

    await expect(firstValueFrom(service.addTerm(chit.id, {
      termNumber: 1.5,
      termDate: '2026-06-16',
      isChitTaken: false
    }))).rejects.toThrow(/whole number/i);

    await firstValueFrom(service.addTerm(chit.id, {
      termNumber: 1,
      termDate: '2026-06-16',
      isChitTaken: false
    }));

    await expect(firstValueFrom(service.addTerm(chit.id, {
      termNumber: 3,
      termDate: '2026-08-16',
      isChitTaken: false
    }))).rejects.toThrow(/next term must be term 2/i);
  });

  it('prevents edits that conflict with existing term records', async () => {
    const chit = await firstValueFrom(service.createChit(request()));
    await firstValueFrom(service.addTerm(chit.id, {
      termNumber: 1,
      termDate: '2026-06-16',
      isChitTaken: false
    }));

    await expect(firstValueFrom(service.updateChit(chit.id, { currentTermNumber: 2 })))
      .rejects.toThrow(/cannot be changed/i);
    await expect(firstValueFrom(service.updateChit(chit.id, { totalMembers: 0 })))
      .rejects.toThrow();
  });

  it('requires a positive taken amount', async () => {
    const chit = await firstValueFrom(service.createChit(request()));

    await expect(firstValueFrom(service.addTerm(chit.id, {
      termNumber: 1,
      termDate: '2026-06-16',
      isChitTaken: true,
      takenAmount: 0
    }))).rejects.toThrow(/greater than zero/i);
  });

  it('clamps month-end schedules using UTC dates', async () => {
    const chit = await firstValueFrom(service.createChit(request({
      totalMembers: 3,
      startDate: '2026-01-31'
    })));
    expect(chit.nextScheduledDate).toBe('2026-01-31');
    expect(chit.endDate).toBe('2026-03-31');

    await firstValueFrom(service.addTerm(chit.id, {
      termNumber: 1,
      termDate: '2026-01-31',
      isChitTaken: false
    }));
    const afterFirstTerm = await firstValueFrom(service.getChit(chit.id));
    expect(afterFirstTerm?.nextScheduledDate).toBe('2026-02-28');
  });

  it('emits corrupted JSON as an observable error instead of an empty list', async () => {
    storage.setItem(storageKey, '{not-json');

    expect(() => service.getChits()).not.toThrow();
    await expect(firstValueFrom(service.getChits())).rejects.toThrow(/corrupted/i);
  });

  it('emits unavailable storage as an observable error', async () => {
    vi.stubGlobal('localStorage', undefined);

    expect(() => service.createChit(request())).not.toThrow();
    await expect(firstValueFrom(service.createChit(request()))).rejects.toThrow(/storage is unavailable/i);
  });

  it('emits quota failures instead of reporting a successful create', async () => {
    const quotaStorage = {
      ...storage,
      setItem: () => {
        const error = new Error('full');
        error.name = 'QuotaExceededError';
        throw error;
      }
    };
    vi.stubGlobal('localStorage', quotaStorage);

    await expect(firstValueFrom(service.createChit(request()))).rejects.toThrow(/storage is full/i);
  });
});
