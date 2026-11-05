import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OwnerVerification } from './owner-verification';

describe('OwnerVerification', () => {
  let component: OwnerVerification;
  let fixture: ComponentFixture<OwnerVerification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OwnerVerification],
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerVerification);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
