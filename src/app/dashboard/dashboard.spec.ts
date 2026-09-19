import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard';
import { ChitService } from '../services/chit.service';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockChitService = {
    getChits: () => of([
      {
        id: 'chit-1',
        name: 'Test Chit 1 Lakh',
        chitValue: 100000,
        totalMembers: 10,
        installmentAmount: 10000,
        frequencyInMonths: 1,
        agentCommissionPercent: 5,
        agentCommissionAmount: 5000,
        dividendDistributionType: 1,
        organizerPayoutTerm: 1,
        startDate: '2026-01-01',
        status: 'ACTIVE',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }
    ]),
    getTermsSync: () => []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ChitService, useValue: mockChitService },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate portfolio overview KPIs and month schedule groups', () => {
    expect(component.totalPortfolioValue).toBe(100000);
    expect(component.monthGroups.length).toBe(10);
  });
});
