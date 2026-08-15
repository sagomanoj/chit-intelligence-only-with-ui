import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuctionComponent } from './auction';

describe('AuctionComponent', () => {
  let component: AuctionComponent;
  let fixture: ComponentFixture<AuctionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuctionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AuctionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

