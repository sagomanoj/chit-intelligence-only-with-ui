import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';

import { ChitCreateComponent } from './chit-create';
import { ChitService } from '../services/chit.service';

describe('ChitCreateComponent', () => {
  let component: ChitCreateComponent;
  let fixture: ComponentFixture<ChitCreateComponent>;
  const chitServiceMock = {
    createChit: vi.fn().mockReturnValue(of({
      id: 'new-chit',
      name: 'Example',
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
    }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChitCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ChitService, useValue: chitServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChitCreateComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
