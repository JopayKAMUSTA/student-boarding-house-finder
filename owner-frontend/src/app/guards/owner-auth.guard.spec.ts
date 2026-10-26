import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { isObservable, lastValueFrom } from 'rxjs';
import { OwnerAuth } from '../services/owner-auth';
import { ownerAuthGuard } from './owner-auth.guard';

describe('ownerAuthGuard', () => {
  let authenticated: boolean;
  let ownerRole: string | undefined;
  let clearSession: () => void;

  beforeEach(() => {
    authenticated = false;
    ownerRole = undefined;
    clearSession = () => undefined;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: OwnerAuth,
          useValue: {
            isAuthenticated: () => authenticated,
            getOwner: () => ({ role: ownerRole }),
            clearSession: () => clearSession()
          }
        }
      ]
    });
  });

  async function runGuard(): Promise<GuardResult> {
    const result: MaybeAsync<GuardResult> = TestBed.runInInjectionContext(() =>
      ownerAuthGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );
    return isObservable(result) ? lastValueFrom(result) : result;
  }

  it('redirects unauthenticated users to login', async () => {
    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    if (result instanceof UrlTree) {
      expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login');
    }
  });

  it('clears a known non-owner session and redirects to login', async () => {
    authenticated = true;
    ownerRole = 'student';
    let wasCleared = false;
    clearSession = () => { wasCleared = true; };

    const result = await runGuard();

    expect(wasCleared).toBe(true);
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('allows an authenticated owner', async () => {
    authenticated = true;
    ownerRole = 'owner';

    expect(await runGuard()).toBe(true);
  });
});
