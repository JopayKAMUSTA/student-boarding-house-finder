import { Subject } from 'rxjs';
import {
  ManagedOwner,
  OwnerListResponse,
  OwnerVerificationResponse,
  UserService
} from '../../services/user';
import { OwnerVerification } from './owner-verification';

describe('OwnerVerification', () => {
  let component: OwnerVerification;
  let ownerList: Subject<OwnerListResponse>;
  let verificationUpdate: Subject<OwnerVerificationResponse>;
  let requestedStatus: 'approved' | 'rejected' | null;
  const owner: ManagedOwner = {
    id: 8,
    name: 'Jordan Owner',
    first_name: 'Jordan',
    middle_name: null,
    last_name: 'Owner',
    email: 'jordan@example.com',
    role: 'owner',
    status: 'active',
    created_at: '2026-10-01T00:00:00.000000Z',
    updated_at: '2026-10-01T00:00:00.000000Z',
    owner_profile: {
      id: 3,
      user_id: 8,
      contact_number: '09123456789',
      business_name: 'Tagum Stay',
      business_address: 'Tagum City',
      verification_status: 'pending',
      verified_at: null,
      created_at: '2026-10-01T00:00:00.000000Z',
      updated_at: '2026-10-01T00:00:00.000000Z'
    }
  };

  beforeEach(() => {
    ownerList = new Subject<OwnerListResponse>();
    verificationUpdate = new Subject<OwnerVerificationResponse>();
    requestedStatus = null;
    const userService = {
      getOwners: () => ownerList.asObservable(),
      updateOwnerVerification: (_ownerId: number, status: 'approved' | 'rejected') => {
        requestedStatus = status;
        return verificationUpdate.asObservable();
      }
    } as UserService;

    component = new OwnerVerification(userService);
  });

  it('loads the owner list and updates verification with success feedback', () => {
    component.loadOwners();
    ownerList.next({
      success: true,
      data: {
        data: [owner],
        current_page: 1,
        last_page: 1,
        total: 1
      }
    });
    ownerList.complete();

    expect(component.owners).toEqual([owner]);
    expect(component.ownerName(owner)).toBe('Jordan Owner');
    expect(component.loading).toBe(false);

    component.updateVerification(owner, 'approved');
    expect(requestedStatus).toBe('approved');
    verificationUpdate.next({
      success: true,
      message: 'Owner verification approved.',
      data: {
        ...owner,
        owner_profile: {
          ...owner.owner_profile!,
          verification_status: 'approved',
          verified_at: '2026-11-05T00:00:00.000000Z'
        }
      }
    });
    verificationUpdate.complete();

    expect(component.owners[0].owner_profile?.verification_status).toBe('approved');
    expect(component.successMessage).toBe('Owner verification approved.');
    expect(component.updatingOwnerId).toBeNull();
  });

  it('shows API errors when owner data cannot be loaded or updated', () => {
    component.loadOwners();
    ownerList.error({ error: { message: 'Owner list unavailable.' } });
    expect(component.errorMessage).toBe('Owner list unavailable.');
    expect(component.loading).toBe(false);

    component.owners = [owner];
    component.updateVerification(owner, 'rejected');
    verificationUpdate.error({ error: { message: 'Update unavailable.' } });
    expect(component.errorMessage).toBe('Update unavailable.');
    expect(component.updatingOwnerId).toBeNull();
  });
});
