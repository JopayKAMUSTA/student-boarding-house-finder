import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddBoardingHouse } from './add-boarding-house';

describe('AddBoardingHouse', () => {
  let component: AddBoardingHouse;
  let fixture: ComponentFixture<AddBoardingHouse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddBoardingHouse],
    }).compileComponents();

    fixture = TestBed.createComponent(AddBoardingHouse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
