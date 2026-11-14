import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { BoardingHousePaymentMethodInfo, OwnerAuth } from '../../services/owner-auth';
import { PaymentMethods } from './payment-methods';

describe('PaymentMethods', () => {
  let fixture: ComponentFixture<PaymentMethods>;
  let component: PaymentMethods;
  let methods: BoardingHousePaymentMethodInfo[];
  let ownerAuth: {
    getToken: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
    getOwnerPaymentMethods: ReturnType<typeof vi.fn>;
    getOwnerPaymentMethodQr: ReturnType<typeof vi.fn>;
    createOwnerPaymentMethod: ReturnType<typeof vi.fn>;
    updateOwnerPaymentMethod: ReturnType<typeof vi.fn>;
    setOwnerPaymentMethodStatus: ReturnType<typeof vi.fn>;
    deleteOwnerPaymentMethod: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    methods = [];
    ownerAuth = {
      getToken: vi.fn(() => 'owner-token'),
      clearSession: vi.fn(),
      getOwnerPaymentMethods: vi.fn(() => of({ success: true, data: methods })),
      getOwnerPaymentMethodQr: vi.fn(() => of(new Blob(['qr'], { type: 'image/png' }))),
      createOwnerPaymentMethod: vi.fn((_token, _houseId, data: FormData) => {
        const method: BoardingHousePaymentMethodInfo = {
          id: 8,
          boarding_house_id: 42,
          provider: String(data.get('provider')),
          account_name: String(data.get('account_name')),
          account_number: String(data.get('account_number')),
          qr_code_url: '/qr',
          is_active: data.get('is_active') === '1'
        };
        methods.push(method);
        return of({ success: true, message: 'Created.', data: method });
      }),
      updateOwnerPaymentMethod: vi.fn(),
      setOwnerPaymentMethodStatus: vi.fn((_token, _houseId, _id, isActive: boolean) => of({
        success: true,
        data: { ...methods[0], is_active: isActive }
      })),
      deleteOwnerPaymentMethod: vi.fn(() => of({ success: true, message: 'Removed.' }))
    };

    await TestBed.configureTestingModule({
      imports: [PaymentMethods],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ boardingHouseId: '42' })
            }
          }
        },
        { provide: OwnerAuth, useValue: ownerAuth }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentMethods);
    component = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('requires a QR image before creating and then displays an owner payment method', () => {
    fixture.detectChanges();
    component.openCreateForm();
    component.accountName = 'House Owner';
    component.accountNumber = '09171234567';
    component.savePaymentMethod();
    expect(component.formError).toContain('Upload a QR code image');
    expect(ownerAuth.createOwnerPaymentMethod).not.toHaveBeenCalled();

    component.qrFile = new File(['qr'], 'qr.png', { type: 'image/png' });
    component.savePaymentMethod();
    fixture.detectChanges();

    expect(ownerAuth.createOwnerPaymentMethod).toHaveBeenCalledWith(
      'owner-token',
      42,
      expect.any(FormData)
    );
    expect(component.paymentMethods[0].provider).toBe('GCash');
    expect(fixture.nativeElement.textContent).toContain('House Owner');
  });

  it('allows the owner to deactivate and reactivate a saved method', () => {
    methods.push({
      id: 8,
      boarding_house_id: 42,
      provider: 'Maya',
      account_name: 'House Owner',
      account_number: '09170000000',
      qr_code_url: '/qr',
      is_active: true
    });
    fixture.detectChanges();

    component.toggleActive(methods[0]);
    expect(ownerAuth.setOwnerPaymentMethodStatus).toHaveBeenNthCalledWith(
      1,
      'owner-token',
      42,
      8,
      false
    );
    expect(methods[0].is_active).toBe(false);

    component.toggleActive(methods[0]);
    expect(methods[0].is_active).toBe(true);
  });
});
