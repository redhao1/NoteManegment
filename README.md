# NoteManegment

A local server to receive payment notes from iPhone Shortcuts and sync them to a Notion database table.

## Features

- 🚀 Receive payments from iPhone Shortcuts via HTTP POST
- 📊 Add rows to your existing Notion database table (with amount, merchant, date, category, tags)
- 🔍 View unsynced notes locally
- ⚙️ Sync individual notes to Notion on demand
- 📅 Backlog: Create monthly summaries in Notion

## Prerequisites

- Node.js 18+
- Notion API access (API key and database ID)
- iPhone on the same WiFi network (for shortcut integration)

## Setup

1. **Clone and install**:
   ```bash
   cd NoteManegment
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Get your Notion credentials**:
   - Create a Notion integration at https://www.notion.so/my-integrations
   - Share your database with the integration
   - Copy the API key and database ID (from the URL: `https://www.notion.so/workspace/YOUR_ID`)

4. **Map database columns**:
   In `.env`, update the property names to match your Notion database columns:
   ```env
   NOTION_TITLE_PROPERTY=Payment      # Title column name
   NOTION_AMOUNT_PROPERTY=Amount
   NOTION_MERCHANT_PROPERTY=Merchant
   NOTION_DATE_PROPERTY=Date
   NOTION_METHOD_PROPERTY=Payment Method
   NOTION_CATEGORY_PROPERTY=Category
   NOTION_TAGS_PROPERTY=Tags
   ```

## Running the Server

```bash
npm start
```

The server runs on port 8080 by default.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/payment` | POST | Receive payment data from iPhone Shortcut |
| `/notes` | GET | List all notes (use `?synced=false` for unsynced only) |
| `/notes/:id/sync` | POST | Sync a specific note to Notion |
| `/health` | GET | Health check |

### POST /payment

**Body**:
```json
{
  "amount": 12.50,
  "merchant": "Starbucks",
  "date": "2026-10-27",
  "method": "Apple Pay",
  "category": "Food & Drink",
  "tags": ["coffee", "work"]
}
```

### GET /notes?synced=false

Returns all unsynced notes as an array.

### POST /notes/:id/sync

Pushes the note to Notion and marks it as synced.

## iPhone Shortcut Integration

See [shortcuts.md](./shortcuts.md) for detailed instructions on building a Shortcut that sends payment data to this server.

**Quick URL format**:
```
POST http://YOUR_MAC_IP:8080/payment
Content-Type: application/json

{"amount":..., "merchant":"...", ...}
```

## Notion Database Setup

Your Notion database should have columns matching the property names in your `.env`:

| Column Type | Example Name |
|-------------|--------------|
| Title | Payment |
| Number | Amount |
| Text | Merchant |
| Date | Date |
| Select/Text | Payment Method |
| Select/Text | Category |
| Multi-select | Tags |

Each payment note will become a new row in this database.

## Backlog Features

The following features are planned for future implementation:

- Auto-add notes in a configured format whenever payment is detected
- End-of-month summary: Aggregate all month's notes into a summary row in Notion (after user confirmation)
- Notifications when notes sync successfully

## Development

- Server logs show incoming payments and sync status
- Notes are stored in `data/notes.json`
- The server binds to `0.0.0.0` to accept connections from other devices