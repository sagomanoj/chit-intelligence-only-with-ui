import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChitList } from './chit-list';

describe('ChitList', () => {
  let component: ChitList;
  let fixture: ComponentFixture<ChitList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChitList],
    }).compileComponents();

    fixture = TestBed.createComponent(ChitList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
