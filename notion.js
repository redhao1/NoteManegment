// Notion API base
const NOTION_API = 'https://api.notion.com/v1/pages';

// Create a row (page) in an existing Notion database
// Maps note fields to database properties
export async function createNotionRow(notionConfig, note) {
  const { API_KEY, DATABASE_ID } = notionConfig;
  const { PROPERTIES } = notionConfig;

  // Build the property values object for Notion API
  // Notion property format: { <property_name>: { rich_text: [{ text: { content: 'value' } }] } } or { number: value }
  const propertyValues = {};

  // Title property - required for every page; use merchant as the title (maps to Expense column)
  propertyValues[PROPERTIES.TITLE] = {
    title: [{ text: { content: note.merchant || 'Untitled Payment' } }],
  };

  // Amount - strip $ and commas, convert to number
  if (note.amount !== undefined && note.amount !== null) {
    const amountStr = String(note.amount);
    const cleanAmount = amountStr.replace(/[$,]/g, '');
    propertyValues[PROPERTIES.AMOUNT] = { number: Number(cleanAmount) };
  }

  // Merchant - store as text (separate from title)
  if (PROPERTIES.MERCHANT) {
    propertyValues[PROPERTIES.MERCHANT] = {
      rich_text: [{ text: { content: note.merchant || '' } }],
    };
  }

  // Date
  if (note.date && PROPERTIES.DATE) {
    // Accept ISO string or Date object
    const dateObj = note.date instanceof Date ? note.date : new Date(note.date);
    propertyValues[PROPERTIES.DATE] = {
      date: {
        start: dateObj.toISOString().split('T')[0], // YYYY-MM-DD format
      },
    };
  }

  // Payment Method
  if (note.method && PROPERTIES.METHOD) {
    propertyValues[PROPERTIES.METHOD] = {
      rich_text: [{ text: { content: note.method } }],
    };
  }

  // Category
  if (note.category && PROPERTIES.CATEGORY) {
    propertyValues[PROPERTIES.CATEGORY] = {
      rich_text: [{ text: { content: note.category } }],
    };
  }

  // Comment/Tags - as rich_text (not multi-select, since Comment is text in your table)
  if (note.tags && note.tags.length > 0 && PROPERTIES.TAGS) {
    propertyValues[PROPERTIES.TAGS] = {
      rich_text: [{ text: { content: note.tags.join(', ') } }],
    };
  }

  const body = {
    parent: { database_id: DATABASE_ID },
    properties: propertyValues,
  };

  const response = await fetch(NOTION_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.id; // This is the notion page ID (also the row ID in the database)
}

// Query a Notion database to get rows
export async function queryNotionDatabase(notionConfig, filter) {
  const { API_KEY } = notionConfig;
  const url = new URL(`https://api.notion.com/v1/databases/${notionConfig.DATABASE_ID}/query`);

  if (filter) {
    url.searchParams.set('filter', JSON.stringify(filter));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (${response.status}): ${errorText}`);
  }

  return response.json();
}