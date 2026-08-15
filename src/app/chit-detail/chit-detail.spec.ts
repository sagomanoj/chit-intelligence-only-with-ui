import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ChitDetailComponent } from './chit-detail';
import { ActivatedRoute, Router } from '@angular/router';
import { ChitService } from '../services/chit.service';

describe('ChitDetailComponent', () => {
  let component: ChitDetailComponent;
  let fixture: ComponentFixture<ChitDetailComponent>;
  const chitMock = {
    id: '1',
    name: 'Sample Chit',
    chitAmount: 100000,
    totalMembers: 10,
    frequencyInMonths: 1,
    startDate: '2026-06-16',
    chitType: 'NO_COMMISSION',
    status: 'ACTIVE',
    currentTermNumber: 0,
    openingPastInvestment: 0,
    isChitTaken: false,
    createdAt: '2026-06-16T00:00:00.000Z',
    updatedAt: '2026-06-16T00:00:00.000Z',
    terms: [],
    termsCompleted: 0,
    termsPending: 10,
    remainingChits: 10,
    nextScheduledDate: '2026-06-16',
    endDate: '2027-03-16',
    installmentAmount: 10000
  };
  const chitServiceMock = {
    getChit: vi.fn().mockReturnValue(of(chitMock)),
    addTerm: vi.fn().mockReturnValue(of({}))
  };
  const routerMock = {
    navigate: vi.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChitDetailComponent],
      providers: [
        { provide: ChitService, useValue: chitServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => key === 'id' ? '1' : null
              }
            }
          }
        },
        { provide: Router, useValue: routerMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChitDetailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
