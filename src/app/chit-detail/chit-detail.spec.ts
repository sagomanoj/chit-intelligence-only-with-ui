import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChitDetailComponent } from './chit-detail';
import { ChitService } from '../services/chit.service';

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
});
