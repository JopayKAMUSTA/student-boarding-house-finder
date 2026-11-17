import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ConversationInfo,
  ConversationMessageInfo,
  MessageAttachmentInfo,
  MessageRecipientInfo,
  OwnerAuth
} from '../../services/owner-auth';

@Component({
  selector: 'app-owner-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './owner-messages.html',
  styleUrl: './owner-messages.css'
})
export class OwnerMessages implements OnInit, OnDestroy {
  private readonly ownerAuth = inject(OwnerAuth);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private conversationRequest = new Subscription();
  private recipientRequest = new Subscription();
  private messageRequest = new Subscription();
  private attachmentRequests = new Subscription();
  private readonly requestedAttachmentIds = new Set<number>();
  private readonly attachmentUrls: Record<number, string> = {};
  private readonly attachmentErrors: Record<number, string> = {};
  private readonly localAttachmentUrls: Record<number, string> = {};

  conversations: ConversationInfo[] = [];
  recipients: MessageRecipientInfo[] = [];
  messages: ConversationMessageInfo[] = [];
  selectedConversation: ConversationInfo | null = null;
  selectedRecipient = '';
  currentPage = 1;
  lastPage = 1;
  totalConversations = 0;
  currentMessagesPage = 1;
  lastMessagesPage = 1;
  totalMessages = 0;
  draftMessage = '';
  selectedFiles: File[] = [];
  isLoadingConversations = false;
  isLoadingRecipients = false;
  isLoadingMessages = false;
  isSending = false;
  isCreatingConversation = false;
  isNewConversationOpen = false;
  errorMessage = '';
  messageError = '';
  sendError = '';
  recipientError = '';

  ngOnInit(): void {
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }
    this.loadConversations();
    this.loadRecipients(token);
  }

  ngOnDestroy(): void {
    this.conversationRequest.unsubscribe();
    this.recipientRequest.unsubscribe();
    this.messageRequest.unsubscribe();
    this.attachmentRequests.unsubscribe();
    this.revokeAttachmentUrls();
    this.revokeLocalAttachmentUrls();
  }

  get attachmentImageUrls(): Record<number, string> {
    return this.attachmentUrls;
  }

  get attachmentLoadErrors(): Record<number, string> {
    return this.attachmentErrors;
  }

  get selectedRecipientOptions(): MessageRecipientInfo[] {
    return this.recipients;
  }

  loadConversations(page = this.currentPage, selectId?: number): void {
    const token = this.getTokenOrRedirect();
    if (!token) {
      return;
    }
    this.isLoadingConversations = true;
    this.errorMessage = '';
    this.conversationRequest.unsubscribe();
    this.conversationRequest = new Subscription();
    this.conversationRequest.add(this.ownerAuth.getOwnerConversations(token, page).subscribe({
      next: (response) => {
        this.isLoadingConversations = false;
        if (!response?.success || !Array.isArray(response.data?.data)) {
          this.errorMessage = 'The conversation list response was not valid.';
          this.cdr.detectChanges();
          return;
        }
        this.conversations = response.data.data;
        this.currentPage = response.data.current_page;
        this.lastPage = response.data.last_page;
        this.totalConversations = response.data.total;
        if (selectId) {
          const createdConversation = this.conversations.find((item) => item.id === selectId);
          if (createdConversation) {
            this.selectConversation(createdConversation);
          }
        } else if (this.selectedConversation) {
          this.selectedConversation = this.conversations.find(
            (item) => item.id === this.selectedConversation?.id
          ) ?? this.selectedConversation;
        }
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingConversations = false;
        this.handleError(error, 'Could not load conversations.', true);
        this.cdr.detectChanges();
      }
    }));
  }

  selectConversation(conversation: ConversationInfo): void {
    if (this.selectedConversation?.id !== conversation.id) {
      this.messageRequest.unsubscribe();
      this.attachmentRequests.unsubscribe();
      this.attachmentRequests = new Subscription();
      this.requestedAttachmentIds.clear();
      this.revokeAttachmentUrls();
      this.messages = [];
      this.messageError = '';
      this.currentMessagesPage = 1;
    }
    this.selectedConversation = conversation;
    this.loadMessages(1);
  }

  loadMessages(page = 1): void {
    const token = this.getTokenOrRedirect();
    const conversation = this.selectedConversation;
    if (!token || !conversation) {
      return;
    }
    this.isLoadingMessages = true;
    this.messageError = '';
    this.messageRequest.unsubscribe();
    this.messageRequest = new Subscription();
    this.messageRequest.add(this.ownerAuth.getOwnerConversationMessages(
      token,
      conversation.id,
      page
    ).subscribe({
      next: (response) => {
        this.isLoadingMessages = false;
        if (!response?.success || !Array.isArray(response.data?.data)) {
          this.messageError = 'The message history response was not valid.';
          this.cdr.detectChanges();
          return;
        }
        this.messages = response.data.data;
        this.currentMessagesPage = response.data.current_page;
        this.lastMessagesPage = response.data.last_page;
        this.totalMessages = response.data.total;
        this.loadAttachmentPreviews(response.data.data, token, conversation.id);
        this.markConversationRead(token, conversation);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingMessages = false;
        this.handleError(error, 'Could not load messages.', true);
        this.messageError = this.errorMessage;
        this.errorMessage = '';
        this.cdr.detectChanges();
      }
    }));
  }

  previousConversations(): void {
    if (!this.isLoadingConversations && this.currentPage > 1) {
      this.loadConversations(this.currentPage - 1);
    }
  }

  nextConversations(): void {
    if (!this.isLoadingConversations && this.currentPage < this.lastPage) {
      this.loadConversations(this.currentPage + 1);
    }
  }

  loadOlderMessages(): void {
    if (!this.isLoadingMessages && this.currentMessagesPage < this.lastMessagesPage) {
      this.loadMessages(this.currentMessagesPage + 1);
    }
  }

  loadNewerMessages(): void {
    if (!this.isLoadingMessages && this.currentMessagesPage > 1) {
      this.loadMessages(this.currentMessagesPage - 1);
    }
  }

  openNewConversation(): void {
    this.isNewConversationOpen = true;
    this.selectedRecipient = '';
    this.sendError = '';
  }

  closeNewConversation(): void {
    if (!this.isCreatingConversation) {
      this.isNewConversationOpen = false;
    }
  }

  createConversation(): void {
    const token = this.getTokenOrRedirect();
    const [tenantId, boardingHouseId] = this.selectedRecipient.split(':').map(Number);
    if (!token || !tenantId || !boardingHouseId || this.isCreatingConversation) {
      return;
    }
    this.isCreatingConversation = true;
    this.sendError = '';
    this.ownerAuth.createOwnerConversation(token, {
      tenant_id: tenantId,
      boarding_house_id: boardingHouseId
    }).subscribe({
      next: (response) => {
        this.isCreatingConversation = false;
        this.isNewConversationOpen = false;
        if (!response?.success || !response.data) {
          this.sendError = response?.message || 'Could not start the conversation.';
          this.cdr.detectChanges();
          return;
        }
        this.loadConversations(1, response.data.id);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isCreatingConversation = false;
        this.handleError(error, 'Could not start the conversation.', false);
        this.cdr.detectChanges();
      }
    });
  }

  selectAttachments(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.sendError = '';
    if (files.length > 5) {
      this.sendError = 'You can attach up to five files per message.';
      input.value = '';
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const invalidFile = files.find((file) =>
      !allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024
    );
    if (invalidFile) {
      this.sendError = 'Use JPG, PNG, WEBP, or PDF files up to 10 MB each.';
      input.value = '';
      return;
    }
    this.selectedFiles = files;
    this.revokeLocalAttachmentUrls();
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        this.localAttachmentUrls[index] = URL.createObjectURL(file);
      }
    });
  }

  localImagePreview(index: number): string | null {
    return this.localAttachmentUrls[index] ?? null;
  }

  removeSelectedFile(index: number): void {
    this.setSelectedFiles(this.selectedFiles.filter((_, fileIndex) => fileIndex !== index));
  }

  sendMessage(): void {
    const token = this.getTokenOrRedirect();
    const conversation = this.selectedConversation;
    const body = this.draftMessage.trim();
    if (!token || !conversation || this.isSending) {
      return;
    }
    if (!body && this.selectedFiles.length === 0) {
      this.sendError = 'Write a message or attach a file.';
      return;
    }
    const data = new FormData();
    if (body) {
      data.append('body', body);
    }
    this.selectedFiles.forEach((file) => data.append('attachments[]', file));
    this.isSending = true;
    this.sendError = '';
    this.ownerAuth.sendOwnerConversationMessage(token, conversation.id, data).subscribe({
      next: (response) => {
        this.isSending = false;
        if (!response?.success) {
          this.sendError = response?.message || 'The message was not sent.';
          this.cdr.detectChanges();
          return;
        }
        this.draftMessage = '';
        this.selectedFiles = [];
        this.revokeLocalAttachmentUrls();
        this.loadMessages(1);
        this.loadConversations(this.currentPage);
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isSending = false;
        this.handleError(error, 'The message was not sent.', false);
        this.sendError = this.errorMessage;
        this.errorMessage = '';
        this.cdr.detectChanges();
      }
    });
  }

  handleMessageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  isImage(attachment: MessageAttachmentInfo): boolean {
    return attachment.mime_type.startsWith('image/');
  }

  openPdf(attachment: MessageAttachmentInfo): void {
    const url = this.attachmentUrls[attachment.id];
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }

  downloadAttachment(attachment: MessageAttachmentInfo): void {
    const url = this.attachmentUrls[attachment.id];
    if (!url) {
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.original_filename;
    link.rel = 'noopener';
    link.click();
  }

  messagePreview(message: ConversationInfo['latest_message']): string {
    return message?.body || 'Attachment';
  }

  conversationDisplayName(conversation: ConversationInfo): string {
  return conversation.tenant?.full_name || 'Unknown Tenant';
}

conversationDisplayInitial(conversation: ConversationInfo): string {
  const name = this.conversationDisplayName(conversation).trim();
  return name.charAt(0).toUpperCase() || '?';
}

  trackConversation(_: number, conversation: ConversationInfo): number {
    return conversation.id;
  }

  trackMessage(_: number, message: ConversationMessageInfo): number {
    return message.id;
  }

  trackAttachment(_: number, attachment: MessageAttachmentInfo): number {
    return attachment.id;
  }

  private loadRecipients(token: string): void {
    this.isLoadingRecipients = true;
    this.recipientRequest.add(this.ownerAuth.getOwnerMessageRecipients(token).subscribe({
      next: (response) => {
        this.isLoadingRecipients = false;
        if (!response?.success || !Array.isArray(response.data?.data)) {
          this.recipientError = 'The recipient list response was not valid.';
        } else {
          this.recipientError = '';
          this.recipients = response.data.data;
        }
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingRecipients = false;
        this.handleError(error, 'Could not load message recipients.', false);
        this.recipientError = this.sendError;
        this.sendError = '';
        this.cdr.detectChanges();
      }
    }));
  }

  private loadAttachmentPreviews(
    messages: ConversationMessageInfo[],
    token: string,
    conversationId: number
  ): void {
    for (const message of messages) {
      for (const attachment of message.attachments) {
        if (this.requestedAttachmentIds.has(attachment.id)) {
          continue;
        }
        this.requestedAttachmentIds.add(attachment.id);
        this.attachmentRequests.add(this.ownerAuth.getOwnerMessageAttachment(
          token,
          conversationId,
          attachment.id
        ).subscribe({
          next: (blob) => {
            if (
              attachment.mime_type.startsWith('image/') &&
              !blob.type.startsWith('image/')
            ) {
              this.attachmentErrors[attachment.id] = 'Image preview is unavailable.';
            } else {
              this.attachmentUrls[attachment.id] = URL.createObjectURL(blob);
            }
            this.cdr.detectChanges();
          },
          error: () => {
            this.attachmentErrors[attachment.id] = 'Attachment could not be loaded.';
            this.cdr.detectChanges();
          }
        }));
      }
    }
  }

  private markConversationRead(token: string, conversation: ConversationInfo): void {
    this.ownerAuth.markOwnerConversationRead(token, conversation.id).subscribe({
      next: () => {
        conversation.unread_count = 0;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.handleError(error, 'Messages loaded, but unread status could not be updated.', false);
        this.cdr.detectChanges();
      }
    });
  }

  private getTokenOrRedirect(): string | null {
    const token = this.ownerAuth.getToken();
    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
      return null;
    }
    return token;
  }

  private handleError(
    error: HttpErrorResponse,
    fallback: string,
    usePageError: boolean
  ): void {
    if (error.status === 401) {
      this.ownerAuth.clearSession();
      void this.router.navigate(['/login'], {
        queryParams: { notice: 'session-expired' }
      });
    }
    const message = typeof error.error?.message === 'string'
      ? error.error.message
      : error.status === 0
        ? 'Could not connect to the API. Check that Laravel is running and CORS is configured.'
        : fallback;
    if (usePageError) {
      this.errorMessage = message;
    } else {
      this.sendError = message;
    }
  }

  private revokeAttachmentUrls(): void {
    Object.values(this.attachmentUrls).forEach((url) => URL.revokeObjectURL(url));
    for (const id of Object.keys(this.attachmentUrls)) {
      delete this.attachmentUrls[Number(id)];
    }
    for (const id of Object.keys(this.attachmentErrors)) {
      delete this.attachmentErrors[Number(id)];
    }
  }

  private revokeLocalAttachmentUrls(): void {
    Object.values(this.localAttachmentUrls).forEach((url) => URL.revokeObjectURL(url));
    for (const index of Object.keys(this.localAttachmentUrls)) {
      delete this.localAttachmentUrls[Number(index)];
    }
  }

  private setSelectedFiles(files: File[]): void {
    this.revokeLocalAttachmentUrls();
    this.selectedFiles = files;
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        this.localAttachmentUrls[index] = URL.createObjectURL(file);
      }
    });
  }
}
