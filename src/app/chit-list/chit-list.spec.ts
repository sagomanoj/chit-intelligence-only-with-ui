import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChitListComponent } from './chit-list';
import { ChitService } from '../services/chit.service';

describe('ChitListComponent', () => {
  let component: ChitListComponent;
  let fixture: ComponentFixture<ChitListComponent>;

  beforeEach(async () => {
    const mockChitService = {
      getChits: () => of([]),
      getChit: () => of(null),
      createChit: () => of(null),
      addTerm: () => of(null),
      getTerms: () => of([])
    };

    await TestBed.configureTestingModule({
      imports: [ChitListComponent],
      providers: [
        provideRouter([]),
        { provide: ChitService, useValue: mockChitService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChitListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});


