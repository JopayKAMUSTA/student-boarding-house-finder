# Owner–Tenant Messaging API

All routes require a Laravel Sanctum bearer token:

```http
Authorization: Bearer <token>
Accept: application/json
```

Owner routes require an authenticated `owner`; Student routes require an authenticated `student`. A conversation can be started only for a linked tenant and a boarding house with assignment history connecting them. Conversations are unique for an owner, tenant, and boarding-house combination.

## Owner endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/owner/conversations?per_page=15&page=1` | Paginated conversations, latest message, and unread count per conversation |
| `GET` | `/api/owner/conversations/recipients?per_page=100&page=1` | Paginated linked tenant/boarding-house pairs eligible for a new conversation |
| `POST` | `/api/owner/conversations` | Create or return the existing conversation |
| `GET` | `/api/owner/conversations/{conversation}` | Conversation details |
| `GET` | `/api/owner/conversations/{conversation}/messages?per_page=30&page=1` | Paginated message history; page 1 contains the newest messages |
| `POST` | `/api/owner/conversations/{conversation}/messages` | Send a message, optionally with files |
| `POST` | `/api/owner/conversations/{conversation}/read` | Mark received messages as read |
| `GET` | `/api/owner/conversations/unread-count` | Total unread messages |
| `GET` | `/api/owner/conversations/{conversation}/attachments/{attachment}` | View a private attachment |
| `GET` | `/api/owner/conversations/{conversation}/attachments/{attachment}?download=1` | Download a private attachment |

Create a conversation with JSON:

```json
{
  "tenant_id": 45,
  "boarding_house_id": 8
}
```

The endpoint responds with `201` for a new conversation and `200` when the same conversation already exists. Both responses return its ID and participant/boarding-house details.

## Student endpoints

These are available for future Student app integration; the Flutter application is not changed here.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/student/conversations?per_page=15&page=1` | List the authenticated Student's conversations |
| `POST` | `/api/student/conversations` | Create or return a conversation for an assigned boarding house |
| `GET` | `/api/student/conversations/unread-count` | Total unread messages |
| `GET` | `/api/student/conversations/{conversation}` | Conversation details |
| `GET` | `/api/student/conversations/{conversation}/messages?per_page=30&page=1` | Paginated message history |
| `POST` | `/api/student/conversations/{conversation}/messages` | Send a message, optionally with files |
| `POST` | `/api/student/conversations/{conversation}/read` | Mark received messages as read |
| `GET` | `/api/student/conversations/{conversation}/attachments/{attachment}` | View a private attachment |
| `GET` | `/api/student/conversations/{conversation}/attachments/{attachment}?download=1` | Download a private attachment |

Student conversation creation uses JSON:

```json
{
  "boarding_house_id": 8
}
```

The conversation's owner and linked tenant account are resolved from the authenticated Student and assignment history.

## Sending messages and attachments

Send a text-only message as JSON:

```json
{ "body": "Hello, I have a question about the room." }
```

To send attachments, use `multipart/form-data`. `body` is optional when one or more files are supplied. Add each file as a repeated `attachments[]` field. Up to five files are accepted per message; each may be at most 10 MiB.

Supported file types are JPG/JPEG, PNG, WEBP, and PDF. The backend validates uploaded files and stores them on Laravel's private `local` disk. Responses include the original filename, detected MIME type, file size, and an authorized attachment URL; they do not include the stored path.

Example successful message response:

```json
{
  "success": true,
  "message": "Message sent.",
  "data": {
    "id": 92,
    "conversation_id": 14,
    "sender_id": 3,
    "sender": { "id": 3, "name": "Owner Name", "role": "owner" },
    "body": "Please review this document.",
    "read_at": null,
    "created_at": "2026-11-14T13:00:00.000000Z",
    "attachments": [
      {
        "id": 17,
        "original_filename": "lease.pdf",
        "mime_type": "application/pdf",
        "file_size": 1024,
        "created_at": "2026-11-14T13:00:00.000000Z",
        "url": "http://localhost/api/owner/conversations/14/attachments/17"
      }
    ]
  }
}
```

Conversation and message list responses use Laravel pagination under `data`; the list of items is at `data.data`. All conversation, message, read-status, and attachment routes verify the authenticated participant. Reading or sending a message does not submit or approve a rental payment and does not change rental balances.
