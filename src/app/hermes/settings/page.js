'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import styles from './page.module.css';

export default function Settings() {
  const { data: session } = useSession();
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [activeTab, setActiveTab] = useState('leads'); // 'leads' or 'revenue'
  const [copied, setCopied] = useState(false);
  const [optOutText, setOptOutText] = useState('');
  const [optOutLoading, setOptOutLoading] = useState(true);
  const [optOutSaving, setOptOutSaving] = useState(false);
  const [telnyxSettings, setTelnyxSettings] = useState({
    telnyxApiKey: '',
    telnyxPhoneNumber: '',
    telnyxMessagingProfileId: '',
  });
  const [telnyxLoading, setTelnyxLoading] = useState(true);
  const [telnyxSaving, setTelnyxSaving] = useState(false);
  const [autoUnsubscribe, setAutoUnsubscribe] = useState(true);
  const [autoUnsubscribeLoading, setAutoUnsubscribeLoading] = useState(true);
  const [autoUnsubscribeSaving, setAutoUnsubscribeSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [apiKeyResponse, optOutResponse, telnyxResponse, autoUnsubscribeResponse] = await Promise.all([
          fetch('/api/user/api-key'),
          fetch('/api/user/opt-out-text'),
          fetch('/api/user/telnyx-settings'),
          fetch('/api/user/auto-unsubscribe'),
        ]);
        
        if (apiKeyResponse.ok) {
          const apiKeyData = await apiKeyResponse.json();
          setApiKey(apiKeyData.apiKey);
        }
        
        if (optOutResponse.ok) {
          const optOutData = await optOutResponse.json();
          setOptOutText(optOutData.optOutText || '');
        }
        
        if (telnyxResponse.ok) {
          const telnyxData = await telnyxResponse.json();
          setTelnyxSettings(telnyxData);
        }
        
        if (autoUnsubscribeResponse.ok) {
          const autoUnsubscribeData = await autoUnsubscribeResponse.json();
          setAutoUnsubscribe(autoUnsubscribeData.autoUnsubscribeOnFailure ?? true);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
        setOptOutLoading(false);
        setTelnyxLoading(false);
        setAutoUnsubscribeLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveOptOut = async () => {
    setOptOutSaving(true);
    try {
      const response = await fetch('/api/user/opt-out-text', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optOutText }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setOptOutText(data.optOutText || '');
        alert('Opt-out text saved successfully!');
      } else {
        alert('Failed to save opt-out text');
      }
    } catch (error) {
      console.error('Error saving opt-out text:', error);
      alert('Failed to save opt-out text');
    } finally {
      setOptOutSaving(false);
    }
  };

  const handleSaveTelnyx = async () => {
    setTelnyxSaving(true);
    try {
      const response = await fetch('/api/user/telnyx-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telnyxSettings),
      });
      
      if (response.ok) {
        const data = await response.json();
        setTelnyxSettings(data);
        alert('Telnyx settings saved successfully!');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to save Telnyx settings');
      }
    } catch (error) {
      console.error('Error saving Telnyx settings:', error);
      alert('Failed to save Telnyx settings');
    } finally {
      setTelnyxSaving(false);
    }
  };

  const handleSaveAutoUnsubscribe = async () => {
    setAutoUnsubscribeSaving(true);
    try {
      const response = await fetch('/api/user/auto-unsubscribe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoUnsubscribeOnFailure: autoUnsubscribe }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAutoUnsubscribe(data.autoUnsubscribeOnFailure);
        alert('Auto-unsubscribe setting saved successfully!');
      } else {
        alert('Failed to save auto-unsubscribe setting');
      }
    } catch (error) {
      console.error('Error saving auto-unsubscribe setting:', error);
      alert('Failed to save auto-unsubscribe setting');
    } finally {
      setAutoUnsubscribeSaving(false);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Settings</h1>
      </header>
      <div className="dashboard-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* API Key Card */}
        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <h2>Your API Key</h2>
            <span className={styles.cardBadge}>Hermes API</span>
          </div>
          <div className={styles.cardContent}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : apiKey ? (
              <>
                <p className={styles.cardDescription}>
                  Use this API key to authenticate requests to the Hermes API. Keep it secure and never share it publicly.
                </p>
                <div className={styles.apiKeyDisplay}>
                  <code className={styles.apiKeyValue}>{apiKey}</code>
                  <button 
                    onClick={handleCopy}
                    className={styles.copyButton}
                    title="Copy to clipboard"
                  >
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.error}>Failed to load API key. Please refresh the page.</div>
            )}
          </div>
        </div>

        {/* API Documentation Card */}
        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <h2>API Documentation</h2>
            <button 
              onClick={() => setShowDocs(!showDocs)}
              className={styles.toggleButton}
            >
              {showDocs ? '▼ Hide' : '▶ Show'} Documentation
            </button>
          </div>
          {showDocs && (
            <div className={styles.cardContent}>
              {/* Tab Navigation */}
              <div className={styles.tabNavigation}>
                <button
                  onClick={() => setActiveTab('leads')}
                  className={`${styles.tabButton} ${activeTab === 'leads' ? styles.tabButtonActive : ''}`}
                >
                  Add New Leads
                </button>
                <button
                  onClick={() => setActiveTab('revenue')}
                  className={`${styles.tabButton} ${activeTab === 'revenue' ? styles.tabButtonActive : ''}`}
                >
                  Revenue Postbacks
                </button>
              </div>

              {/* Tab Content */}
              <div className={styles.tabContent}>
                {activeTab === 'leads' && (
                  <div className={styles.markdownContent}>
                    <h3>Endpoint</h3>
                    <pre className={styles.codeBlock}>
                      <code>POST /api/contact</code>
                    </pre>

                    <h3>Authentication</h3>
                    <p>Include your API key in the request header:</p>
                    <pre className={styles.codeBlock}>
                      <code>{`hermes-api-key: ${apiKey || 'your-api-key-here'}`}</code>
                    </pre>

                    <h3>Request Body</h3>
                    <p>All fields are optional except <code>phone</code> (must be a valid US phone number):</p>
                    <pre className={styles.codeBlock}>
                      <code>{`{
  "phone": "+15551234567",        // Required - US phone number only (10 digits, or with +1)
  "firstName": "John",            // Optional
  "lastName": "Doe",              // Optional
  "email": "john@example.com",   // Optional
  "clickid": ["click1", "click2"], // Optional - Array of click IDs
  "source": "facebook",            // Optional
  "age": "25",                    // Optional
  "ip": "192.168.1.1",           // Optional
  "useragent": "Mozilla/5.0...",  // Optional
  "referrer": "https://example.com", // Optional
  "subscribed": true,             // Optional - Default: true
  "tags": ["vip", "customer"]    // Optional - Array of tag names
}`}</code>
                    </pre>

                    <h3>Example Request</h3>
                    <p>Using cURL:</p>
                    <pre className={styles.codeBlock}>
                      <code>{`curl -X POST https://your-domain.com/api/contact \\
  -H "Content-Type: application/json" \\
  -H "hermes-api-key: ${apiKey || 'your-api-key-here'}" \\
  -d '{
    "phone": "5551234567",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "source": "facebook",
    "clickid": ["click123"],
    "subscribed": true
  }'`}</code>
                    </pre>

                    <p>Using JavaScript (fetch):</p>
                    <pre className={styles.codeBlock}>
                      <code>{`fetch('https://your-domain.com/api/contact', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'hermes-api-key': '${apiKey || 'your-api-key-here'}'
  },
  body: JSON.stringify({
    phone: '5551234567',  // 10-digit US number (will be normalized to +15551234567)
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    source: 'facebook',
    clickid: ['click123'],
    subscribed: true
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`}</code>
                    </pre>

                    <h3>Response</h3>
                    <p><strong>Success (201 Created):</strong></p>
                    <pre className={styles.codeBlock}>
                      <code>{`{
  "id": 123,
  "phone": "+15551234567",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  ...
  "createdAt": "2024-01-01T00:00:00.000Z"
}`}</code>
                    </pre>

                    <p><strong>Update (200 OK):</strong> If a contact with the same phone number already exists, it will be updated instead of creating a new one.</p>

                    <p><strong>Error (400/401):</strong></p>
                    <pre className={styles.codeBlock}>
                      <code>{`{
  "error": "Error message here"
}`}</code>
                    </pre>
                    <p>Common error messages:</p>
                    <ul>
                      <li><code>"Phone number is required"</code> - Phone field is missing</li>
                      <li><code>"Invalid phone number format. Only US phone numbers are accepted..."</code> - Non-US number or invalid format</li>
                      <li><code>"Invalid API key"</code> - API key is missing or invalid</li>
                      <li><code>"Authentication required..."</code> - No valid authentication provided</li>
                    </ul>

                    <h3>Phone Number Format</h3>
                    <p><strong>US phone numbers only.</strong> Phone numbers should be in E.164 format:</p>
                    <ul>
                      <li>10-digit US number: <code>5551234567</code> → normalized to <code>+15551234567</code></li>
                      <li>11-digit US number with country code: <code>15551234567</code> → normalized to <code>+15551234567</code></li>
                      <li>US number with +1: <code>+15551234567</code> → accepted as-is</li>
                      <li>The API will automatically normalize valid US formats</li>
                      <li><strong>Non-US country codes are rejected</strong></li>
                    </ul>

                    <h3>Deduplication</h3>
                    <p>Contacts are automatically deduplicated by phone number <strong>per account</strong>. If a contact with the same phone number already exists:</p>
                    <ul>
                      <li>The existing contact will be updated with any new data provided</li>
                      <li>New click IDs will be appended to existing ones</li>
                      <li>Tags will be merged</li>
                    </ul>

                    <h3>Click IDs</h3>
                    <p>Click IDs can be provided as:</p>
                    <ul>
                      <li>Single value: <code>"clickid": "click123"</code></li>
                      <li>Array: <code>"clickid": ["click1", "click2", "click3"]</code></li>
                      <li>When updating, new click IDs are appended to existing ones</li>
                    </ul>
                  </div>
                )}

                {activeTab === 'revenue' && (
                  <div className={styles.markdownContent}>
                    <h3>Your Postback URL</h3>
                    <p>Use this unique postback URL in your tracking system to report revenue events:</p>
                    <div style={{ 
                      background: 'var(--bg-tertiary)', 
                      padding: '1rem', 
                      borderRadius: 'var(--border-radius-sm)',
                      marginBottom: '1rem',
                      position: 'relative'
                    }}>
                      <pre style={{ 
                        margin: 0, 
                        whiteSpace: 'pre-wrap', 
                        wordBreak: 'break-all',
                        fontSize: '0.8125rem',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace'
                      }}>
                        {apiKey ? `https://txt.cx/api/revenue?key=${apiKey}&hrms={hrms}&payout={payout}&currency={currency}` : 'Loading...'}
                      </pre>
                      {apiKey && (
                        <button
                          onClick={() => {
                            const url = `https://txt.cx/api/revenue?key=${apiKey}&hrms={hrms}&payout={payout}&currency={currency}`;
                            navigator.clipboard.writeText(url);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className={styles.copyButton}
                          style={{ marginTop: '0.5rem' }}
                        >
                          {copied ? '✓ Copied!' : 'Copy Postback URL'}
                        </button>
                      )}
                    </div>

                    <h3>Endpoint</h3>
                    <pre className={styles.codeBlock}>
                      <code>GET https://txt.cx/api/revenue</code>
                    </pre>

                    <h3>Query Parameters</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-primary)' }}>Parameter</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-primary)' }}>Required</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-primary)' }}>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}><code>key</code></td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>Yes</td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>Your Hermes API key (included in postback URL above)</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}><code>hrms</code></td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>Yes</td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>Tracking parameter from shortlink URL (extracted from destination URL)</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}><code>payout</code></td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>Yes</td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>Revenue amount (positive number)</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}><code>currency</code></td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>No</td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>Currency code (default: "USD")</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}><code>metadata</code></td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>No</td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>Additional tracking data as URL-encoded JSON string</td>
                        </tr>
                      </tbody>
                    </table>

                    <h3>How It Works</h3>
                    <ol>
                      <li>When a user clicks a shortlink, the system automatically appends an <code>hrms</code> parameter to the destination URL</li>
                      <li>The <code>hrms</code> parameter is a unique tracking identifier tied to the shortlink, campaign, and user</li>
                      <li>When a conversion occurs, send a GET request to your postback URL with the <code>hrms</code> value and payout amount</li>
                      <li>The revenue will be automatically attributed to the associated campaign and shortlink</li>
                    </ol>

                    <h3>Example Postback URL</h3>
                    <p>When a conversion occurs, your tracking system should make a GET request like this:</p>
                    <pre className={styles.codeBlock}>
                      <code>{`https://txt.cx/api/revenue?key=${apiKey || 'YOUR_API_KEY'}&hrms=hrms_cmirzyw6_123_1704067200000_a1b2c3d4&payout=29.99&currency=USD`}</code>
                    </pre>

                    <h3>Example with Metadata</h3>
                    <p>To include additional tracking data, URL-encode a JSON object:</p>
                    <pre className={styles.codeBlock}>
                      <code>{`const metadata = encodeURIComponent(JSON.stringify({
  orderId: '12345',
  product: 'Premium Subscription'
}));

const url = \`https://txt.cx/api/revenue?key=${apiKey || 'YOUR_API_KEY'}&hrms=\${hrms}&payout=\${payout}&currency=USD&metadata=\${metadata}\`;

// Make GET request
fetch(url)
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`}</code>
                    </pre>

                    <h3>Response</h3>
                    <p><strong>Success (201 Created):</strong></p>
                    <pre className={styles.codeBlock}>
                      <code>{`{
  "success": true,
  "revenueEvent": {
    "id": 456,
    "hrms": "hrms_cmirzyw6_123_1704067200000_a1b2c3d4",
    "payout": 29.99,
    "currency": "USD",
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}`}</code>
                    </pre>

                    <p><strong>Error (400/401/403/404/500):</strong></p>
                    <pre className={styles.codeBlock}>
                      <code>{`{
  "error": "Error message here"
}`}</code>
                    </pre>
                    <p>Common error messages:</p>
                    <ul>
                      <li><code>"API key is required"</code> - Missing or invalid API key</li>
                      <li><code>"hrms parameter is required"</code> - hrms parameter is missing</li>
                      <li><code>"payout parameter is required"</code> - payout parameter is missing</li>
                      <li><code>"payout must be a valid positive number"</code> - Invalid payout value</li>
                      <li><code>"Invalid hrms parameter. Shortlink click not found."</code> - hrms doesn't match any shortlink click</li>
                      <li><code>"Invalid hrms parameter. Shortlink click does not belong to your account."</code> - hrms belongs to a different user</li>
                    </ul>

                    <h3>Extracting hrms from URL</h3>
                    <p>In your tracking script, extract the <code>hrms</code> parameter from the destination URL:</p>
                    <pre className={styles.codeBlock}>
                      <code>{`// JavaScript example
const urlParams = new URLSearchParams(window.location.search);
const hrms = urlParams.get('hrms');

// When conversion occurs, send GET request to postback URL
if (hrms && conversionOccurred) {
  const postbackUrl = \`https://txt.cx/api/revenue?key=${apiKey || 'YOUR_API_KEY'}&hrms=\${hrms}&payout=\${orderTotal}&currency=USD\`;
  
  fetch(postbackUrl)
    .then(response => response.json())
    .then(data => console.log('Revenue tracked:', data))
    .catch(error => console.error('Error:', error));
}`}</code>
                    </pre>

                    <h3>Integration with Tracking Systems</h3>
                    <p>Most tracking systems support postback URLs. Simply paste your postback URL above into your tracking system's conversion postback settings, replacing the placeholder values:</p>
                    <ul>
                      <li><code>{'{hrms}'}</code> - Will be replaced with the actual hrms value from the URL</li>
                      <li><code>{'{payout}'}</code> - Will be replaced with the conversion payout amount</li>
                      <li><code>{'{currency}'}</code> - Will be replaced with the currency code (optional, defaults to USD)</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Standard Opt-Out Language Card */}
        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <h2>Standard Opt-Out Language</h2>
            <span className={styles.cardBadge}>Optional</span>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.cardDescription}>
              Set standard opt-out language that will be automatically appended to all messages sent through campaigns and workflows.
            </p>
            {optOutLoading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <>
                <textarea
                  value={optOutText}
                  onChange={(e) => setOptOutText(e.target.value)}
                  placeholder="e.g., Reply STOP to opt out"
                  className={styles.optOutTextarea}
                  rows={3}
                />
                <div className={styles.optOutActions}>
                  <button
                    onClick={handleSaveOptOut}
                    disabled={optOutSaving}
                    className={styles.saveButton}
                  >
                    {optOutSaving ? 'Saving...' : 'Save Opt-Out Text'}
                  </button>
                </div>
                {optOutText && (
                  <div className={styles.preview}>
                    <strong>Preview:</strong>
                    <div className={styles.previewText}>
                      Your message text here... {optOutText}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Provider Settings Card */}
        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <h2>Provider Settings</h2>
            <span className={styles.cardBadge}>Telnyx</span>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.cardDescription}>
              Configure your Telnyx SMS provider settings. These credentials will be used to send messages through campaigns and workflows.
            </p>
            {telnyxLoading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500 }}>
                    Telnyx API Key
                  </label>
                  <input
                    type="password"
                    value={telnyxSettings.telnyxApiKey}
                    onChange={(e) => setTelnyxSettings({ ...telnyxSettings, telnyxApiKey: e.target.value })}
                    placeholder="KEYxxxxxxxxxxxxxxxxxxxx"
                    className={styles.optOutTextarea}
                    style={{ marginTop: 0 }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500 }}>
                    Phone Number (E.164 format)
                  </label>
                  <input
                    type="text"
                    value={telnyxSettings.telnyxPhoneNumber}
                    onChange={(e) => setTelnyxSettings({ ...telnyxSettings, telnyxPhoneNumber: e.target.value })}
                    placeholder="+15551234567"
                    className={styles.optOutTextarea}
                    style={{ marginTop: 0 }}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    The phone number that will appear as the sender. Must be in E.164 format (+1XXXXXXXXXX).
                  </small>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500 }}>
                    Messaging Profile ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={telnyxSettings.telnyxMessagingProfileId}
                    onChange={(e) => setTelnyxSettings({ ...telnyxSettings, telnyxMessagingProfileId: e.target.value })}
                    placeholder="400196b2-9253-4a8b-8936-6ac04b4e6bbd"
                    className={styles.optOutTextarea}
                    style={{ marginTop: 0 }}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Your Telnyx messaging profile ID. If not provided, a default will be used.
                  </small>
                </div>
                <div className={styles.optOutActions}>
                  <button
                    onClick={handleSaveTelnyx}
                    disabled={telnyxSaving}
                    className={styles.saveButton}
                  >
                    {telnyxSaving ? 'Saving...' : 'Save Telnyx Settings'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Auto-Unsubscribe on Failure Card */}
        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <h2>Auto-Unsubscribe on Delivery Failures</h2>
            <span className={styles.cardBadge}>Recommended</span>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.cardDescription}>
              Automatically unsubscribe contacts when messages fail to deliver due to invalid phone numbers, carrier opt-outs, or other unrecoverable errors. This helps maintain a clean contact list and prevents sending to invalid numbers.
            </p>
            {autoUnsubscribeLoading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="checkbox"
                    id="autoUnsubscribe"
                    checked={autoUnsubscribe}
                    onChange={(e) => setAutoUnsubscribe(e.target.checked)}
                    style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                  />
                  <label 
                    htmlFor="autoUnsubscribe" 
                    style={{ 
                      color: 'var(--text-primary)', 
                      fontSize: '0.875rem', 
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Automatically unsubscribe contacts on delivery failures
                  </label>
                </div>
                <div className={styles.optOutActions}>
                  <button
                    onClick={handleSaveAutoUnsubscribe}
                    disabled={autoUnsubscribeSaving}
                    className={styles.saveButton}
                  >
                    {autoUnsubscribeSaving ? 'Saving...' : 'Save Setting'}
                  </button>
                </div>
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <strong>How it works:</strong>
                  <ul style={{ marginTop: '0.5rem', marginLeft: '1.25rem', paddingLeft: 0 }}>
                    <li>When a message fails with <code>sending_failed</code> or <code>delivery_failed</code> status</li>
                    <li>The system analyzes error messages for keywords indicating invalid numbers</li>
                    <li>If detected, the contact is automatically unsubscribed</li>
                    <li>The unsubscribe reason is tracked: <code>invalid_number</code>, <code>landline_or_non_routable</code>, or <code>carrier_opt_out</code></li>
                    <li>Temporary errors (network issues, timeouts) are ignored</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
