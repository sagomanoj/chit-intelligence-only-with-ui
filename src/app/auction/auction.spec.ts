import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuctionComponent } from './auction';
import { provideRouter } from '@angular/router';

describe('AuctionComponent', () => {
  let component: AuctionComponent;
  let fixture: ComponentFixture<AuctionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuctionComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AuctionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
