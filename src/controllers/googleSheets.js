const { google } = require('googleapis');
const credentials = require('../credentials/recessionreport-7457fb64530f.json');

// Initialize the sheets API client
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// Hardcoded spreadsheet ID
const SPREADSHEET_ID = '1jbn1pZzb4E4CH8psau4x0eJb-7Ai2zI4K_KwAik5jn0';

/**
 * Reads data from the specified range in our spreadsheet
 * @param {string} range - The range to read (e.g., 'Sheet1!A1:D10')
 * @returns {Promise<Array>} The values from the specified range
 */
async function readSheet(range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    return response.data.values;
  } catch (error) {
    console.error('Error reading from sheet:', error);
    throw error;
  }
}

/**
 * Writes data to the specified range in our spreadsheet
 * @param {string} range - The range to write to (e.g., 'Sheet1!A1')
 * @param {Array} values - The values to write
 * @returns {Promise<object>} The response from the API
 */
async function writeSheet(range, values) {
  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: values
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error writing to sheet:', error);
    throw error;
  }
}

/**
 * Appends data to the specified range in our spreadsheet
 * @param {string} range - The range to append to (e.g., 'Sheet1!A1')
 * @param {Array} values - The values to append
 * @returns {Promise<object>} The response from the API
 */
async function appendSheet(range, values) {
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: values
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error appending to sheet:', error);
    throw error;
  }
}

module.exports = {
  readSheet,
  writeSheet,
  appendSheet
}; 