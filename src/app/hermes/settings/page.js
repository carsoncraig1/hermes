'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import styles from './page.module.css';

export default function Settings() {
  const { data: session } = useSession();
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [apiKeyResponse, optOutResponse, telnyxResponse] = await Promise.all([
          fetch('/api/user/api-key'),
          fetch('/api/user/opt-out-text'),
          fetch('/api/user/telnyx-settings'),
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
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
        setOptOutLoading(false);
        setTelnyxLoading(false);
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

                <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border-primary)' }} />

                <h2>Revenue Tracking API</h2>
                <p>Report revenue events from your tracking system to calculate ROAS (Return on Ad Spend) for campaigns.</p>

                <h3>Endpoint</h3>
                <pre className={styles.codeBlock}>
                  <code>POST /api/revenue</code>
                </pre>

                <h3>Request Body</h3>
                <pre className={styles.codeBlock}>
                  <code>{`{
  "hrms": "hrms_userId_shortlinkId_timestamp_random",  // Required - Tracking parameter from shortlink URL
  "payout": 29.99,                                     // Required - Revenue amount (positive number)
  "currency": "USD",                                   // Optional - Default: "USD"
  "metadata": {                                        // Optional - Additional tracking data
    "orderId": "12345",
    "product": "Subscription"
  }
}`}</code>
                </pre>

                <h3>How It Works</h3>
                <ol>
                  <li>When a user clicks a shortlink, the system automatically appends an <code>hrms</code> parameter to the destination URL</li>
                  <li>The <code>hrms</code> parameter is a unique tracking identifier tied to the shortlink, campaign, and user</li>
                  <li>When a conversion occurs, send a POST request to <code>/api/revenue</code> with the <code>hrms</code> value and payout amount</li>
                  <li>The revenue will be automatically attributed to the associated campaign and shortlink</li>
                </ol>

                <h3>Example Request</h3>
                <p>Using cURL:</p>
                <pre className={styles.codeBlock}>
                  <code>{`curl -X POST https://your-domain.com/api/revenue \\
  -H "Content-Type: application/json" \\
  -d '{
    "hrms": "hrms_cmirzyw6_123_1704067200000_a1b2c3d4",
    "payout": 29.99,
    "currency": "USD",
    "metadata": {
      "orderId": "12345",
      "product": "Premium Subscription"
    }
  }'`}</code>
                </pre>

                <p>Using JavaScript (fetch):</p>
                <pre className={styles.codeBlock}>
                  <code>{`fetch('https://your-domain.com/api/revenue', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    hrms: 'hrms_cmirzyw6_123_1704067200000_a1b2c3d4',  // From URL parameter
    payout: 29.99,
    currency: 'USD',
    metadata: {
      orderId: '12345',
      product: 'Premium Subscription'
    }
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

                <p><strong>Error (400/404/500):</strong></p>
                <pre className={styles.codeBlock}>
                  <code>{`{
  "error": "Error message here"
}`}</code>
                </pre>
                <p>Common error messages:</p>
                <ul>
                  <li><code>"hrms parameter is required"</code> - hrms field is missing</li>
                  <li><code>"payout amount is required"</code> - payout field is missing</li>
                  <li><code>"payout must be a valid positive number"</code> - Invalid payout value</li>
                  <li><code>"Invalid hrms parameter. Shortlink not found."</code> - hrms doesn't match any shortlink</li>
                </ul>

                <h3>Extracting hrms from URL</h3>
                <p>In your tracking script, extract the <code>hrms</code> parameter from the URL:</p>
                <pre className={styles.codeBlock}>
                  <code>{`// JavaScript example
const urlParams = new URLSearchParams(window.location.search);
const hrms = urlParams.get('hrms');

// Then send to revenue API when conversion occurs
if (hrms && conversionOccurred) {
  fetch('/api/revenue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hrms: hrms,
      payout: orderTotal,
      metadata: { orderId: orderId }
    })
  });
}`}</code>
                </pre>
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
      </div>
    </div>
  );
}
