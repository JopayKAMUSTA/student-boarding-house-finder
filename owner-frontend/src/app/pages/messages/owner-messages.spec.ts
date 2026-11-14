import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OwnerMessages } from './owner-messages';
import { OwnerAuth } from '../../services/owner-auth';

describe('OwnerMessages', () => {
  let fixture: ComponentFixture<OwnerMessages>;
  let ownerAuth: {
    getToken: ReturnType<typeof vi.fn>;
    getOwnerConversations: ReturnType<typeof vi.fn>;
    getOwnerMessageRecipients: ReturnType<typeof vi.fn>;
    getOwnerConversationMessages: ReturnType<typeof vi.fn>;
    markOwnerConversationRead: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  const conversation = {
    id: 21,
    tenant_id: 8,
    boarding_house_id: 12,
    tenant: { id: 8, full_name: 'Tenant Name', user_id: 17 },
    boarding_house: { id: 12, name: 'Blue House' },
    latest_message: {
      id: 31,
      body: 'Hello from tenant',
      sender: { id: 17, name: 'Tenant Name', role: 'student' },
      created_at: '2026-11-14T12:00:00.000000Z'
    },
    unread_count: 1,
    created_at: '2026-11-14T12:00:00.000000Z',
    updated_at: '2026-11-14T12:00:00.000000Z'
  };

  beforeEach(async () => {
    ownerAuth = {
      getToken: vi.fn(() => 'owner-token'),
      getOwnerConversations: vi.fn(() => of({
        success: true,
        data: {
          data: [conversation],
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 1
        }
      })),
      getOwnerMessageRecipients: vi.fn(() => of({
        success: true,
        data: {
          data: [{
            tenant_id: 8,
            tenant_name: 'Tenant Name',
            boarding_house_id: 12,
            boarding_house_name: 'Blue House'
          }],
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: 1
        }
      })),
      getOwnerConversationMessages: vi.fn(() => of({
        success: true,
        data: {
          data: [{
            id: 31,
            conversation_id: 21,
            sender_id: 17,
            sender: { id: 17, name: 'Tenant Name', role: 'student' },
            body: 'Hello from tenant',
            read_at: null,
            created_at: '2026-11-14T12:00:00.000000Z',
            attachments: []
          }],
          current_page: 1,
          last_page: 1,
          per_page: 30,
          total: 1
        }
      })),
      markOwnerConversationRead: vi.fn(() => of({
        success: true,
        data: { marked_read: 1 }
      })),
      clearSession: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [OwnerMessages],
      providers: [
        provideRouter([]),
        { provide: OwnerAuth, useValue: ownerAuth }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerMessages);
    fixture.detectChanges();
  });

  it('loads conversations, displays their messages, and marks them read', () => {
    expect(fixture.nativeElement.textContent).toContain('Messages');
    expect(fixture.nativeElement.textContent).toContain('Tenant Name');
    const conversationButton = fixture.nativeElement.querySelector(
      '.conversation-item'
    ) as HTMLButtonElement;
    conversationButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hello from tenant');
    expect(ownerAuth.getOwnerConversationMessages).toHaveBeenCalledWith(
      'owner-token',
      21,
      1
    );
    expect(ownerAuth.markOwnerConversationRead).toHaveBeenCalledWith('owner-token', 21);
  });
});
