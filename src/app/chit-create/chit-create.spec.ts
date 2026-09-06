import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChitCreateComponent } from './chit-create';
import { ChitService } from '../services/chit.service';

describe('ChitCreateComponent', () => {
  let component: ChitCreateComponent;
  let fixture: ComponentFixture<ChitCreateComponent>;

  beforeEach(async () => {
    const mockChitService = {
      getChits: () => of([]),
      getChit: () => of(null),
      createChit: () => of(null),
      addTerm: () => of(null),
      getTerms: () => of([])
    };

    await TestBed.configureTestingModule({
      imports: [ChitCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ChitService, useValue: mockChitService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChitCreateComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
