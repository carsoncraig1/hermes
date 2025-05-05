import { readSheet } from '../../../controllers/googleSheets';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const range = 'Sheet1!A2:G'; // Adjust range according to your sheet
    const rows = await readSheet(range);
    
    const contacts = rows.map(row => ({
      timestamp: row[0],
      firstName: row[1],
      lastName: row[2],
      email: row[3],
      phone: row[4],
      clickId: row[5],
      subscribed: row[6],
    }));

    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
} 