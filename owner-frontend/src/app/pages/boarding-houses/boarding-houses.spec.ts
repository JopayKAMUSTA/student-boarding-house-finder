import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BoardingHouses } from './boarding-houses';

describe('BoardingHouses', () => {
  let component: BoardingHouses;
  let fixture: ComponentFixture<BoardingHouses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardingHouses],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardingHouses);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
