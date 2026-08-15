import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuctionComponent } from './auction';
import { ChitService } from '../services/chit.service';

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
});
