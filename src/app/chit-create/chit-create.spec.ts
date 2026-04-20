import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChitCreate } from './chit-create';

describe('ChitCreate', () => {
  let component: ChitCreate;
  let fixture: ComponentFixture<ChitCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChitCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(ChitCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
