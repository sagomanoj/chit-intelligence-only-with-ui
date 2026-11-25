import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChitDetailComponent } from './chit-detail';
import { ChitService } from '../services/chit.service';
import { AppAdsService } from '../services/app-ads.service';

describe('ChitDetailComponent', () => {
  let component: ChitDetailComponent;
  let fixture: ComponentFixture<ChitDetailComponent>;

  beforeEach(async () => {
    const mockChitService = {
      getChits: () => of([]),
      getChit: () => of(undefined),
      createChit: () => of(null),
      addTerm: () => of(null),
      getTerms: () => of([]),
      getChitSummary: () => null
    };

    await TestBed.configureTestingModule({
      imports: [ChitDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ChitService, useValue: mockChitService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChitDetailComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers an interstitial after a new cycle is saved and skips edits', () => {
    const show = vi.spyOn(TestBed.inject(AppAdsService), 'showInterstitialAtNaturalBreak')
      .mockResolvedValue(undefined);
    component.chit = {
      id: 'group', name: 'Family', chitValue: 100000, totalMembers: 10,
      installmentAmount: 10000, frequencyInMonths: 1, agentCommissionPercent: 0,
      agentCommissionAmount: 0, dividendDistributionType: 0, organizerPayoutTerm: 1,
      status: 'ACTIVE', createdAt: '2026-11-01', updatedAt: '2026-11-01'
    };
    component.isEditing = true;
    component.editingTermId = 'existing-cycle';
    component.saveTerm();
    expect(show).not.toHaveBeenCalled();
    component.isEditing = false;
    component.saveTerm();
    expect(show).toHaveBeenCalledOnce();
  });
});
