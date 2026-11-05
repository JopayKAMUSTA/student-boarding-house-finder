import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Register } from './register';
import { OwnerAuth } from '../../services/owner-auth';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        { provide: OwnerAuth, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles the password and confirmation fields independently', () => {
    const toggles = fixture.nativeElement.querySelectorAll('.password-toggle') as NodeListOf<HTMLButtonElement>;
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    const confirmation = fixture.nativeElement.querySelector('#password_confirmation') as HTMLInputElement;

    expect(password.type).toBe('password');
    expect(confirmation.type).toBe('password');

    toggles[0].click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
    expect(confirmation.type).toBe('password');
    expect(toggles[0].getAttribute('aria-label')).toBe('Hide password');

    toggles[1].click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
    expect(confirmation.type).toBe('text');
    expect(toggles[1].getAttribute('aria-label')).toBe('Hide confirmation password');
  });
});
