import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ChitListComponent } from './chit-list';
import { ChitService } from '../services/chit.service';
import { Router } from '@angular/router';

describe('ChitListComponent', () => {
  let component: ChitListComponent;
  let fixture: ComponentFixture<ChitListComponent>;
  const chitServiceMock = {
    getChits: vi.fn().mockReturnValue(of([]))
  };
  const routerMock = {
    navigate: vi.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChitListComponent],
      providers: [
        { provide: ChitService, useValue: chitServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChitListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
