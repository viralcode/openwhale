# Fanvue API Reference

Complete endpoint documentation for the Fanvue API.

## Base URL

```
https://api.fanvue.com
```

## Required Headers

All requests must include:

```
Authorization: Bearer <access_token>
X-Fanvue-API-Version: 2025-06-26
```

---

## Users

### Get Current User

Retrieve the authenticated user's profile.

```http
GET /users/me
```

**Scope**: `read:self`

**Response**:
```json
{
  "uuid": "user-uuid",
  "username": "creator_name",
  "displayName": "Creator Name",
  "email": "creator@example.com",
  "avatarUrl": "https://...",
  "isCreator": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## Chats

### List Chats

Get all chat conversations.

```http
GET /chats
```

**Scope**: `read:chat`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results per page |
| `cursor` | string | Pagination cursor |

**Response**:
```json
{
  "data": [
    {
      "userUuid": "fan-uuid",
      "username": "fan_username",
      "displayName": "Fan Name",
      "avatarUrl": "https://...",
      "lastMessage": "Hello!",
      "lastMessageAt": "2024-01-15T12:00:00Z",
      "unreadCount": 2
    }
  ],
  "pagination": {
    "nextCursor": "cursor-string"
  }
}
```

### Get Unread Counts

```http
GET /chats/unread
```

**Scope**: `read:chat`

### Create Chat

Start a new conversation.

```http
POST /chats
```

**Scope**: `write:chat`

**Body**:
```json
{
  "userUuid": "recipient-uuid"
}
```

### Update Chat

Mark as read, set nickname, etc.

```http
PATCH /chats/:userUuid
```

**Scope**: `write:chat`

**Body**:
```json
{
  "markAsRead": true,
  "nickname": "VIP Fan"
}
```

### Get Online Statuses

Check if multiple users are online.

```http
POST /chats/online-statuses
```

**Body**:
```json
{
  "userUuids": ["uuid1", "uuid2", "uuid3"]
}
```

### Get Chat Media

Get media shared in a specific chat.

```http
GET /chats/media
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `userUuid` | string | Chat partner's UUID |

---

## Chat Messages

### List Messages

Get messages from a specific chat.

```http
GET /chat-messages
```

**Scope**: `read:chat`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `userUuid` | string | Chat partner's UUID |
| `limit` | number | Max messages |
| `cursor` | string | Pagination cursor |

**Response**:
```json
{
  "data": [
    {
      "id": "message-id",
      "content": "Message text",
      "senderUuid": "sender-uuid",
      "createdAt": "2024-01-15T12:00:00Z",
      "mediaUrls": []
    }
  ]
}
```

### Send Message

```http
POST /chat-messages
```

**Scope**: `write:chat`

**Body**:
```json
{
  "recipientUuid": "fan-uuid",
  "content": "Thanks for subscribing!",
  "mediaIds": []
}
```

### Send Mass Message

Send to multiple fans at once.

```http
POST /chat-messages/mass
```

**Scope**: `write:chat`

**Body**:
```json
{
  "recipientUuids": ["uuid1", "uuid2"],
  "content": "New content available!",
  "mediaIds": []
}
```

### Delete Message

```http
DELETE /chat-messages/:id
```

**Scope**: `write:chat`

---

## Posts

### List Posts

Get all posts by the authenticated creator.

```http
GET /posts
```

**Scope**: `read:post`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results |
| `cursor` | string | Pagination cursor |

### Get Post

Get a single post by UUID.

```http
GET /posts/:uuid
```

**Scope**: `read:post`

### Create Post

```http
POST /posts
```

**Scope**: `write:post`

**Body**:
```json
{
  "content": "Check out my new content!",
  "mediaIds": ["media-uuid-1", "media-uuid-2"],
  "isPinned": false,
  "isSubscribersOnly": true,
  "price": null
}
```

### Get Post Tips

```http
GET /posts/:uuid/tips
```

### Get Post Likes

```http
GET /posts/:uuid/likes
```

### Get Post Comments

```http
GET /posts/:uuid/comments
```

---

## Creators

### List Followers

Get all followers (free follows).

```http
GET /creators/list-followers
```

**Scope**: `read:creator`

### List Subscribers

Get all active paid subscribers.

```http
GET /creators/list-subscribers
```

**Scope**: `read:creator`

**Response**:
```json
{
  "data": [
    {
      "userUuid": "subscriber-uuid",
      "username": "fan_name",
      "displayName": "Fan Name",
      "subscribedAt": "2024-01-01T00:00:00Z",
      "renewsAt": "2024-02-01T00:00:00Z",
      "tier": "premium"
    }
  ]
}
```

---

## Insights

### Get Earnings

Retrieve earnings and financial data.

```http
GET /insights/get-earnings
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `day`, `week`, `month`, `year` |
| `startDate` | string | ISO date |
| `endDate` | string | ISO date |

### Get Top Spenders

Identify most active fans.

```http
GET /insights/get-top-spenders
```

### Get Subscriber Stats

```http
GET /insights/get-subscribers
```

### Get Fan Insights

Detailed engagement metrics.

```http
GET /insights/get-fan-insights
```

---

## Media

### List User Media

Get all uploaded media.

```http
GET /media
```

**Scope**: `read:media`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results per page |
| `cursor` | string | Pagination cursor |
| `folderId` | string | Filter by vault folder |

### Get Media by UUID

Get a specific media item with optional signed URLs.

```http
GET /media/:uuid
```

**Scope**: `read:media`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `variants` | string | Comma-separated: `main`, `thumbnail`, `blurred` |

> **Important**: Without the `variants` parameter, no URLs are returned. Use `?variants=main,thumbnail,blurred` to get signed CloudFront URLs.

**Response** (with variants):
```json
{
  "uuid": "media-uuid",
  "status": "ready",
  "mediaType": "image",
  "name": "photo.jpg",
  "description": "AI-generated caption",
  "createdAt": "2024-01-15T10:30:00Z",
  "variants": [
    {
      "uuid": "variant-uuid",
      "variantType": "main",
      "width": 1088,
      "height": 1352,
      "url": "https://media.fanvue.com/private/creator-uuid/images/media-uuid?Expires=...&Signature=..."
    },
    {
      "variantType": "blurred",
      "url": "https://media.fanvue.com/private/.../blurred-images/..."
    }
  ]
}
```

### Create Upload Session

Start a multipart upload.

```http
POST /media/create-upload-session
```

**Body**:
```json
{
  "filename": "photo.jpg",
  "contentType": "image/jpeg",
  "fileSize": 1024000
}
```

### Complete Upload Session

Finalize the upload.

```http
PATCH /media/complete-upload-session
```

**Body**:
```json
{
  "uploadSessionId": "session-id",
  "parts": [
    { "partNumber": 1, "etag": "etag-value" }
  ]
}
```

---

## Vault

### List Folders

Get all vault folders.

```http
GET /vault/folders
```

**Scope**: `read:media`

### Create Folder

```http
POST /vault/folders
```

**Body**:
```json
{
  "name": "My New Folder",
  "parentFolderId": null
}
```

---

## Tracking Links

### List Tracking Links

```http
GET /tracking-links
```

**Scope**: `write:tracking_links`

### Create Tracking Link

```http
POST /tracking-links
```

**Body**:
```json
{
  "name": "Instagram Campaign",
  "destination": "profile"
}
```

### Delete Tracking Link

```http
DELETE /tracking-links/:uuid
```

---

## Pagination

Most list endpoints return paginated results:

```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "cursor-string",
    "hasMore": true
  }
}
```

To get the next page, pass `?cursor=cursor-string` to the same endpoint.
