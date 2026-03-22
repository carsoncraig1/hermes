-- Create spam_filter_events table for tracking carrier spam blocks (e.g. Telnyx 40002)
CREATE TABLE IF NOT EXISTS spam_filter_events (
  id SERIAL PRIMARY KEY,
  event_key VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  message_id VARCHAR(255) REFERENCES messages(id) ON DELETE SET NULL,
  provider_message_id VARCHAR(255),
  from_number VARCHAR(255),
  to_number VARCHAR(255),
  carrier VARCHAR(255),
  line_type VARCHAR(255),
  error_code VARCHAR(64) NOT NULL,
  error_title VARCHAR(255),
  error_detail TEXT,
  occurred_at TIMESTAMP(3) NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spam_filter_events_user_occurred_at
  ON spam_filter_events(user_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_spam_filter_events_user_campaign_occurred_at
  ON spam_filter_events(user_id, campaign_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_spam_filter_events_user_from_occurred_at
  ON spam_filter_events(user_id, from_number, occurred_at);

CREATE INDEX IF NOT EXISTS idx_spam_filter_events_user_to_occurred_at
  ON spam_filter_events(user_id, to_number, occurred_at);

CREATE INDEX IF NOT EXISTS idx_spam_filter_events_user_error_occurred_at
  ON spam_filter_events(user_id, error_code, occurred_at);
