import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuctionComponent } from './auction';
import { Chit, ChitService } from '../services/chit.service';

function createChit(overrides: Partial<Chit> = {}): Chit {
  return {
    id: 'chit-1',
    name: 'Test chit',
    chitAmount: 100000,
    totalMembers: 10,
    frequencyInMonths: 1,
    startDate: '2026-01-01',
    chitType: 'NO_COMMISSION',
    status: 'ACTIVE',
    currentTermNumber: 1,
    openingPastInvestment: 0,
    isChitTaken: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    terms: [],
    termsCompleted: 1,
    termsPending: 9,
    remainingChits: 9,
    nextScheduledDate: '2026-02-01',
    endDate: '2026-10-01',
    installmentAmount: 10000,
    ...overrides
  };
}

describe('AuctionComponent', () => {
  let component: AuctionComponent;
  let fixture: ComponentFixture<AuctionComponent>;
  const chitServiceMock = {
    getChits: vi.fn().mockReturnValue(of([])),
    getSelectedChitId: vi.fn().mockReturnValue(null),
    getChit: vi.fn().mockReturnValue(of(null)),
    setSelectedChitId: vi.fn(),
    getPastInvestment: vi.fn().mockReturnValue(0)
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    chitServiceMock.getChits.mockReturnValue(of([]));
    chitServiceMock.getSelectedChitId.mockReturnValue(null);
    chitServiceMock.getChit.mockReturnValue(of(null));
    chitServiceMock.getPastInvestment.mockReturnValue(0);

    await TestBed.configureTestingModule({
      imports: [AuctionComponent],
      providers: [{ provide: ChitService, useValue: chitServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(AuctionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prefills the next upcoming term and the accumulated past investment from a saved chit', () => {
    const chit = createChit({ currentTermNumber: 4 });
    chitServiceMock.getChit.mockReturnValue(of(chit));
    chitServiceMock.getPastInvestment.mockReturnValue(40000);

    component.applySavedChit(chit.id);

    expect(component.selectedChit).toEqual(chit);
    expect(component.currentChitNumber).toBe(5);
    expect(component.pastInvestment).toBe(40000);
  });

  it('does not allow a completed saved chit to silently run a calculation', () => {
    const completedChit = createChit({
      status: 'COMPLETED',
      currentTermNumber: 10,
      termsCompleted: 10,
      termsPending: 0,
      remainingChits: 0,
      nextScheduledDate: ''
    });
    chitServiceMock.getChit.mockReturnValue(of(completedChit));

    component.applySavedChit(completedChit.id);
    component.discountAmount = 0;

    expect(component.currentChitNumber).toBe(10);
    expect(component.isSelectedChitCompleted()).toBe(true);
    expect(component.isFormValid()).toBe(false);
  });

  it('rejects negative money values, impossible bids, fractional members, and fractional terms', () => {
    setValidForm();
    component.pastInvestment = -1;
    expect(component.isFormValid()).toBe(false);

    setValidForm();
    component.discountAmount = 90000;
    component.excludeOwnShare = true;
    expect(component.isBidCombinationInvalid()).toBe(true);
    expect(component.isFormValid()).toBe(false);

    setValidForm();
    component.participants = 10.5;
    expect(component.isFormValid()).toBe(false);

    setValidForm();
    component.currentChitNumber = 1.5;
    expect(component.isFormValid()).toBe(false);
  });

  it('requires non-negative interest values only while reinvestment is enabled', () => {
    setValidForm();
    component.annualInterest = null;
    component.monthlyRupee = null;
    expect(component.isFormValid()).toBe(false);

    component.reinvestEnabled = false;
    expect(component.isFormValid()).toBe(true);

    component.reinvestEnabled = true;
    component.onInterestModelChange('percent', -1);
    expect(component.isFormValid()).toBe(false);
  });

  it('calculates with the exact entered annual interest rate', () => {
    setValidForm();
    component.onInterestModelChange('percent', 25);

    expect(component.monthlyRupee).toBe(2.08);
    component.validateAndCalculate();

    expect(component.profit?.annualInterestPercent).toBe(25);
    expect(component.showModalResults).toBe(true);
  });

  function setValidForm(): void {
    component.selectedChit = null;
    component.totalAmount = 100000;
    component.participants = 10;
    component.frequency = 1;
    component.agentCommissionAmount = 0;
    component.currentChitNumber = 1;
    component.pastInvestment = 0;
    component.discountAmount = 0;
    component.excludeOwnShare = false;
    component.reinvestEnabled = true;
    component.annualInterest = 24;
    component.monthlyRupee = 2;
  }
});
