import dotenv from 'dotenv';
import path from 'path';

// Load .env file if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const required = ['NOTION_API_KEY', 'NOTION_DATABASE_ID'];
const missing = required.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error(
    'Copy .env.example to .env and fill in your values, or set them in your environment.'
  );
  process.exit(1);
}

// Notion config
// Normalize 32-char hex IDs to UUID format (Notion API requires dashes)
export function normalizeNotionId(rawId) {
  if (!rawId) return rawId;
  if (rawId.length === 36 && rawId.includes('-')) return rawId;
  if (rawId.length === 32) {
    return rawId.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5');
  }
  return rawId;
}

export const NOTION = {
  API_KEY: process.env.NOTION_API_KEY,
  DATABASE_ID: normalizeNotionId(process.env.NOTION_DATABASE_ID),
};

// Property name mappings - these must match your Notion database column names exactly
export const PROPERTIES = {
  TITLE: process.env.NOTION_TITLE_PROPERTY || 'Payment',
  AMOUNT: process.env.NOTION_AMOUNT_PROPERTY || 'Amount',
  MERCHANT: process.env.NOTION_MERCHANT_PROPERTY || 'Merchant',
  DATE: process.env.NOTION_DATE_PROPERTY || 'Date',
  METHOD: process.env.NOTION_METHOD_PROPERTY || 'Payment Method',
  CATEGORY: process.env.NOTION_CATEGORY_PROPERTY || 'Category',
  TAGS: process.env.NOTION_TAGS_PROPERTY || 'Tags',
};

// Category → Child Database mapping
// Keys are category names (case-insensitive, space-separated alternatives)
// Values specify page_id and column overrides for the child database
export function parsePageMappings() {
  const raw = process.env.NOTION_PAGE_MAPPINGS;
  if (!raw) {
    console.warn('NOTION_PAGE_MAPPINGS not set - all payments will sync to main table');
    return {};
  }

  // Strip surrounding quotes (dotenv may include them)
  const cleaned = raw.replace(/^['"]|['"]$/g, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse NOTION_PAGE_MAPPINGS:', e.message);
    return {};
  }
}

// Server config
export const PORT = parseInt(process.env.PORT, 10) || 8080;