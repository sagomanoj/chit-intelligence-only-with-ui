import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChitDetail } from './chit-detail';

describe('ChitDetail', () => {
  let component: ChitDetail;
  let fixture: ComponentFixture<ChitDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChitDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(ChitDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
