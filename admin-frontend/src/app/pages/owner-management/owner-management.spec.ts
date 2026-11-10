import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OwnerManagement } from './owner-management';

describe('OwnerManagement', () => {
  let component: OwnerManagement;
  let fixture: ComponentFixture<OwnerManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OwnerManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
