import { describe, expect, it } from 'vitest';
import {
  getPermanentUnsubscribeReason,
  getUnsubscribeReason,
  parseDeliveryError,
} from './errorParsing';

describe('errorParsing', () => {
  it('classifies carrier block rule as carrier_opt_out', () => {
    const reason = getPermanentUnsubscribeReason([
      { detail: "Messages cannot be sent due to an existing block rule." },
    ]);
    expect(reason).toBe('carrier_opt_out');
  });

  it('classifies landline/non-routable as permanent ineligible', () => {
    const reason = getPermanentUnsubscribeReason([
      { detail: 'The destination number is either a landline or a non-routable wireless number.' },
    ]);
    expect(reason).toBe('landline_or_non_routable');
  });

  it('classifies hard invalid destination code 40310', () => {
    const reason = getPermanentUnsubscribeReason([{ code: '40310', detail: 'Invalid to address' }]);
    expect(reason).toBe('invalid_number');
  });

  it('does not classify temporary network issues as permanent', () => {
    const reason = getPermanentUnsubscribeReason([
      { detail: 'Temporary network congestion, please retry later.' },
    ]);
    expect(reason).toBeNull();
  });

  it('does not classify Telnyx 40002 spam filter as permanent unsubscribe', () => {
    const reason = getPermanentUnsubscribeReason([
      {
        code: '40002',
        detail: 'The message was flagged by a SPAM filter and was not delivered. This is a temporary condition.',
        title: 'Blocked as spam - temporary'
      },
    ]);
    expect(reason).toBeNull();
  });

  it('gates webhook unsubscribe by failure status only', () => {
    const reason = getUnsubscribeReason('delivered', [
      { detail: 'The destination number is either a landline or a non-routable wireless number.' },
    ]);
    expect(reason).toBeNull();
  });

  it('returns unsubscribe reason for failed statuses', () => {
    const reason = getUnsubscribeReason('delivery_failed', [
      { detail: 'The destination number is either a landline or a non-routable wireless number.' },
    ]);
    expect(reason).toBe('landline_or_non_routable');
  });

  it('uses structured fields in objects while parsing', () => {
    const parsed = parseDeliveryError({ code: '40310' });
    expect(parsed.isInvalidNumber).toBe(true);
    expect(parsed.reason).toBe('invalid_number');
  });
});

