import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Auction } from './auction';

describe('Auction', () => {
  let component: Auction;
  let fixture: ComponentFixture<Auction>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Auction],
    }).compileComponents();

    fixture = TestBed.createComponent(Auction);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
