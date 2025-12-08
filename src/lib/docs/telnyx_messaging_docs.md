# Telnyx Messaging Documentation Compilation



---

## Messages - Telnyx Messaging Types


**URL:** https://developers.telnyx.com/docs/messaging/messages/telnyx-messaging-types

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Messaging Types Overview
Character and Rate Limits
Send Your First Message
Receive Messages
Webhooks
Advanced Features
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
SMS/MMS Fundamentals
Telnyx Messaging Types
Copy page

Telnyx’s Developer Documentation provides all the information you need to get started with messaging on our platform. This includes tutorials, code samples and more.

Telnyx offers toll-free, long code and short code SMS, conversational SMS, plus MMS.
​
Toll-Free SMS
Toll-Free numbers are commonly used for appointment reminders, account notifications and emergency alerts.
Toll-Free SMS is used to send text messages from toll-free numbers (e.g., 800, 888, 877, etc.).
Unlike short codes, toll-free numbers can support both phone calls and SMS, so customers can respond to an SMS alert by texting or calling the same number back.
​
Long code SMS
Long codes can be used for both person-to-person (P2P) or application-to-person (A2P) use cases like chat applications and customer service.
Long codes (long virtual numbers, LVNs or long numbers) are 10-digit phone numbers meant for customer service and operational purposes.
Long codes shouldn’t be used for mass marketing campaigns.
There’s a potential limit of 200 long code texts per number, per day, if content is similar in each message. This is an estimated number, not definitive — it’s used as a guide to avoid flagging of messages by mobile carriers as SPAM.
Most customers send from a pool of long codes, allowing them to increase throughput.
You can control auto-responses for long code SMS, however these can be configured only if the committed account is contracted.
​
Short code SMS
Short codes are commonly used for password resets and alerts.
Short codes (common short code or CSC) are 5- or 6-digit phone numbers that customers can lease from the Common Short Code Administration.
No opt-in is legally required and for that reason, operators have put more anti-SPAM protections in place. Best practice when using short code SMS is to explicitly ask for opt-ins.
Common unsubscribe words such as “stop” and “stop all” are supported and won’t allow any further sending to those customers.
​
MMS
Multimedia Messaging Service (MMS) is a standard way to send messages that include multimedia content to and from a mobile phone over a cellular network. Users and providers may refer to such a message as a PXT, a picture message, or a multimedia message. MMS also provides the ability to send and receive attachments.
Available with long code and short code.
​
Conversational SMS
Common use cases include customer support and appointment reminders.
Bi-directional SMS provides ability to exchange texts to and from users. This can be possible through either P2P or A2P communication.

Was this page helpful?

Yes
No
Conversational AI Quickstart
Character and Rate Limits
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Character And Rate Limits


**URL:** https://developers.telnyx.com/docs/messaging/messages/character-and-rate-limits

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Messaging Types Overview
Character and Rate Limits
Send Your First Message
Receive Messages
Webhooks
Advanced Features
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
SMS/MMS Fundamentals
Character and rate limits
Copy page

Understand Telnyx SMS limits. Our guide helps you optimize message length and sending rates for best performance.

This guide covers everything you need to know about character and rate limits with Telnyx, so you can make informed decisions when it comes to your message content and delivery.
​
Character limits
Telnyx will always use the most compact encoding to deliver your message. Longer messages may be split into multiple parts, up to a maximum of 10 parts, and you are billed per-part. Where possible, we recommend altering the characters used in messages so they can be encoded in the fewest number of parts. Each part can hold 140 bytes. In each part of a multi-part message, 6 bytes are reserved.
We support three encodings:
GSM-7 safe characters: (U+0020 to U+007E), excepting the grave accent (U+0060, `), and including the control characters new-line (U+000A, \n) and carriage-return (U+000D, \r).
GSM encoding can pack up to 160 characters into a 140 byte message. The characters ~^|{}[] each require an escape code, so when we encode your message they will end up using two characters. Messages that only use characters from the GSM-safe set and are 160 characters or less will be billed as one part. Messages beyond 160 characters will be split into two or more parts, and each part will only hold 153 characters.
GSM safe characters can vary across different terminating carriers, so the following is a list of what we consider to be the most widely supported GSM-7 character set. Any character included in a message that is not in this list will fail over to UTF-16 (UCS-2) encoding.
Report incorrect code
Copy
Ask AI
{
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "\n\r !\"#$%&'()*+,-./:;<=>?@[\\]^_{}|~"
    "£¥èéùìòØøÅåÆæßÉ¡ÄÖÑÜ¿äöñüà"
}

After pasting the above content, Kindly check and remove any new line added
UTF-8:ASCII characters
This encoding is used for our short code product only. Up to 140 characters can be packed into a single message. The characters ~^|{}[] each require an escape code, so when we encode your message they will end up using two characters. Messages that only use ASCII characters and are 140 characters or less will be billed as one part. Messages beyond 140 characters will be split into two or more parts. Any character included in a message that is not ASCII will fail over to UTF-16 (UCS-2) encoding.
UTF-16 (UCS2): all Unicode characters.
Other messages will be encoded using UTF-16, and each character will use two or four bytes, so a maximum of 70 characters can fit into a single-part message. Some characters, for instance emojis, will take four bytes per character, while characters from the Unicode Basic Multilingual Plane will only use two bytes.
​
Example Single-Part character limits
The character limit for a single part message where the message contains:
only GSM-safe characters, none that require an escape: 160
only GSM-safe characters, including one pair of square brackets ([]): 158
one or more non-GSM-safe characters, but where all are in the Basic Multilingual Plane: 70
only characters from Supplementary Planes e.g. emojis: 35
​
Example Multi-Part calculations
A message of 307 ASCII letters and punctuation from the GSM-7 safe set.
The SMS must be split because it is over 160 characters. Each part of a split message can only hold 153 characters, and because 307 (GSM-7 characters) / 153 (GSM-7 characters/part) = 2.01 parts, it will be billed as 3 parts.
A message containing 134 ASCII letters + 1 interrobang (U+203D, ‽).
Because the interrobang lies outside the GSM-safe character list, the message will be encoded as UTF-16, using twice the number of bytes. The 135 characters will use 270 bytes. 270 bytes / 134 (bytes/part) = 2.01 parts, so it will take 3 parts.
A message containing 68 tacos (U+1F32E, 🌮).
Emojis take two UTF-16 code-units (two-byte pairs) per character, so the total message length is 136 code-units or 272 bytes. As above, 134 bytes will fit into each message part, so as 272 bytes / 134 (bytes/part) = 2.02 parts, it will take 3 parts.
​
How Do I Check if My Message Can Be Encoded in GSM-7?
This page contains an interactive tool which can check if encoding your message in GSM-7 is possible, or if UCS-2 is needed.
​
Rate limits
We recommend enforcing your own rate limits on outbound messages to help prevent issues with delivery.
Telnyx will rate limit outbound messages as follows:
Long Code: 6 messages/minute/number
Toll Free: 1200 messages/minute/number
Account: 10 message/second
In general, long code numbers will encounter deliverability issues downstream if you attempt to send more than 200 messages per day. Please contact Telnyx sales to discuss your use case and options for enabling higher message throughput.
Messages that exceed the limits will be queued for your account. Messages will be added to the queue until it becomes full, after which all subsequent messages will be rejected. Messages won’t appear in a MDR search while in the queue.
If your long code numbers are associated with a 10DLC campaign approved for a higher rate limit, please contact our Network Operations Team in your Telnyx portal to have your rate limits adjusted.

Was this page helpful?

Yes
No
Messaging Types Overview
Send Your First Message
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Receiving Webhooks


**URL:** https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Messaging Types Overview
Character and Rate Limits
Send Your First Message
Receive Messages
Webhooks
Advanced Features
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
SMS/MMS Fundamentals
Receiving Webhooks for Telnyx Messaging
Copy page

Telnyx provides developer documentation for webhooks, which allow you to receive real-time notifications of events that occur in your account.

You can choose to be notified about events on your SMS-capable long code or toll-free phone number by configuring webhooks.
Telnyx supports notifications for the following event types:
Delivery status updates
New inbound messages for both SMS and MMS
​
Requirements For enabling SMS notifications
For this mechanism to work, you’ll need a publicly accessible HTTP server that can receive our webhook requests at one or more specified URLs. We highly recommend using HTTPS (instead of HTTP). This tutorial walks through setting up a basic application for receiving webhooks.
​
Hierarchy of URLs
If webhooks are provided in the request body, we will use those, otherwise if the profile has webhooks, we’ll use those. If neither has webhooks, we won’t attempt a webhook delivery.
​
SMS delivery status updates
The Telnyx Messaging Services will attempt to notify you about each status update based on the hierarchy of URLs above.
​
Delivery status Payload
Here is an example of a webhook event where a delivery receipt is returned to the sender after sending a message through a Telnyx long code to a T-Mobile long code:
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "message.finalized",
    "id": "4ee8c3a6-4995-4309-a3c6-38e3db9ea4be",
    "occurred_at": "2019-12-09T21:32:14.148+00:00",
    "payload": {
      "completed_at": "2019-12-09T21:32:14.148+00:00",
      "cost": {
        "amount": "0.0051",
        "currency": "USD"
      },
      "cost_breakdown": {
        "carrier_fee": {
          "amount": "0.00305",
          "currency": "USD"
        },
        "rate": {
          "amount": "0.00205",
          "currency": "USD"
        }
      },
      "direction": "outbound",
      "encoding": "GSM-7",
      "errors": [],
      "from": {
        "carrier": "T-Mobile USA",
        "line_type": "Wireless",
        "phone_number": "+13125000000",
        "status": "webhook_delivered"
      },
      "id": "ac012cbf-5e09-46af-a69a-7c0e2d90993c",
      "media": [],
      "messaging_profile_id": "83d2343b-553f-4c5f-b8c8-fd27004f94bf",
      "organization_id": "9d76d591-1b7d-405d-8c64-1320ee070245",
      "parts": 1,
      "received_at": "2019-12-09T21:32:13.552+00:00",
      "record_type": "message",
      "sent_at": "2019-12-09T21:32:13.596+00:00",
      "tags": [
        "tag-a",
        "tag-b"
      ],
      "text": "Hello there!",
      "to": [
        {
          "carrier": "T-MOBILE USA, INC.",
          "line_type": "Wireless",
          "phone_number": "+13125000000",
          "status": "delivered"
        }
      ],
      "type": "SMS",
      "valid_until": "2019-12-09T22:32:13.552+00:00",
      "webhook_failover_url": "",
      "webhook_url": "http://webhook.site/af3a92e7-e150-442c-9fe6-61658ce26b1a",
      "tcr_campaign_billable": true,
      "tcr_campaign_id": "CNZO3VL",
      "tcr_campaign_registered": "REGISTERED"
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "http://webhook.site/af3a92e7-e150-442c-9fe6-61658ce26b1a"
  }
}

After pasting the above content, Kindly check and remove any new line added
​
Delivery statuses
Delivery Status	Description
queued	The message is queued up on Telnyx’s side.
sending	The message is currently being sent to an upstream provider.
sent	The message has been sent to the upstream provider.
delivered	The upstream provider has confirmed delivery of the message.
sending_failed	Telnyx has failed to send the message to the upstream provider. Please reach out to our support if you have received this status.
delivery_failed	The upstream provider has failed to send the message to the receiver. Please reach out to our support if you have received this status.
delivery_unconfirmed	There is no indication whether or not the message has reached the receiver. Please reach out to our support if you have received this status
​
Incoming messages to your numbers
Telnyx gives you the option of using webhooks to notify you of new inbound messages to your SMS-capable long code and toll-free phone numbers. This feature is enabled by configuring the incoming webhooks on the associated messaging profile.
Regardless of whether you have configured webhook delivery, records of your received messages are still available in your reports, accessible in the Mission Control Portal
​
Incoming message Payload
Here is an example of a webhook event where a Telnyx Long Code receives a text message from a T-Mobile long code:
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "message.received",
    "id": "b301ed3f-1490-491f-995f-6e64e69674d4",
    "occurred_at": "2019-12-09T20:16:07.588+00:00",
    "payload": {
      "completed_at": null,
      "cost": {
        "amount": "0.0000",
        "currency": "USD"
      },
      "cost_breakdown": {
        "carrier_fee": {
          "amount": "0.0000",
          "currency": "USD"
        },
        "rate": {
          "amount": "0.0000",
          "currency": "USD"
        }
      },
      "direction": "inbound",
      "encoding": "GSM-7",
      "errors": [],
      "from": {
        "carrier": "T-Mobile USA",
        "line_type": "long_code",
        "phone_number": "+1312500000",
        "status": "webhook_delivered"
      },
      "id": "84cca175-9755-4859-b67f-4730d7f58aa3",
      "media": [],
      "messaging_profile_id": "740572b6-099c-44a1-89b9-6c92163bc68d",
      "organization_id": "47a530f8-4362-4526-829b-bcee17fd9f7a",
      "parts": 1,
      "received_at": "2019-12-09T20:16:07.503+00:00",
      "record_type": "message",
      "sent_at": null,
      "tags": [],
      "text": "Hello from Telnyx!",
      "to": [
        {
          "carrier": "Telnyx",
          "line_type": "Wireless",
          "phone_number": "+1773005000",
          "status": "webhook_delivered"
        }
      ],
      "type": "SMS",
      "valid_until": null,
      "webhook_failover_url": null,
      "webhook_url": "http://webhook.site/04bbd2e3-09b5-4c9e-95de-a1debeb9e675"
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "http://webhook.site/04bbd2e3-09b5-4c9e-95de-a1debeb9e675"
  }
}

After pasting the above content, Kindly check and remove any new line added
MMS media links will be available for 30 days after message receipt. After 30 days the link will expire and the media will no longer be available through Telnyx.
​
Telnyx Webhook IPs
If you use an ACL or Firewall on your network, make sure you whitelist the following subnet(s):

192.76.120.192/27

Was this page helpful?

Yes
No
Receive Messages
Group Messaging
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Group Messaging


**URL:** https://developers.telnyx.com/docs/messaging/messages/group-messaging

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Group Messaging
Alphanumeric Sender ID
Number Pool
Short Codes
Sticky Sender
Geomatch
MMS Converter
MMS Transcoding
Schedule Messages
RCS Deeplinks
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Advanced Features
Telnyx Group Messaging
Copy page

Learn how to send and receive group messages using the Telnyx v2 API. Start building on Telnyx today.

Group Messaging builds upon the MMS (Multimedia Messaging Service) protocol in order to facilitate multi-party conversations.
Building upon the shortcomings of existing platforms, Group Messaging presents a breakthrough approach to Group MMS that puts emphasis on ease of use, rigorous compliance, and unbeatable pricing.
The API reference can be found here.
​
Sending a group message
Here’s an example of how to send a group message.
Request -
Report incorrect code
Copy
Ask AI
curl -X POST -H 'Content-Type: application/json' \
  --header "Authorization: Bearer ***" \
  -d '{"from": "+13125790427", "to": ["+18655551234", "+13125551234"], "text": "Greetings from Telnyx!", "media_urls": ["http://placekitten.com/320/240"]}' \
  https://api.telnyx.com/v2/messages/group_mms

Response -
Report incorrect code
Copy
Ask AI
{
    "data": {
        "record_type": "message",
        "direction": "outbound",
        "id": "403188fd-58c5-4557-a8de-1700a358d768",
        "type": "MMS",
        "organization_id": "2cdddce5-daaa-4515-9fb2-995cc429d82c",
        "messaging_profile_id": "1e0df9c5-8716-4bcf-8fb2-9f6d9527fd95",
        "from": "+12024494776",
        "to": [
            {
                "phone_number": "+13475636849",
                "status": "queued",
                "carrier": "NEW CINGULAR WIRELESS PCS, LLC - DC",
                "line_type": "Wireless"
            },
            {
                "phone_number": "+13122708269",
                "status": "queued",
                "carrier": "TELNYX LLC",
                "line_type": "Pre-Paid Wireless"
            },
            {
                "phone_number": "+17084769340",
                "status": "queued",
                "carrier": "T-MOBILE USA, INC.",
                "line_type": "Wireless"
            },
            {
                "phone_number": "+13122708074",
                "status": "queued",
                "carrier": "TELNYX LLC",
                "line_type": "Pre-Paid Wireless"
            }
        ],
        "text": "Greetings from Telnyx!",
        "media": [
            {
                "url": "http://placekitten.com/320/240",
                "content_type": null,
                "sha256": null,
                "size": null
            }
        ],
        "webhook_url": "https://webhook.site/b1a0a3a7-0771-40e8-9b11-e175b7f0b633",
        "webhook_failover_url": "",
        "encoding": "GSM-7",
        "parts": 1,
        "tags": [],
        "cost": {
            "amount": "0.1200",
            "currency": "USD"
        },
        "received_at": "2023-06-27T14:53:53.376+00:00",
        "sent_at": null,
        "completed_at": null,
        "valid_until": "2023-06-27T15:53:53.376+00:00",
        "errors": []
    }
}

Delivery Status Webhook -
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "message.finalized",
    "id": "b40653f5-91cd-46b1-9542-0c092bd29795",
    "occurred_at": "2023-08-08T10:29:36.090+00:00",
    "payload": {
      "cc": [],
      "completed_at": "2023-08-08T10:29:36.090+00:00",
      "cost": {
        "amount": "0.0400",
        "currency": "USD"
      },
      "direction": "outbound",
      "encoding": "GSM-7",
      "errors": [],
      "from": {
        "carrier": "Telnyx",
        "line_type": "Wireless",
        "phone_number": "+12024494776"
      },
      "group_message_id": "403189d4-b1d6-4993-b263-6470e5224430",
      "id": "403189d4-b1d6-4993-b263-6470e5224430",
      "media": [
        {
          "content_type": null,
          "sha256": null,
          "size": null,
          "url": "http://placekitten.com/320/240"
        }
      ],
      "messaging_profile_id": "1e0df9c5-8716-4bcf-8fb2-9f6d9527fd95",
      "organization_id": "2cdddce5-daaa-4515-9fb2-995cc429d82c",
      "parts": 1,
      "received_at": "2023-08-08T10:29:31.939+00:00",
      "record_type": "message",
      "sent_at": "2023-08-08T10:29:32.751+00:00",
      "tags": [],
      "text": "hello world - this is a test",
      "to": [
        {
          "carrier": "CELLCO PARTNERSHIP DBA VERIZON WIRELESS - IL",
          "line_type": "Wireless",
          "phone_number": "+16186635052",
          "status": "delivered"
        },
        {
          "carrier": "CELLCO PARTNERSHIP DBA VERIZON WIRELESS - FL",
          "line_type": "Wireless",
          "phone_number": "+13056479132",
          "status": "delivered"
        }
      ],
      "type": "MMS",
      "valid_until": "2023-08-08T11:29:31.939+00:00",
      "webhook_failover_url": "",
      "webhook_url": "https://webhook.site/82977c82-3ef0-4139-83f1-2a5446708f90"
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "https://webhook.site/82977c82-3ef0-4139-83f1-2a5446708f90"
  }
}

​
Receiving a group message
Here’s an example of what an inbound message webhook would look like in a group messaging conversation
Webhook -
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "message.received",
    "id": "0d7c4fbe-d075-435f-b71b-694391743967",
    "occurred_at": "2023-08-08T13:03:05.129+00:00",
    "payload": {
      "autoresponse_type": null,
      "cc": [
        "+13122708269",
        "+17084769340",
        "+13122708074",
        "+12024494776"
      ],
      "completed_at": null,
      "cost": null,
      "direction": "inbound",
      "encoding": "UCS-2",
      "errors": [],
      "from": {
        "carrier": "AT&T",
        "line_type": "Wireless",
        "phone_number": "+13475636849"
      },
      "id": "9d12c9d0-5172-429a-8fb9-cc9da297717f",
      "is_spam": false,
      "media": [],
      "messaging_profile_id": "1e0df9c5-8716-4bcf-8fb2-9f6d9527fd95",
      "organization_id": "2cdddce5-daaa-4515-9fb2-995cc429d82c",
      "parts": 1,
      "received_at": "2023-08-08T13:03:04.812+00:00",
      "record_type": "message",
      "sent_at": null,
      "subject": "",
      "tags": [],
      "text": "Checking in on the Telnyx team",
      "to": [
        {
          "carrier": "Telnyx",
          "line_type": "Wireless",
          "phone_number": "+12024494776",
          "status": "webhook_delivered"
        },
        {
          "carrier": "TELNYX LLC",
          "line_type": "Pre-Paid Wireless",
          "phone_number": "+13122708269",
          "status": "unknown"
        },
        {
          "carrier": "T-MOBILE USA, INC.",
          "line_type": "Wireless",
          "phone_number": "+17084769340",
          "status": "unknown"
        },
        {
          "carrier": "TELNYX LLC",
          "line_type": "Pre-Paid Wireless",
          "phone_number": "+13122708074",
          "status": "unknown"
        }
      ],
      "type": "MMS",
      "valid_until": null,
      "webhook_failover_url": "https://webhook.site/ccfcbfd0-9e63-45de-bac9-14f7b5968ca1",
      "webhook_url": "https://webhook.site/82977c82-3ef0-4139-83f1-2a5446708f90"
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "https://webhook.site/82977c82-3ef0-4139-83f1-2a5446708f90"
  }
}

​
Webhook / Detail record behaviour
You should receive an individual webhook status update for each recipient following the v2 schema.
Handset delivery status is not available for Non-Telnyx receipients within in a conversation. Their status will be marked as unknown.
We cut individual message detail records per receipient in a group message via our portal / reporting API’s.
An additional attribute called group_message_id is returned to allow users to correlate each individual record to the overarching group message conversation. This is returned via API response, webhooks and is also available via detailed records.
​
What caveats should I be aware of with this feature?
Group Messaging takes place over the MMS protocol and supports a maximum of 8 recipients in a conversation.
Limitations of the MMS protocol apply here.
This feature is only available via our v2 API. Please ensure you have a v2 webhook version selected on your messaging profile to ensure you receive inbound messages.
Group messaging is charged per recipient. Standard MMS rates and corresponding carrier passthrough fees apply here.
Only US / CAN destinations are supported.

Was this page helpful?

Yes
No
Webhooks
Alphanumeric Sender ID
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Alphanumeric Sender Id


**URL:** https://developers.telnyx.com/docs/messaging/messages/alphanumeric-sender-id

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Group Messaging
Alphanumeric Sender ID
Number Pool
Short Codes
Sticky Sender
Geomatch
MMS Converter
MMS Transcoding
Schedule Messages
RCS Deeplinks
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Advanced Features
Alphanumeric Sender
Copy page

Set up Alphanumeric Sender IDs with Telnyx for identifiable one-way text messages.

| cURL | Python | PHP | Node | Java | .NET | Ruby |
​
cURL
An Alphanumeric Sender ID lets you send messages using a custom ID constructed from a combination of alpha (a-z, A-Z) and numeric (0-9) characters as well as spaces. This makes the sender identifiable to the receiver, as companies can set their brand name as the ID (e.g., TELNYX).
It’s commonly used for sending one-way text messages, as the person receiving the message will be unable to reply with an Alphanumeric Sender ID.
Each country regulates alphanumeric sender ID differently. Ensure that you’re complying with the local regulations.
Use the send message endpoint
Instead of specifying a phone number as the “From” field, provide the Alphanumeric Sender ID. You will also need to specify the Messaging Profile (via the messaging_profile_id parameter) that will be used to send the message.
Telnyx attempts to deliver your message whenever possible. If you use a sending number that is unable to deliver the message, Telnyx will failover to using an generic alphanumeric sender ID to terminate the message.
Report incorrect code
Copy
Ask AI
curl -X POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --data '{
    "from": "Telnyx",
    "to": "+13115552367",
    "text": "Hello, world!",
    "messaging_profile_id": "YOUR_MESSAGING_PROFILE_ID"
  }' \
  https://api.telnyx.com/v2/messages

After pasting the above content, Kindly check and remove any new line added
​
Using Python for Alphanumeric Sender IDs
An Alphanumeric Sender ID lets you send messages using a custom ID constructed from a combination of alpha (a-z, A-Z) and numeric (0-9) characters as well as spaces. This makes the sender identifiable to the receiver, as companies can set their brand name as the ID (e.g., TELNYX). It’s commonly used for sending one-way text messages, as the person receiving the message will be unable to reply with an Alphanumeric Sender ID.
Each country regulates alphanumeric sender ID differently. Ensure that you’re complying with the local regulations.
When sending messages, use the send message endpoint. Instead of specifying a phone number as the “From” field, provide the Alphanumeric Sender ID. You will also need to specify the Messaging Profile (via the messaging_profile_id parameter) that will be used to send the message.
Telnyx attempts to deliver your message whenever possible. If you use a sending number that is unable to deliver the message, Telnyx will failover to using an generic alphanumeric sender ID to terminate the message.
Report incorrect code
Copy
Ask AI
import telnyx

telnyx.api_key = "YOUR_API_KEY"

destination_number = "+13115552367"

telnyx.Message.create(
    from_="Telnyx",
    to=destination_number,
    text="Hello, world!",
    messaging_profile_id="YOUR_MESSAGING_PROFILE_ID",
)

After pasting the above content, Kindly check and remove any new line added
​
PHP for Alphanumeric Sender IDs
An Alphanumeric Sender ID lets you send messages using a custom ID constructed from a combination of alpha (a-z, A-Z) and numeric (0-9) characters as well as spaces. This makes the sender identifiable to the receiver, as companies can set their brand name as the ID (e.g., TELNYX). It’s commonly used for sending one-way text messages, as the person receiving the message will be unable to reply with an Alphanumeric Sender ID.
Each country regulates alphanumeric sender ID differently. Ensure that you’re complying with the local regulations.
When sending messages, use the send message endpoint. Instead of specifying a phone number as the “From” field, provide the Alphanumeric Sender ID. You will also need to specify the Messaging Profile (via the messaging_profile_id parameter) that will be used to send the message.
Telnyx attempts to deliver your message whenever possible. If you use a sending number that is unable to deliver the message, Telnyx will failover to using an generic alphanumeric sender ID to terminate the message.
Report incorrect code
Copy
Ask AI
\Telnyx\Telnyx::setApiKey('YOUR_API_KEY');

\Telnyx\Message::Create([
  "from" => "Telnyx",
  "to" => "+18445552367",
  "text" => "Hello, World!",
  "messaging_profile_id" => "YOUR_MESSAGING_PROFILE_ID"
]);

After pasting the above content, Kindly check and remove any new line added
​
Node for Alphanumeric Sender IDs
An Alphanumeric Sender ID lets you send messages using a custom ID constructed from a combination of alpha (a-z, A-Z) and numeric (0-9) characters as well as spaces. This makes the sender identifiable to the receiver, as companies can set their brand name as the ID (e.g., TELNYX). It’s commonly used for sending one-way text messages, as the person receiving the message will be unable to reply with an Alphanumeric Sender ID.
Each country regulates alphanumeric sender ID differently. Ensure that you’re complying with the local regulations.
When sending messages, use the send message endpoint. Instead of specifying a phone number as the “From” field, provide the Alphanumeric Sender ID. You will also need to specify the Messaging Profile (via the messaging_profile_id parameter) that will be used to send the message.
Telnyx attempts to deliver your message whenever possible. If you use a sending number that is unable to deliver the message, Telnyx will failover to using an generic alphanumeric sender ID to terminate the message.
Report incorrect code
Copy
Ask AI
import Telnyx from 'telnyx';

const telnyx = new Telnyx("YOUR_API_KEY");

telnyx.messages.create(
  {
    from: "Telnyx",
    to: "+18445552367",
    text: "Hello, World!",
    messaging_profile_id: "YOUR_MESSAGING_PROFILE_ID",
  },
  function (err, response) {
    // asynchronously called
    console.log(response);
  }
);

After pasting the above content, Kindly check and remove any new line added
​
Java for Alphanumeric Sender IDs
An Alphanumeric Sender ID lets you send messages using a custom ID constructed from a combination of alpha (a-z, A-Z) and numeric (0-9) characters as well as spaces. This makes the sender identifiable to the receiver, as companies can set their brand name as the ID (e.g., TELNYX). It’s commonly used for sending one-way text messages, as the person receiving the message will be unable to reply with an Alphanumeric Sender ID.
Note: Each country regulates alphanumeric sender ID differently. Ensure that you’re complying with the local regulations.
Use the send message endpoint Instead of specifying a phone number as the “From” field, provide the Alphanumeric Sender ID. You will also need to specify the Messaging Profile (via the messaging_profile_id parameter) that will be used to send the message.
Note: Telnyx attempts to deliver your message whenever possible. If you use a sending number that is unable to deliver the message, Telnyx will failover to using an generic alphanumeric sender ID to terminate the message.
Report incorrect code
Copy
Ask AI
import java.util.Arrays;
import com.telnyx.sdk.ApiClient;
import com.telnyx.sdk.ApiException;
import com.telnyx.sdk.Configuration;
import com.telnyx.sdk.auth.*;
import com.telnyx.sdk.model.*;
import com.telnyx.sdk.api.MessagesApi;

public class Example {
    //Alpha sender ID
    private static final String YOUR_ALPHA_SENDER_ID = "Telnyx";
    private static final String YOUR_MOBILE_NUMBER = "+19198675309";
    private static final String YOUR_TELNYX_API_KEY = "YOUR_API_KEY";

    public static void main(String[] args) {
        ApiClient defaultClient = Configuration.getDefaultApiClient();
        defaultClient.setBasePath("https://api.telnyx.com/v2");

        // Configure HTTP bearer authorization: bearerAuth
        HttpBearerAuth bearerAuth = (HttpBearerAuth) defaultClient.getAuthentication("bearerAuth");
        bearerAuth.setBearerToken(YOUR_TELNYX_API_KEY);

        MessagesApi apiInstance = new MessagesApi(defaultClient);
         // CreateMessageRequest | Message payload
        CreateMessageRequest createMessageRequest = new CreateMessageRequest()
                .from(YOUR_ALPHA_SENDER_ID)
                .to(YOUR_MOBILE_NUMBER)
                .text("Hello From Telnyx");
        try {
            MessageResponse result = apiInstance.createMessage(createMessageRequest);
            System.out.println(result);
        } catch (ApiException e) {
            System.err.println("Exception when calling MessagesApi#createMessage");
            System.err.println("Status code: " + e.getCode());
            System.err.println("Reason: " + e.getResponseBody());
            System.err.println("Response headers: " + e.getResponseHeaders());
            e.printStackTrace();
        }
    }
}


After pasting the above content, Kindly check and remove any new line added
​
.NET for Alphanumeric Sender IDs
An Alphanumeric Sender ID lets you send messages using a custom ID constructed from a combination of alpha (a-z, A-Z) and numeric (0-9) characters as well as spaces. This makes the sender identifiable to the receiver, as companies can set their brand name as the ID (e.g., TELNYX). It’s commonly used for sending one-way text messages, as the person receiving the message will be unable to reply with an Alphanumeric Sender ID.
Note: Each country regulates alphanumeric sender ID differently. Ensure that you’re complying with the local regulations.
Use the send message endpoint Instead of specifying a phone number as the “From” field, provide the Alphanumeric Sender ID. You will also need to specify the Messaging Profile (via the messaging_profile_id parameter) that will be used to send the message.
Note: Telnyx attempts to deliver your message whenever possible. If you use a sending number that is unable to deliver the message, Telnyx will failover to using an generic alphanumeric sender ID to terminate the message.
Report incorrect code
Copy
Ask AI
using System;
using Telnyx;
using System.Threading.Tasks;

namespace send_alpha_numeric_sms
{
  class Program
  {
    private static string TELNYX_API_KEY = System.Environment.GetEnvironmentVariable("TELNYX_API_KEY");
    private static string alphaSenderID = "Telnyx"; //Alphanumeric Sedner ID input
    private static string destinationNumber = "+19198675309";

    static async Task Main(string[] args)
    {
      Console.WriteLine("Hello World!");
      TelnyxConfiguration.SetApiKey(TELNYX_API_KEY);
      MessagingSenderIdService service = new MessagingSenderIdService();
      NewMessagingSenderId options = new NewMessagingSenderId
      {
        From = alphaSenderID,
        To = destinationNumber,
        Text = "Hello, World!"
      };
      try
      {
        MessagingSenderId messageResponse = await service.CreateAsync(options);
        Console.WriteLine(messageResponse.Id);

      }
      catch (Exception e)
      {
        Console.WriteLine(e.Message);
      }
    }
  }
}

After pasting the above content, Kindly check and remove any new line added
​
Ruby for Alphanumeric Sender IDs
An Alphanumeric Sender ID lets you send messages using a custom ID constructed from a combination of alpha (a-z, A-Z) and numeric (0-9) characters as well as spaces. This makes the sender identifiable to the receiver, as companies can set their brand name as the ID (e.g., TELNYX). It’s commonly used for sending one-way text messages, as the person receiving the message will be unable to reply with an Alphanumeric Sender ID.
Each country regulates alphanumeric sender ID differently. Ensure that you’re complying with the local regulations.
When sending messages, use the send message endpoint. Instead of specifying a phone number as the “From” field, provide the Alphanumeric Sender ID. You will also need to specify the Messaging Profile (via the messaging_profile_id parameter) that will be used to send the message.
Telnyx attempts to deliver your message whenever possible. If you use a sending number that is unable to deliver the message, Telnyx will failover to using an generic alphanumeric sender ID to terminate the message.
Report incorrect code
Copy
Ask AI
require "telnyx"

Telnyx.api_key = "YOUR_API_KEY"

to_number = "DESTINATION_NUMBER"

response = Telnyx::Message.create(
    from: "Telnyx",
    to: to_number,
    text: "Hello, world!",
    messaging_profile_id: "YOUR_MESSAGING_PROFILE_ID"
)

After pasting the above content, Kindly check and remove any new line added

Was this page helpful?

Yes
No
Group Messaging
Number Pool
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Number Pool


**URL:** https://developers.telnyx.com/docs/messaging/messages/number-pool

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Group Messaging
Alphanumeric Sender ID
Number Pool
Short Codes
Sticky Sender
Geomatch
MMS Converter
MMS Transcoding
Schedule Messages
RCS Deeplinks
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Advanced Features
Number Pool
Copy page

manage messaging campaigns

| cURL | Python | PHP | Node | .NET | Ruby | Portal |
​
cURL
Number Pool distributes your outbound messaging traffic across multiple phone numbers to help you manage your messaging campaigns. The pool of numbers includes all long code and toll-free numbers assigned to your Messaging Profile. When you send a message, the “From” number is selected from the numbers in your Number Pool that aren’t currently being used to send a message.
Follow the instructions below to set up Number Pool on one of your Messaging Profiles. You will also need to associate at least one phone number with the Messaging Profile.
When sending messages, use the send endpoint for Number Pool. You will need to omit the “From” field from the request and instead specify the Messaging Profile (via the messaging_profile_id parameter) with the number pool you’d like to utilize for sending your message.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
​
Weights
Long Code and Toll Free weight defines the ratio at which a number type will be selected when sending a message. For example, if Long Code weight is 5, and Toll Free weight is 1, then every five messages will be sent from a Long Code number in the number pool, and the sixth message will be sent from a Toll Free number. The sum of the weights for all number types does not necessarily need to add to 100. Weight must be a non-negative number, and when equal to zero it will remove the number type from the pool.
​
Skip Unhealthy
If this feature is enabled, Telnyx takes into the account the health of a number when choosing a number from the pool. If a number is deemed unhealthy, it’s skipped until it’s deemed to be healthy again.
If no number in the pool is deemed healthy, number pool will not choose a number and will reject the message.
The code below enables and then disables Number Pool for a Messaging Profile:
Report incorrect code
Copy
Ask AI
curl -X PATCH \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --data '{"number_pool_settings":{"long_code_weight":1,"toll_free_weight":10}}' \
  "https://api.telnyx.com/v2/messaging_profiles/{YOUR_MESSAGING_PROFILE_ID}"


curl -X PATCH \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --data '{"number_pool_settings":{}}' \
  "https://api.telnyx.com/v2/messaging_profiles/{YOUR_MESSAGING_PROFILE_ID}"

After pasting the above content, Kindly check and remove any new line added
​
Python
Number Pool distributes your outbound messaging traffic across multiple phone numbers to help you manage your messaging campaigns. The pool of numbers includes all long code and toll-free numbers assigned to your Messaging Profile. When you send a message, the “From” number is selected from the numbers in your Number Pool that aren’t currently being used to send a message.
Follow the instructions below to set up Number Pool on one of your Messaging Profiles. You will also need to associate at least one phone number with the Messaging Profile.
When sending messages, use the send endpoint for Number Pool. You will need to omit the “From” field from the request and instead specify the Messaging Profile (via the messaging_profile_id parameter) with the number pool you’d like to utilize for sending your message.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
​
Weights
Long Code and Toll Free weight defines the ratio at which a number type will be selected when sending a message. For example, if Long Code weight is 5, and Toll Free weight is 1, then every five messages will be sent from a Long Code number in the number pool, and the sixth message will be sent from a Toll Free number. The sum of the weights for all number types does not necessarily need to add to 100. Weight must be a non-negative number, and when equal to zero it will remove the number type from the pool.
​
Skip Unhealthy
If this feature is enabled, Telnyx takes into the account the health of a number when choosing a number from the pool. If a number is deemed unhealthy, it’s skipped until it’s deemed to be healthy again.
If no number in the pool is deemed healthy, number pool will not choose a number and will reject the message.
The code below enables and then disables Number Pool for a Messaging Profile:
Report incorrect code
Copy
Ask AI
import telnyx
telnyx.api_key = "YOUR_API_KEY"

mp = telnyx.MessagingProfile.retrieve("YOUR_MESSAGING_PROFILE_ID")

# turn on number pool
mp.number_pool_settings = {
    "long_code_weight": 1,
    "toll_free_weight": 10
}
mp.save()

# turn off number pool
mp.number_pool_settings = {}
mp.save()

After pasting the above content, Kindly check and remove any new line added
​
PHP
Number Pool distributes your outbound messaging traffic across multiple phone numbers to help you manage your messaging campaigns. The pool of numbers includes all long code and toll-free numbers assigned to your Messaging Profile. When you send a message, the “From” number is selected from the numbers in your Number Pool that aren’t currently being used to send a message.
Follow the instructions below to set up Number Pool on one of your Messaging Profiles. You will also need to associate at least one phone number with the Messaging Profile.
When sending messages, use the send endpoint for Number Pool. You will need to omit the “From” field from the request and instead specify the Messaging Profile (via the messaging_profile_id parameter) with the number pool you’d like to utilize for sending your message.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
​
Weights
Long Code and Toll Free weight defines the ratio at which a number type will be selected when sending a message. For example, if Long Code weight is 5, and Toll Free weight is 1, then every five messages will be sent from a Long Code number in the number pool, and the sixth message will be sent from a Toll Free number. The sum of the weights for all number types does not necessarily need to add to 100. Weight must be a non-negative number, and when equal to zero it will remove the number type from the pool.
​
Skip Unhealthy
If this feature is enabled, Telnyx takes into the account the health of a number when choosing a number from the pool. If a number is deemed unhealthy, it’s skipped until it’s deemed to be healthy again.
If no number in the pool is deemed healthy, number pool will not choose a number and will reject the message.
The code below enables and then disables Number Pool for a Messaging Profile:
Report incorrect code
Copy
Ask AI
\Telnyx\Telnyx::setApiKey('YOUR_API_KEY');

//Turn on number pool
\Telnyx\MessagingProfile::Update("YOUR_MESSAGING_PROFILE_ID", ["number_pool_settings" => {
  "long_code_weight": 1,
  "toll_free_weight": 10
}]);

//Turn off number pool
\Telnyx\MessagingProfile::Update("YOUR_MESSAGING_PROFILE_ID", ["number_pool_settings" => {}]);

After pasting the above content, Kindly check and remove any new line added
​
Node
Number Pool distributes your outbound messaging traffic across multiple phone numbers to help you manage your messaging campaigns. The pool of numbers includes all long code and toll-free numbers assigned to your Messaging Profile. When you send a message, the “From” number is selected from the numbers in your Number Pool that aren’t currently being used to send a message.
Follow the instructions below to set up Number Pool on one of your Messaging Profiles. You will also need to associate at least one phone number with the Messaging Profile.
When sending messages, use the send endpoint for Number Pool. You will need to omit the “From” field from the request and instead specify the Messaging Profile (via the messaging_profile_id parameter) with the number pool you’d like to utilize for sending your message.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
​
Weights
Long Code and Toll Free weight defines the ratio at which a number type will be selected when sending a message. For example, if Long Code weight is 5, and Toll Free weight is 1, then every five messages will be sent from a Long Code number in the number pool, and the sixth message will be sent from a Toll Free number. The sum of the weights for all number types does not necessarily need to add to 100. Weight must be a non-negative number, and when equal to zero it will remove the number type from the pool.
​
Skip Unhealthy
If this feature is enabled, Telnyx takes into the account the health of a number when choosing a number from the pool. If a number is deemed unhealthy, it’s skipped until it’s deemed to be healthy again.
If no number in the pool is deemed healthy, number pool will not choose a number and will reject the message.
The code below enables and then disables Number Pool for a Messaging Profile:
Report incorrect code
Copy
Ask AI
import Telnyx from 'telnyx';

const telnyx = new Telnyx("YOUR_API_KEY");

// Turn on number pool
const { data : messagingProfile } = await telnyx.messagingProfiles.update(
  'YOUR_MESSAGING_PROFILE_ID',
  {
    "number_pool_settings": {
        "long_code_weight": 1,
        "toll_free_weight": 10
    }
  }
)

// Turn off number pool
const { data : messagingProfile } = await telnyx.messagingProfiles.update(
  'YOUR_MESSAGING_PROFILE_ID',
  {
    "number_pool_settings": {}
  }
)

After pasting the above content, Kindly check and remove any new line added
​
.NET
Number Pool distributes your outbound messaging traffic across multiple phone numbers to help you manage your messaging campaigns. The pool of numbers includes all long code and toll-free numbers assigned to your Messaging Profile. When you send a message, the “From” number is selected from the numbers in your Number Pool that aren’t currently being used to send a message.
Follow the instructions below to set up Number Pool on one of your Messaging Profiles. You will also need to associate at least one phone number with the Messaging Profile.
When sending messages, use the send endpoint for Number Pool. You will need to omit the “From” field from the request and instead specify the Messaging Profile (via the messaging_profile_id parameter) with the number pool you’d like to utilize for sending your message.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
​
Weights
Long Code and Toll Free weight defines the ratio at which a number type will be selected when sending a message. For example, if Long Code weight is 5, and Toll Free weight is 1, then every five messages will be sent from a Long Code number in the number pool, and the sixth message will be sent from a Toll Free number. The sum of the weights for all number types does not necessarily need to add to 100. Weight must be a non-negative number, and when equal to zero it will remove the number type from the pool.
​
Skip Unhealthy
If this feature is enabled, Telnyx takes into the account the health of a number when choosing a number from the pool. If a number is deemed unhealthy, it’s skipped until it’s deemed to be healthy again.
If no number in the pool is deemed healthy, number pool will not choose a number and will reject the message.
The code below enables and then disables Number Pool for a Messaging Profile:
Report incorrect code
Copy
Ask AI
using System;
using Telnyx.net.Services.VerifyAPI;
private static string TELNYX_API_KEY ="TELNYX_API_KEY";

Telnyx.TelnyxConfiguration.SetApiKey(TELNYX_API_KEY);
VerificationService verifyService = new VerificationService();

string webhookURL = "";

var messagingProfile = new Telnyx.MessagingProfileService()
var stuff = new Telnyx.MessagingProfileUpdate
  {
     NumberPoolSettings = {
       Geomatch = false,
       LongCodeWeight = 1,
       TollFreeWeight =1,
     }
  };
messagingProfile.Update(webhookURL, stuff);

After pasting the above content, Kindly check and remove any new line added
​
Ruby
Number Pool distributes your outbound messaging traffic across multiple phone numbers to help you manage your messaging campaigns. The pool of numbers includes all long code and toll-free numbers assigned to your Messaging Profile. When you send a message, the “From” number is selected from the numbers in your Number Pool that aren’t currently being used to send a message.
Follow the instructions below to set up Number Pool on one of your Messaging Profiles. You will also need to associate at least one phone number with the Messaging Profile.
When sending messages, use the send endpoint for Number Pool. You will need to omit the “From” field from the request and instead specify the Messaging Profile (via the messaging_profile_id parameter) with the number pool you’d like to utilize for sending your message.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
​
Weights
Long Code and Toll Free weight defines the ratio at which a number type will be selected when sending a message. For example, if Long Code weight is 5, and Toll Free weight is 1, then every five messages will be sent from a Long Code number in the number pool, and the sixth message will be sent from a Toll Free number. The sum of the weights for all number types does not necessarily need to add to 100. Weight must be a non-negative number, and when equal to zero it will remove the number type from the pool.
​
Skip Unhealthy
If this feature is enabled, Telnyx takes into the account the health of a number when choosing a number from the pool. If a number is deemed unhealthy, it’s skipped until it’s deemed to be healthy again.
If no number in the pool is deemed healthy, number pool will not choose a number and will reject the message.
The code below enables and then disables Number Pool for a Messaging Profile:
Report incorrect code
Copy
Ask AI
require "telnyx"
Telnyx.api_key = "YOUR_API_KEY"

mp = Telnyx::MessagingProfile.retrieve("YOUR_MESSAGING_PROFILE_ID")

# turn on number pool

mp.number_pool_settings = {
      long_code_weight: 1,
      toll_free_weight: 10
  }

mp.save

# turn off number pool

mp.number_pool_settings = {}

mp.save

After pasting the above content, Kindly check and remove any new line added
​
Portal
Number Pool distributes your outbound messaging traffic across multiple phone numbers to help you manage your messaging campaigns. The pool of numbers includes all long code and toll-free numbers assigned to your Messaging Profile. When you send a message, the “From” number is selected from the numbers in your Number Pool that aren’t currently being used to send a message.
Follow the instructions below to set up Number Pool on one of your Messaging Profiles. You will also need to associate at least one phone number with the Messaging Profile.
When sending messages, use the send endpoint for Number Pool. You will need to omit the “From” field from the request and instead specify the Messaging Profile (via the messaging_profile_id parameter) with the number pool you’d like to utilize for sending your message.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
​
Weights
Long Code and Toll Free weight defines the ratio at which a number type will be selected when sending a message. For example, if Long Code weight is 5, and Toll Free weight is 1, then every five messages will be sent from a Long Code number in the number pool, and the sixth message will be sent from a Toll Free number. The sum of the weights for all number types does not necessarily need to add to 100. Weight must be a non-negative number, and when equal to zero it will remove the number type from the pool.
​
Skip Unhealthy
If this feature is enabled, Telnyx takes into the account the health of a number when choosing a number from the pool. If a number is deemed unhealthy, it’s skipped until it’s deemed to be healthy again.
If no number in the pool is deemed healthy, number pool will not choose a number and will reject the message.
To configure Number Pool in your Portal:
Click on “Messaging” in the navigation menu on the left-hand side of the Telnyx Mission Control Portal.
Click the edit symbol next to the Messaging Profile you want to use.
Under Outbound, toggle on “Number Pool” to enable.
Once enabled, you can adjust the weighting of long code and toll-free numbers. For higher delivery rates, you can also select “Skip Unhealthy Numbers” to exclude any numbers with low delivery rates.
Click “Save”.

Was this page helpful?

Yes
No
Alphanumeric Sender ID
Short Codes
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Short Code


**URL:** https://developers.telnyx.com/docs/messaging/messages/short-code

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Group Messaging
Alphanumeric Sender ID
Number Pool
Short Codes
Sticky Sender
Geomatch
MMS Converter
MMS Transcoding
Schedule Messages
RCS Deeplinks
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Advanced Features
Short Code
Copy page

Telnyx’s Short Code messaging resource provides a quick and easy way to send messages between users. With Short Code, you can easily send messages to a large number of people without having to remember their phone numbers.

Short codes (common short code or CSC) are 5- or 6-digit phone numbers that customers can lease from the Common Short Code Administration. They’re commonly used for password resets and alerts.
​
Setting up a short code
Customers can request a short code by contacting our Sales team. Once your short code message has been approved and certified by the major carriers, you’ll see the short code listed under the messaging profile that you specified during the approval process. From this point on you can start sending and receiving messages just like you would with long codes.
For customers using SMPP binds, some additional information will need to be supplied. Please contact our Support team for more details.
​
Short code automated responses
Telnyx sends automated responses from short codes for the following purposes:
To pass carrier certification tests.
To send confirmation messages in response to opt-out requests.
Automated responses are generated by Telnyx in response to any of the following messages received by the short code:
KEYWORD
HELP
OPT OUT (STOP and similar)
Once the carrier certification tests have been completed, the customer can choose to disable automated responses to 1. and 2. and instead handle those responses on their own. To do so please contact our Support team. Opt-out responses cannot be disabled, as the established blocking rule will prevent the customer from sending a response message.
Automated response messages will show up to customers as messages that were sent by them, they’ll also be billed in the same way.
The content of the automated response messages is taken from the campaign approval forms.

Was this page helpful?

Yes
No
Number Pool
Sticky Sender
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Sticky Sender


**URL:** https://developers.telnyx.com/docs/messaging/messages/sticky-sender

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Group Messaging
Alphanumeric Sender ID
Number Pool
Short Codes
Sticky Sender
Geomatch
MMS Converter
MMS Transcoding
Schedule Messages
RCS Deeplinks
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Advanced Features
Sticky Sender
Copy page

Use same from number when app sends a message to specific recipient. Start building on Telnyx today.

| cURL | Python | PHP | Node | .NET | Ruby | Portal |
​
cURL
Sticky Sender makes sure the same “From” number is selected every time your application sends a message to a particular recipient. This allows your application to consistently send messages to your user from a single recognizable phone number. When Sticky Sender is enabled, Telnyx will maintain a mapping of the “To” and “From” numbers. This mapping is created after the first message is sent to a particular recipient. Any future messages to that recipient will use the same “From” number.
This information is stored during 8 days since the last message sent to the destination number. Once the 8 days window expires with no new messages, another “From” number could be assigned to start a new Sticky Sender process.
If Sticky Sender is turned off, Telnyx will disregard previously established “To” and “From” mappings when selecting the “From” number for new messages. When a Telnyx phone number is removed from your profile, all associated Sticky Sender mappings are removed.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables Sticky Sender for a Messaging Profile:
Don’t forget to update YOUR_API_KEY here.
Report incorrect code
Copy
Ask AI
curl -X PATCH \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --data '{"number_pool_settings":{"sticky_sender": true}}' \
  "https://api.telnyx.com/v2/messaging_profiles/{YOUR_MESSAGING_PROFILE_ID}"

curl -X PATCH \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --data '{"number_pool_settings":{"sticky_sender": false}}' \
  "https://api.telnyx.com/v2/messaging_profiles/{YOUR_MESSAGING_PROFILE_ID}"

After pasting the above content, Kindly check and remove any new line added
​
Python
Sticky Sender makes sure the same “From” number is selected every time your application sends a message to a particular recipient. This allows your application to consistently send messages to your user from a single recognizable phone number. When Sticky Sender is enabled, Telnyx will maintain a mapping of the “To” and “From” numbers. This mapping is created after the first message is sent to a particular recipient. Any future messages to that recipient will use the same “From” number.
This information is stored during 8 days since the last message sent to the destination number. Once the 8 days window expires with no new messages, another “From” number could be assigned to start a new Sticky Sender process.
If Sticky Sender is turned off, Telnyx will disregard previously established “To” and “From” mappings when selecting the “From” number for new messages. When a Telnyx phone number is removed from your profile, all associated Sticky Sender mappings are removed.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Sticky Sender for a Messaging Profile:
Report incorrect code
Copy
Ask AI
import telnyx
telnyx.api_key = "YOUR_API_KEY"

mp = telnyx.MessagingProfile.retrieve("YOUR_MESSAGING_PROFILE_ID")

# turn on sticky sender
mp.number_pool_settings = {"sticky_sender": True}
mp.save()

# turn off sticky sender
mp.number_pool_settings = {"sticky_sender": False}
mp.save()

After pasting the above content, Kindly check and remove any new line added
​
PHP
Sticky Sender makes sure the same “From” number is selected every time your application sends a message to a particular recipient. This allows your application to consistently send messages to your user from a single recognizable phone number. When Sticky Sender is enabled, Telnyx will maintain a mapping of the “To” and “From” numbers. This mapping is created after the first message is sent to a particular recipient. Any future messages to that recipient will use the same “From” number.
This information is stored during 8 days since the last message sent to the destination number. Once the 8 days window expires with no new messages, another “From” number could be assigned to start a new Sticky Sender process.
If Sticky Sender is turned off, Telnyx will disregard previously established “To” and “From” mappings when selecting the “From” number for new messages. When a Telnyx phone number is removed from your profile, all associated Sticky Sender mappings are removed.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Sticky Sender for a Messaging Profile:
Report incorrect code
Copy
Ask AI
\Telnyx\Telnyx::setApiKey('YOUR_API_KEY');

//Turn on sticky sender
\Telnyx\MessagingProfile::Update("YOUR_MESSAGING_PROFILE_ID", ["number_pool_settings" => {"sticky_sender": true}]);

//Turn off sticky sender
\Telnyx\MessagingProfile::Update("YOUR_MESSAGING_PROFILE_ID", ["number_pool_settings" => {"sticky_sender": false}]);

After pasting the above content, Kindly check and remove any new line added
​
Node
Sticky Sender makes sure the same “From” number is selected every time your application sends a message to a particular recipient. This allows your application to consistently send messages to your user from a single recognizable phone number. When Sticky Sender is enabled, Telnyx will maintain a mapping of the “To” and “From” numbers. This mapping is created after the first message is sent to a particular recipient. Any future messages to that recipient will use the same “From” number.
This information is stored during 8 days since the last message sent to the destination number. Once the 8 days window expires with no new messages, another “From” number could be assigned to start a new Sticky Sender process.
If Sticky Sender is turned off, Telnyx will disregard previously established “To” and “From” mappings when selecting the “From” number for new messages. When a Telnyx phone number is removed from your profile, all associated Sticky Sender mappings are removed.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Sticky Sender for a Messaging Profile:
Report incorrect code
Copy
Ask AI
import Telnyx from 'telnyx';

const telnyx = new Telnyx("YOUR_API_KEY");

// Turn on sticky sender
const { data : messagingProfile } = await telnyx.messagingProfiles.update(
  'YOUR_MESSAGING_PROFILE_ID',
  {
    "number_pool_settings": { "sticky_sender": true }
  }
)

// Turn off sticky sender
const { data : messagingProfile } = await telnyx.messagingProfiles.update(
  'YOUR_MESSAGING_PROFILE_ID',
  {
    "number_pool_settings": { "sticky_sender": false}
  }
)

After pasting the above content, Kindly check and remove any new line added
​
.NET
Sticky Sender makes sure the same “From” number is selected every time your application sends a message to a particular recipient. This allows your application to consistently send messages to your user from a single recognizable phone number. When Sticky Sender is enabled, Telnyx will maintain a mapping of the “To” and “From” numbers. This mapping is created after the first message is sent to a particular recipient. Any future messages to that recipient will use the same “From” number.
This information is stored during 8 days since the last message sent to the destination number. Once the 8 days window expires with no new messages, another “From” number could be assigned to start a new Sticky Sender process.
If Sticky Sender is turned off, Telnyx will disregard previously established “To” and “From” mappings when selecting the “From” number for new messages. When a Telnyx phone number is removed from your profile, all associated Sticky Sender mappings are removed.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Sticky Sender for a Messaging Profile:
Report incorrect code
Copy
Ask AI
using System;
using Telnyx.net.Services.VerifyAPI;
private static string TELNYX_API_KEY ="TELNYX_API_KEY";

Telnyx.TelnyxConfiguration.SetApiKey(TELNYX_API_KEY);
VerificationService verifyService = new VerificationService();

string webhookURL = "";

var messagingProfile = new Telnyx.MessagingProfileService()
// Sticky Sender turned on
var stickyTrue = new Telnyx.MessagingProfileUpdate
  {
     NumberPoolSettings = {
       StickySender = true
     }
  };

// Sticky Sender turned off
var stickyFalse = new Telnyx.MessagingProfileUpdate
  {
    NumberPoolSettings = {
      StickySender = false
    }
  };
messagingProfile.Update(webhookURL, stickyTrue); // Sticky settings to true
messageProfile.Update(webhookURL, stickyFalse); // Sticky settings to false

After pasting the above content, Kindly check and remove any new line added
​
Ruby
Sticky Sender makes sure the same “From” number is selected every time your application sends a message to a particular recipient. This allows your application to consistently send messages to your user from a single recognizable phone number. When Sticky Sender is enabled, Telnyx will maintain a mapping of the “To” and “From” numbers. This mapping is created after the first message is sent to a particular recipient. Any future messages to that recipient will use the same “From” number.
This information is stored during 8 days since the last message sent to the destination number. Once the 8 days window expires with no new messages, another “From” number could be assigned to start a new Sticky Sender process.
If Sticky Sender is turned off, Telnyx will disregard previously established “To” and “From” mappings when selecting the “From” number for new messages. When a Telnyx phone number is removed from your profile, all associated Sticky Sender mappings are removed.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Sticky Sender for a Messaging Profile:
Report incorrect code
Copy
Ask AI
require "telnyx"
Telnyx.api_key = "YOUR_API_KEY"

mp = Telnyx::MessagingProfile.retrieve("YOUR_MESSAGING_PROFILE_ID")

# turn on sticky sender
mp.number_pool_settings = {
  sticky_sender: true
}
mp.save

# turn off sticky sender
mp.number_pool_settings = {
  sticky_sender: false
}
mp.save

After pasting the above content, Kindly check and remove any new line added
​
Portal
Sticky Sender makes sure the same “From” number is selected every time your application sends a message to a particular recipient. Your application will consistently send messages to your end user from a single recognizable phone number. Once this feature is enabled, Telnyx will maintain a mapping of the “To” and “From” numbers after the first message is sent to a particular recipient, and any future messages to that recipient will use the same “From” number.
This information is stored during 8 days since the last message sent to the destination number. Once the 8 days window expires with no new messages, another “From” number could be assigned to start a new Sticky Sender process.
If Sticky Sender is turned off, Telnyx will disregard previously established “To” and “From” mappings when selecting the “From” number for new messages. When a Telnyx phone number is removed from your profile, all associated Sticky Sender mappings are removed.
To configure Sticky Sender in your Portal:
Click on “Messaging” in the navigation menu on the left-hand side of the Telnyx Mission Control Portal.
Click the edit symbol next to the Messaging Profile you want to use.
Under Outbound, toggle on “Number Pool” to enable.
Select the “Sticky Sender” checkbox.
Click “Save”.
That’s it! You’re ready to use Sticky Sender.

Was this page helpful?

Yes
No
Short Codes
Geomatch
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Geomatch


**URL:** https://developers.telnyx.com/docs/messaging/messages/geomatch

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Group Messaging
Alphanumeric Sender ID
Number Pool
Short Codes
Sticky Sender
Geomatch
MMS Converter
MMS Transcoding
Schedule Messages
RCS Deeplinks
Compliance & Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Advanced Features
Geomatch
Copy page

Choose a number from the number pool that matches. Start building on Telnyx today.

| cURL | Python | PHP | Node | .NET | Ruby | Portal |
​
cURL
When Geomatch is enabled for your messaging profile’s number pool, Telnyx will choose a number from the number pool that matches US area code of the recipient’s phone number.
If there is no number in the pool that matches, Telnyx will fallback to using another number from the number pool.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Geomatch for a Messaging Profile:
Report incorrect code
Copy
Ask AI
curl -X PATCH \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --data '{"number_pool_settings":{"geomatch": true}}' \
  "https://api.telnyx.com/v2/messaging_profiles/{YOUR_MESSAGING_PROFILE_ID}"


curl -X PATCH \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --data '{"number_pool_settings":{"geomatch": false}}' \
  "https://api.telnyx.com/v2/messaging_profiles/{YOUR_MESSAGING_PROFILE_ID}"

After pasting the above content, Kindly check and remove any new line added
​
Python
When Geomatch is enabled for your messaging profile’s number pool, Telnyx will choose a number from the number pool that matches US area code of the recipient’s phone number.
If there is no number in the pool that matches, Telnyx will fallback to using another number from the number pool.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Geomatch for a Messaging Profile:
Report incorrect code
Copy
Ask AI
import telnyx
telnyx.api_key = "YOUR_API_KEY"

mp = telnyx.MessagingProfile.retrieve("YOUR_MESSAGING_PROFILE_ID")

# turn on geomatch
mp.number_pool_settings = {"geomatch": True}
mp.save()

# turn off geomatch
mp.number_pool_settings = {"geomatch": False}
mp.save()

After pasting the above content, Kindly check and remove any new line added
​
PHP
When Geomatch is enabled for your messaging profile’s number pool, Telnyx will choose a number from the number pool that matches US area code of the recipient’s phone number.
If there is no number in the pool that matches, Telnyx will fallback to using another number from the number pool.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Geomatch for a Messaging Profile:
Report incorrect code
Copy
Ask AI
\Telnyx\Telnyx::setApiKey('YOUR_API_KEY');

//Turn on geomatch
\Telnyx\MessagingProfile::Update("YOUR_MESSAGING_PROFILE_ID", ["number_pool_settings" => {"geomatch": true}]);

//Turn off geomatch
\Telnyx\MessagingProfile::Update("YOUR_MESSAGING_PROFILE_ID", ["number_pool_settings" => {"geomatch": false}]);

After pasting the above content, Kindly check and remove any new line added
​
Node
When Geomatch is enabled for your messaging profile’s number pool, Telnyx will choose a number from the number pool that matches US area code of the recipient’s phone number.
If there is no number in the pool that matches, Telnyx will fallback to using another number from the number pool.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Geomatch for a Messaging Profile:
Report incorrect code
Copy
Ask AI
import Telnyx from "telnyx";

const telnyx = new Telnyx("YOUR_API_KEY");
// Turn on geomatch
const { data: messagingProfile } = await telnyx.messagingProfiles.update(
  "YOUR_MESSAGING_PROFILE_ID",
  {
    number_pool_settings: { geomatch: true },
  }
);

// Turn off geomatch
const { data: messagingProfile } = await telnyx.messagingProfiles.update(
  "YOUR_MESSAGING_PROFILE_ID",
  {
    number_pool_settings: { geomatch: false },
  }
);

After pasting the above content, Kindly check and remove any new line added
​
.NET
When Geomatch is enabled for your messaging profile’s number pool, Telnyx will choose a number from the number pool that matches US area code of the recipient’s phone number.
If there is no number in the pool that matches, Telnyx will fallback to using another number from the number pool.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Geomatch for a Messaging Profile:
Report incorrect code
Copy
Ask AI
using System;
using Telnyx.net.Services.VerifyAPI;
private static string TELNYX_API_KEY ="TELNYX_API_KEY";

Telnyx.TelnyxConfiguration.SetApiKey(TELNYX_API_KEY);
VerificationService verifyService = new VerificationService();

string webhookURL = "";
var messagingProfile = new Telnyx.MessagingProfileService()
var stuff = new Telnyx.MessagingProfileUpdate
  {
     NumberPoolSettings = {
       Geomatch = false,
       LongCodeWeight = 1,
       TollFreeWeight =1,
     }
  };
messagingProfile.Update(webhookURL, stuff);

After pasting the above content, Kindly check and remove any new line added
​
Ruby
When Geomatch is enabled for your messaging profile’s number pool, Telnyx will choose a number from the number pool that matches US area code of the recipient’s phone number.
If there is no number in the pool that matches, Telnyx will fallback to using another number from the number pool.
Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
The code below enables and then disables Geomatch for a Messaging Profile:
Report incorrect code
Copy
Ask AI
import "telnyx"
Telnyx.api_key = "YOUR_API_KEY"

mp = Telnyx::MessagingProfile.retrieve("YOUR_MESSAGING_PROFILE_ID")

# turn on geomatch
mp.number_pool_settings = {
    geomatch: true
}

mp.save

# turn off geomatch
mp.number_pool_settings = {
    geomatch: false
}

mp.save

After pasting the above content, Kindly check and remove any new line added
​
Portal
When Geomatch is enabled for your messaging profile’s number pool, Telnyx will choose a number from the number pool that matches US area code of the recipient’s phone number. Matching the area code of your customers will help increase the trust in the message, thus boosting engagement and improving the customer experience.
If there is no number in the pool that matches, Telnyx will fallback to using another number from the number pool.
Configuring Geomatch Your Messaging Profile ID can found at the top of your Messaging Profile under the “Profile Info” section.
To configure Geomatch in your Portal:
Click on “Messaging” in the navigation menu on the left-hand side of the Telnyx Mission Control Portal.
Click the edit symbol next to the Messaging Profile you want to use.
Under Outbound, toggle on “Number Pool” to enable.
Select the “Geomatch” checkbox.
Click “Save”.
That’s it! Geomatch is now enabled for when you send messages with Telnyx.

Was this page helpful?

Yes
No
Sticky Sender
MMS Converter
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## 10Dlc - Quickstart


**URL:** https://developers.telnyx.com/docs/messaging/10dlc/quickstart

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Compliance & Verification
10DLC Quickstart
10DLC Rate Limits & Scores
10DLC Event Notifications
Opt In/Out Management
Traffic Type
Toll-Free Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Compliance & Verification
Getting started with 10DLC
Copy page

Begin your 10DLC journey with Telnyx—Comprehensive guide on brand creation, campaign setup, and phone number association.

10DLC A2P is the new standard for A2P traffic on local longcodes. The goal is to provide better throughput and less blocking while at the same time allow the mobile terminating carriers to vet and verify the content traversing through their network.
The general steps for accomplishing this are:
Create a Brand that identifies the business running the messaging traffic.
Create a Campaign that is associated to the Brand.
Associate the Campaign to a Phone Number.
Telnyx provides a management UI as well as an API to facilitate the creation of Brands, Campaigns, and the association of Phone Numbers to Campaigns.
​
Setting up your first 10DLC campaign
​
Create a brand
On the Mission Control Portal, click on to messaging
Navigate to Campaigns
Click on create brand
Enter your business information.
Click Save. You will be redirected to the Campaigns page.
​
Vet a brand
Click the brand you want to vet on the Campaigns page.
Under the Vetting Request section, choose “Aegis Mobile” as the Provider and “Standard” as the Vetting Class.
Click “Apply for Vetting”. Your updated vetting data will appear in the Brand Data section when finished.
​
Create a campaign
Below the list of Brands, there is a panel that contains Campaigns associated to the Brand. Click on Create New Campaign.
Select the usecase for the campaign and click Next.
You will receive the Carrier Terms as well as the Brand Score on this page. Click Next to continue.
Add the Vertical, sample messages, and campaign attributes. Then, accept the terms and conditions.
​
Associating a campaign to a phone number
Note: This step assumes that you already have a phone number and a Messaging Profile has been assigned to the number. If you have not done so yet, check out this guide.
Navigate to the Campaigns page.
Select the Brand. Then select the Campaign you wish to assign Phone Numbers to. You will be redirected to the Campaign Details page.
Navigate to the Assign Numbers panel.
Select the Messaging Profile the number is associated with.
Type in the number you wish to assign the campaign to.
​
API access and documentation related to 10DLC
All portal UI actions described above are available via HTTP API. Telnyx currently offers an alpha API that is being updated as The Campaign Registry updates their offering. Current plans to roll this into the Telnyx V2 API as well as SDK access are underway and will be made available later in the year.
If interested, you can also copy and paste the following JSON into this Swagger Editor: Telnyx 10DLC API Specs
For more details, see Frequently asked questions about 10DLC.

Was this page helpful?

Yes
No
RCS Deeplinks
10DLC Rate Limits & Scores
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## 10Dlc - 10Dlc Rate Limits


**URL:** https://developers.telnyx.com/docs/messaging/10dlc/how-to-maximize-rate-limits-and-scores

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
404
Page Not Found
We couldn't find the page. Maybe you were looking for one of these pages below?
How to maximize 10DLC rate limits and scores
Getting started with 10DLC
Rate Limiting
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## 10Dlc - Event Notifications


**URL:** https://developers.telnyx.com/docs/messaging/10dlc/event-notifications

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Compliance & Verification
10DLC Quickstart
10DLC Rate Limits & Scores
10DLC Event Notifications
Opt In/Out Management
Traffic Type
Toll-Free Verification
Use Cases & Integrations
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Compliance & Verification
10DLC event notifications
Copy page
You can choose to be notified about events on your 10DLC Brands, Campaigns and Phone Numbers by configuring webhooks.
For this mechanism to work, you’ll need a publicly accessible HTTP server that can receive our webhook requests at one or more specified URLs. We highly recommend using HTTPS (instead of HTTP). This tutorial walks through setting up a basic application for receiving webhooks.
​
Configuring webhooks
To receive notifications for brands you need to either provide the webhooks at the creation of the brand or you may update an existing brand. On both cases you have to pass your webhooks in the webhookURL and webhookFailoverURL.
webhookFailoverURL is optional. Here is an example of updating the webhooks of a brand:
Don’t forget to update YOUR_API_KEY here.
Report incorrect code
Copy
Ask AI
curl -X PUT https://api.telnyx.com/10dlc/brand/:brandid \
  -H 'Content-type: application/json' \
  -H 'Authorization: Bearer <YOUR_API_KEY>' \
  -d '{"webhookURL":"https://mywebhooks.com/c5e5e598-95b3-4076-bfe2-c7d2c58ec57f", "webhookFailoverURL":"http://mywebhooks.com/ae20ec14-1c23-4275-add5-3290706b450f"}'

The same applies for campaign event notifications. Webhooks can be provided either upon campaign creation or through an update.
Webhooks configured for a campaign are also leverage for event notification with phone numbers associated to said campaign. Phone number notifications are triggered also for shared campaigns.
​
Types of events
​
Overall structure of events
Here is an example of a webhook event:
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "10dlc.brand.update",
    "id": "02d4f0e2-7a9d-4ebf-86b9-3df81e862d49",
    "occurred_at": "2024-08-07T17:22:37.328+00:00",
    "payload": {
      "brandId": "97091164-e814-435c-9c1b-14ab2d18e987",
      "brandName": "Some Brand LLC",
      "description": "Brand BBRAND1 is added",
      "eventType": "BRAND_ADD",
      "status": "success",
      "tcrBrandId": "BBRAND1",
      "type": "TCR_BRAND_WEBHOOK"
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "https://mywebhooks.com/310fda1a-d415-4827-837b-5f7e72657b65"
  }
}

Let’s have a closer look at the data key:
Field	Description
event_type	We currently support 3 types of events: 10dlc.brand.update, 10dlc.campaign.update and 10dlc.phone_number.update for updates related to brands, campaigns and phone numbers respectively.
id	Unique id of this event.
occurred_at	Timestamp of the event.
payload	The content of the payload varies according with the type of event. Below we listed the different payload types grouped by entity.
​
Brand events
Payload type	Description
REGISTRATION	Failures during the registration process. The payload will contain a field called reasons with more details about the errors encountered.
REVET	Success of the revetting request operation. See this for more details .
ORDER_EXTERNAL_VETTING	Notification on the process of ordering an external vetting. The status field indicates if the order succeed or failed.
TCR_BRAND_WEBHOOK	Notifications received from TCR. The table below has a list of all TCR events that are included here.
Here is a list of all TCR events under the TCR_BRAND_WEBHOOK type:
TCR Event	Description
BRAND_ADD	Brand successfully added on TCR.
BRAND_APPEAL_ADD	A Brand appeal was added.
BRAND_APPEAL_COMPLETE	The result of a brand appeal.
BRAND_REVET	Result of a brand revet request.
Here is an example of a REGISTRATION notification:
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "10dlc.campaign.update",
    "id": "456abc67-7a9d-4ebf-86b9-3df81e862d49",
    "occurred_at": "2024-08-07T17:22:37.328+00:00",
    "payload": {
      "brandId": "b0e2ec67-b26f-4c77-affc-d10f4d1780d3",
      "status": "failed",
      "type": "REGISTRATION",
      "reasons": [
        {
          "fields": [
            "ein"
          ],
          "description": "Invalid EIN - EIN is a nine-digit number. The format is XX-XXXXXXX. The \"-\" symbol is also accepted."
        }
      ]
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "https://mywebhooks.com/310fda1a-d415-4827-837b-5f7e72657b65"
  }
}


​
Campaign events
Payload type	Description
REGISTRATION	Notifications about failures during the registration process. The errors will be listed in the reasons field of the payload.
NUMBER_POOL_PROVISIONED	Success on provisioning a number pool.
NUMBER_POOL_DEPROVISIONED	Success on deprovisioning a number pool.
TCR_EVENT	Notification received from TCR.
MNO_REVIEW	MNO review results. The payload contains a status field that indicates if the campaign was ACCEPTED or REJECTED. In case of rejection, the description field provides a reason.
VERIFIED	Campaign registration was verified.
Here is a list of all TCR events under the TCR_EVENT type:
TCR Event	Description
CAMPAIGN_ADD	Campaign successfully added.
CAMPAIGN_EXPIRED	Campaign is expired.
CAMPAIGN_RESUBMISSION	Campaign resubmission
CAMPAIGN_NUDGE	Nudge event sent by partner CSP to trigger campaign re-review after appeal or rejection.
Here is an example of a VERIFIED notification:
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "10dlc.campaign.update",
    "id": "456abc67-7a9d-4ebf-86b9-3df81e862d49",
    "occurred_at": "2024-08-07T17:22:37.328+00:00",
    "payload": {
      "brandId": "BBRAND1",
      "campaignId": "CCAMP1",
      "createdDate": "2024-07-06T14:22:37.328+00:00",
      "cspId": "CSPID1",
      "type": "VERIFIED",
      "isTMobileRegistered": true
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "https://mywebhooks.com/310fda1a-d415-4827-837b-5f7e72657b65"
  }
}

​
Phone number events
Payload type	Description
ASSIGNMENT	Notifications about the phone number assignment process. In case of failure, an error message is displayed in the reasons field. That field is empty in case of a successful assignment.
DELETION	Notifications about the phone number removal process. In case of failure, an error message is displayed in the reasons field. That field is empty in case of a successful removal.
STATUS_UPDATE	The status of the phone number was updated. The new status is shown in the status field.
Here is an example of a successful ASSIGNMENT notification:
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "10dlc.phone_number.update",
    "id": "123abc67-7a9d-4ebf-86b9-3df81e862d49",
    "occurred_at": "2024-08-07T17:22:37.328+00:00",
    "payload": {
      "campaignId": "751c6a5c-907b-43a9-8ada-ba1dc8335b07",
      "phoneNumber": "+16715455939",
      "status": "success",
      "type": "ASSIGNMENT",
      "reasons": []
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "https://mywebhooks.com/310fda1a-d415-4827-837b-5f7e72657b65"
  }
}

​
Campaign Appeals and Nudging Mechanisms
When campaigns are rejected, there are different flows for getting them back into the compliance review queue depending on the campaign type and rejection reason.
​
Native Campaign Appeals
For native campaigns rejected due to external factors (e.g., website compliance issues), customers can use the campaign appeal endpoint after addressing the issues:
API Endpoint:
Report incorrect code
Copy
Ask AI
curl -X POST 'https://api.telnyx.com/10dlc/campaign/{campaignId}/appeal' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "appealReason": "The website has been updated to include the required privacy policy and terms of service."
  }'

Response:
Report incorrect code
Copy
Ask AI
{
  "additionalProp1": null,
  "additionalProp2": null,
  "additionalProp3": null
}

This will update the campaign status from TELNYX_FAILED to TCR_ACCEPTED and re-enter the compliance review queue.
​
Partner Campaign Nudging
For partner campaigns, the appeal process involves the CSP (Campaign Service Provider) sending a CAMPAIGN_NUDGE event after reviewing and approving customer changes:
CAMPAIGN_NUDGE Webhook Payload Example:
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "10dlc.campaign.update",
    "id": "example-event-id",
    "occurred_at": "2025-07-30T11:07:51.259711+00:00",
    "payload": {
      "campaignId": "C4D06C2F",
      "type": "CAMPAIGN_NUDGE",
      "nudgeIntent": "APPEAL_REJECTION",
      "description": "The campaign has been reviewed and approved after appeal.",
      "cspId": "TNX"
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "https://your-webhook-url.com"
  }
}

​
Campaign Appeal Scenarios
There are several specific scenarios where campaign appeals may be needed:
​
1. Native Campaign Rejected for Content Issues
When a customer submits a native campaign and Telnyx rejects it due to issues with the campaign content (e.g., unclear sample messages), the customer can make adjustments to their campaign. Using the campaign update endpoint will automatically reset the campaign’s status to TCR_ACCEPTED so it goes back into the compliance team’s review queue.
​
2. Native Campaign Rejected for External Factors
When a customer submits a native campaign and Telnyx rejects it due to factors outside the campaign object (e.g., website compliance requirements), the customer must:
Fix the external issues (e.g., update website with required privacy policy)
Use the appeal API endpoint to get their campaign back in the review queue
Example failure reason:
Report incorrect code
Copy
Ask AI
{
  "reason": "Website does not meet compliance requirements."
}

After fixes are made, the appeal request:
Report incorrect code
Copy
Ask AI
curl -X POST 'https://api.telnyx.com/10dlc/campaign/{campaignId}/appeal' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "appealReason": "The website has been updated to include the required privacy policy and terms of service."
  }'

​
3. Partner Campaign Rejected (Any Reason)
For partner campaigns rejected for either content issues or external factors, the process involves the CSP:
Customer makes required adjustments based on rejection reasons
CSP reviews the changes and approves them
CSP forwards a CAMPAIGN_NUDGE event to Telnyx
Campaign status changes from TELNYX_FAILED to TCR_ACCEPTED and re-enters compliance review
This nudging mechanism for partner campaigns cannot work with native campaigns.
​
4. DCA Rejection for External Factors
When Telnyx accepts a campaign but the Direct Connect Aggregator (DCA) rejects it due to external factors:
Customer makes required external changes (e.g., website updates)
Customer notifies Telnyx via appropriate appeal mechanism (scenarios 2 or 3)
Once Telnyx approves the changes, Telnyx generates a nudge webhook that the DCA receives
Campaign re-enters DCA review queue
​
5. DCA Rejection for Content Issues
When the DCA rejects a campaign due to campaign content issues:
Customer updates campaign content (e.g., sample messages)
Customer notifies Telnyx via appropriate appeal mechanism (scenarios 1 or 3)
Once Telnyx approves the changes, Telnyx generates a nudge webhook that the DCA receives
Campaign re-enters DCA review queue
​
Campaign Status Flow
The typical status flow for campaign appeals is:
Initial Rejection: Campaign status becomes TELNYX_FAILED
Customer Action: Customer addresses the rejection reasons
Appeal Submission:
Native campaigns: Use appeal API endpoint or campaign update
Partner campaigns: CSP sends CAMPAIGN_NUDGE
Re-review: Campaign status changes to TCR_ACCEPTED and re-enters compliance review
​
Appeal Metadata
When native campaigns are appealed through the API endpoint, the system stores detailed metadata about the appeal:
Database fields after successful appeal:
campaign_status: Changes from TELNYX_FAILED to TCR_ACCEPTED
appeal_metadata: JSON object containing appeal details
Example appeal metadata structure:
Report incorrect code
Copy
Ask AI
{
  "appealed_at": "2025-07-30T11:07:51.259711+00:00",
  "appeal_reason": "The website has been updated to include the required privacy policy and terms of service."
}

This metadata allows tracking of the appeal history and provides context for the compliance review team.
The nudging mechanism for partner campaigns cannot be used with native campaigns. Native campaigns must use the direct appeal API endpoint or campaign update functionality.

Was this page helpful?

Yes
No
10DLC Rate Limits & Scores
Opt In/Out Management
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Advanced Opt In Out


**URL:** https://developers.telnyx.com/docs/messaging/10dlc/advanced-opt-in-out-for-messaging

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
404
Page Not Found
We couldn't find the page. Maybe you were looking for one of these pages below?
Advanced opt in/out for Messaging
Getting started with 10DLC
How to maximize 10DLC rate limits and scores
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Toll Free Verification


**URL:** https://developers.telnyx.com/docs/messaging/10dlc/toll-free-verification-with-business-registration-fields

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
404
Page Not Found
We couldn't find the page. Maybe you were looking for one of these pages below?
Toll-Free Verification with Business Registration Fields
Getting started with 10DLC
Paid Account Privileges & Limitations
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - 2Fa


**URL:** https://developers.telnyx.com/docs/messaging/messages/2fa

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Compliance & Verification
Use Cases & Integrations
Two-Factor Authentication (2FA)
Appointment Reminders
Hosted SMS
Receive and Respond to SMS/MMS
Twexit API
Zapier Integration
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Use Cases & Integrations
Two-factor authentication (2FA) docs
Copy page

Explore Telnyx’s 2FA implementation guides—Complete walkthroughs for enhancing security in various programming languages.

| Python | Node | Ruby |
​
2FA for Python
⏱ 20 minutes build time || Difficulty Level: Intermediate || Github Repo
​
Configuration file
Create a config.cfg file in your project directory. Flask will load this at startup. First, use this guide to provision an SMS number and messaging profile, and create an API key. Then add those to the config file.
Report incorrect code
Copy
Ask AI
API_KEY='YOUR_API_KEY'
FROM_NUMBER='YOUR_TELNYX_NUMBER'

We’ll also place Flask in debug mode, assume all numbers are in the U.S., and specify the number of characters we’d like the OTP token to be.
Report incorrect code
Copy
Ask AI
DEBUG=True
COUNTRY_CODE='+1'
TOKEN_LENGTH=4

​
Token storage
We’ll use a class to store tokens in memory for the purposes of this example. In a production environment, a traditional database would be appropriate. Create a class called TokenStorage with three methods. This class will store uppercase tokens as keys, with details about those tokens as values, and expose check and delete methods.
Report incorrect code
Copy
Ask AI
class TokenStorage():
    tokens = {}

    @classmethod
    def add_token(cls, token, phone_number):
        cls.tokens[token] = {
            'phone_number': phone_number,
            'last_updated': datetime.now(),
            'token': token.upper()
        }

    @classmethod
    def token_is_valid(cls, token):
        return token.upper() in cls.tokens

    @classmethod
    def clear_token(cls, token):
        del TokenStorage.tokens[token.upper()]

​
Server initialization
Setup a simple Flask app, load the config file, and configure the telnyx library. We’ll also serve an index.html page, the full source of this is available on GitHub, but it includes a form that collects a phone number for validation.
Report incorrect code
Copy
Ask AI
app = Flask(__name__)
app.config.from_pyfile('config.cfg')

telnyx.api_key = app.config['API_KEY']

@app.route('/')
def serve_index():
    return render_template('index.html')

​
Token generation
We’ll start with a simple method, get_random_token_hex, that generates a random string of hex characters to be used as OTP tokens.
Report incorrect code
Copy
Ask AI
def get_random_token_hex(num_chars):
    byte_data = secrets.token_hex(math.ceil(num_chars / 2.0))
    return byte_data.upper()[:num_chars]

The token_hex method accepts a number of bytes, so we need to divide by two and and round up in order to ensure we get enough characters (two characters per byte), and then finally trim by the actual desired length. This allows us to support odd numbered token lengths.
Next, handle the form on the /request route. First this method normalizes the phone number.
Report incorrect code
Copy
Ask AI
@app.route('/request', methods=['POST'])
def handle_request():
    phone_number = (request.form['phone']
                    .replace('-', '').replace('.', '')
                    .replace('(', '').replace(')', '')
                    .replace(' ', ''))

Then generate a token and add the token/phone number pair to the data store.
Report incorrect code
Copy
Ask AI
    generated_token = get_random_token_hex(app.config['TOKEN_LENGTH'])
    TokenStorage.add_token(generated_token, phone_number)

Finally, send an SMS to the device and serve the verification page.
Report incorrect code
Copy
Ask AI
    telnyx.Message.create(
        to=app.config['COUNTRY_CODE'] + phone_number,
        from_=app.config['FROM_NUMBER'],
        text='Your token is ' + generated_token
    )

    return render_template('verify.html')

​
Token verification
The verify.html file includes a form that collects the token and sends it back to the server. If the token is valid, we’ll clear it from the datastore and serve the success page.
Report incorrect code
Copy
Ask AI
@app.route('/verify', methods=['POST'])
def handle_verify():
    token = request.form['token']

    if TokenStorage.token_is_valid(token):
        TokenStorage.clear_token(token)
        return render_template('verify_success.html')

Otherwise, send the user back to the verify form with an error message
Report incorrect code
Copy
Ask AI
    else:
        return render_template('verify.html', display_error=True)

​
Finishing up
At the end of the file, run the server.
Report incorrect code
Copy
Ask AI
if __name__ == "__main__":
    app.run()

To start the application, run python otp_demo.py from within the virtualenv.
​
2FA for Node
⏱ 20 minutes build time || Difficulty Level: Intermediate || Github Repo
​
Configuration
Create a config.json file in your project directory. Express will load this at startup. First, use this guide to provision an SMS number and messaging profile, and create an API key. Then add those to the config file.
Report incorrect code
Copy
Ask AI
{
    "API_KEY": "YOUR_API_KEY",
    "FROM_NUMBER": "YOUR_TELNYX_NUMBER"
}

We’ll also place Node in debug mode, assume all numbers are in the U.S., and specify the number of characters we’d like the OTP token to be.
Report incorrect code
Copy
Ask AI
{
    "NODE_ENV": "development",
    "COUNTRY_CODE": "+1",
    "TOKEN_LENGTH": 4 
}

​
Token storage
We’ll use a class to store tokens in memory for the purposes of this example. In a production environment, a traditional database would be appropriate. Create a class called TokenStorage with three methods. This class will store uppercase tokens as keys, with details about those tokens as values, and expose check and delete methods.
Report incorrect code
Copy
Ask AI
class TokenStorage{

  static add_token(token, phone_number){
    this.tokens[token] = {
      'phone_number': phone_number,
      'last_updated': Date.now(),
      'token': token.toUpperCase()
      }
  }

  static token_is_valid(token){
    return token in TokenStorage.tokens 
  }

  static clear_token(token){
    delete TokenStorage.tokens[token]
  }
}

TokenStorage.tokens = {}

​
Server initialization
Setup a simple Express app that watches the templates directory with Nunjucks, load the config file, and configure the telnyx library.
Report incorrect code
Copy
Ask AI
import config from './config.json';
import express from "express";
const app = express()

app.use(express.urlencoded());
app.set('views', `${__dirname}/templates`);

expressNunjucks(app, {
  watch: true,
  noCache: true,
});

​
Collect user input
Create a simple HTML form, index.html, which collects the phone number for validation. The full HTML source can be found at our Github repo, and we’ll serve the root
Report incorrect code
Copy
Ask AI
app.get('/', (_req, res) => {
  res.render('index');
}); 

​
Token generation
We’ll start with a simple method, get_random_token_hex, that generates a random string of hex characters to be used as OTP tokens.
Report incorrect code
Copy
Ask AI
function get_random_token_hex(num_chars) {
  return crypto.randomBytes(num_chars).toString('hex');
}

The randomBytes method accepts a number of bytes, so we need to divide by two and and round up in order to ensure we get enough characters (two characters per byte),and then finally trim by the actual desired length. This allows us to support odd numbered token lengths.
Next, handle the form on the /request route. First this method normalizes the phone number.
Report incorrect code
Copy
Ask AI
app.post('/request', (req, res) => {
  let phone_number = req.body.phone.replace('/[\-\.\(\)]/g','')

Then generate a token and add the token/phone number pair to the data store.
Report incorrect code
Copy
Ask AI
  let generated_token = get_random_token_h(config.TOKEN_LENGTH)
  TokenStorage.add_token(generated_token, phone_number)

Finally, send an SMS to the device and serve the verification page.
Report incorrect code
Copy
Ask AI
  telnyx.messages.create({
    "to":   `${phone_number}`,
    "from": `${config.COUNTRY_CODE}${config.FROM_NUMBER}`,
    "text": `Your Token is ${generated_token}`
    })

  res.render('verify.html');
})

​
Token verification
The verify.html file includes a form that collects the token and sends it back to the server. If the token is valid, we’ll clear it from the datastore and serve the success page.
Report incorrect code
Copy
Ask AI
app.post("/verify", (req, res) => {
  let token = req.body.token
  if (TokenStorage.token_is_valid(token)) {
    TokenStorage.clear_token(token)
    res.render('verify_success.html')
  }

Otherwise, send the user back to the verify form with an error message
Report incorrect code
Copy
Ask AI
  else {
    res.render('verify.html')
  }
})

​
Finishing up
At the end of the file, run the server.
Report incorrect code
Copy
Ask AI
const port = 3000
app.listen(port, () => console.log(`App listening on ${port}!`))

To start the application, run node index.js.
​
2FA for Ruby
⏱ 20 minutes build time || Difficulty Level: Intermediate || Github Repo
​
Configuration
Create a config.cfg file in your project directory. Flask will load this at startup. First, use this guide to provision an SMS number and messaging profile, and create an API key. Then add those to the config file.
Report incorrect code
Copy
Ask AI
API_KEY: 'YOUR_API_KEY'
FROM_NUMBER: 'YOUR_TELNYX_NUMBER'
COUNTRY_CODE: '+1'
TOKEN_LENGTH: 4

​
Token storage
We’ll use a class to store tokens in memory for the purposes of this example. In a production environment, a traditional database would be appropriate. Create a class called TokenStorage with three methods. This class will store uppercase tokens as keys, with details about those tokens as values, and expose check and delete methods.
Report incorrect code
Copy
Ask AI
class TokenStorage
    @@tokens = {}
    def self.addToken(token, phoneNumber)
        @@tokens[token] = {
            phone_number: phoneNumber,
            last_updated: DateTime.now,
            token:        token.upcase
        }
    end

    def self.tokenIsValid(token)
        return @@tokens.key?(token)
    end

    def self.clearToken(_token)
        @@tokens.delete(token)
    end
end

​
Server initialization
Setup a simple Flask app, load the config file, and configure the telnyx library. We’ll also serve an index.html page, the full source of this is available on GitHub, but it includes a form that collects a phone number for validation.
Report incorrect code
Copy
Ask AI
$config = YAML.safe_load(File.open('config.yml').read)
Telnyx.api_key = $config['YOUR_API_KEY']

get '/' do
  erb :index
end

​
Token generation
We’ll start with a simple method, get_random_token_hex, that generates a random string of hex characters to be used as OTP tokens. We’ll use the SecureRandom gem for this, as it comes pre-installed in Ruby.
Report incorrect code
Copy
Ask AI
def getRandomTokenHex(numChars)
   return SecureRandom.hex(numChars) 
end

The SecureRandom.hex method accepts a number of bytes, so we need to divide by two and and round up in order to ensure we get enough characters (two characters per byte), and then finally trim by the actual desired length. This allows us to support odd numbered token lengths.
Next, handle the form on the /request route. First this method normalizes the phone number.
Report incorrect code
Copy
Ask AI
post '/request' do
    phoneNumber = params['phone']
                    .gsub('-','').gsub('.','')
                    .gsub('(','').gsub(')','')
                    .gsub(' ','')

Then generate a token and add the token/phone number pair to the data store.
Report incorrect code
Copy
Ask AI
    generatedToken = getRandomTokenHex($config["TOKEN_LENGTH"])
    TokenStorage.addToken(generatedToken, phoneNumber)

Finally, send an SMS to the device and serve the verification page.
Report incorrect code
Copy
Ask AI
    Telnyx::Message.create(
        from: "#{$config["COUNTRY_CODE"]}#{$config["FROM_NUMBER"]}",
        to: "#{phoneNumber}",
        text:"Your token is #{generatedToken}",
    )
    
    erb :verify

end

​
Token verification
The verify.html file includes a form that collects the token and sends it back to the server. If the token is valid, we’ll clear it from the datastore and serve the success page.
Report incorrect code
Copy
Ask AI
get '/verify' do 
    token = params['token']

    if TokenStorage.tokenIsValid(token)
        TokenStorage.clearToken(token)
        erb :verify_sucess

Otherwise, send the user back to the verify form with an error message
Report incorrect code
Copy
Ask AI
    else
      erb :verify, locals: {
        display_error: True
      }
    end
end

​
Finishing up
To start the application, run ruby 2fa.rb.

Was this page helpful?

Yes
No
Toll-Free Verification
Appointment Reminders
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Appointment Reminder


**URL:** https://developers.telnyx.com/docs/messaging/messages/appointment-reminder

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Compliance & Verification
Use Cases & Integrations
Two-Factor Authentication (2FA)
Appointment Reminders
Hosted SMS
Receive and Respond to SMS/MMS
Twexit API
Zapier Integration
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Use Cases & Integrations
Appointment Reminder
Copy page

Automate appointment reminders with Telnyx. Enhance customer experience in just a few steps.

| Python | Node | Ruby |
​
Python for Appointment Reminders
⏱ 15 minutes build time || Difficulty Level: Intermediate || Github Repo
​
Tutorial pre-reqs
Telnyx Portal Account and an API Key
A provisioned SMS enabled number
Messaging Profile.
Familiarity with the messaging quickstart guide.
Familiarity with running celery
Redis Running on port 6379
​
Configuration
Firstly, create a config_file.cfg file in your project directory. Flask will load this at startup.
This file contains a secret key, it should not be committed to source control.
Report incorrect code
Copy
Ask AI
API_KEY='YOUR_API_KEY'
FROM_NUMBER='YOUR_TELNYX_NUMBER'

We’ll also place Flask in debug mode and assume all numbers are in the U.S.
Report incorrect code
Copy
Ask AI
DEBUG=True
COUNTRY_CODE='+1'

After pasting the above content, Kindly check and remove any new line added
Install the necessary packages for the application
Report incorrect code
Copy
Ask AI
$ pip install telnyx
$ pip install flask
$ pip install celery
$ pip install redis

After pasting the above content, Kindly check and remove any new line added
​
Server initialization
Create a file schedule_meeting_server.py and install the basic requirements
The first piece of our application sets up the Telnyx library, Flask, and Celery.
Report incorrect code
Copy
Ask AI
import uuid
from datetime import datetime, timedelta

import telnyx
from celery import Celery
from flask import Flask, request, render_template, flash

app = Flask(__name__)
app.secret_key = uuid.uuid4()
app.config.from_pyfile('config_file.cfg')
celery = Celery('schedule_meeting_server', broker='redis://localhost:6379')

telnyx.api_key = app.config['API_KEY']

After pasting the above content, Kindly check and remove any new line added
​
Collect user input
We’ll create a simple HTML form which collects the meeting date, time, customer name, and phone number.
The Flask route: @app.route('/', methods=['GET', 'POST']) will serve the files created in the folder “templates”
Report incorrect code
Copy
Ask AI
$ mkdir templates
$ touch templates/index.html
$ touch templates/success.html

After pasting the above content, Kindly check and remove any new line added
​
index.html
Inside the newly created templates/index.html
Report incorrect code
Copy
Ask AI
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML//EN">
<html> <head>
<meta charset="utf-8">
<title>Telnyx Meeting Scheduler</title>
</head>

<body>
<!--If form submission results in error, flash error message -->
{% with messages = get_flashed_messages() %}
  {% if messages %}
    <ul class=flashes>
    {% for message in messages %}
      <li>{{ message }}</li>
    {% endfor %}
    </ul>
  {% endif %}
{% endwith %}

<div>
  <h1>Telnyx Meeting Scheduling</h1>
  <form action="{{ url_for('schedule_meeting') }}" method="post">
  <div>
    <label for="name">Your name: </label>
    <input type="text" name="customer_name" required>
  </div>
  <div>
    <label for="treatment">Meeting name: </label>
    <input type="text" name="meeting_name" required>
  </div>
  <div>
    <label for="meeting-date">Appointment date: </label>
    <input type="date" id="meeting_date" name="meeting_date" required>
  </div>
  <div>
    <label for="meeting_time">Meeting time: </label>
    <input type="time" id="meeting_time" name="meeting_time" required>
  </div>
  <div>
    <label for="phone">Your mobile number: </label>
    <input type="tel" id="phone" name="phone" required>
  </div>
  <div>
    <input type="submit" value="Schedule now!">
  </div>
  </form>

</div>

</body> </html>

After pasting the above content, Kindly check and remove any new line added
​
success.html
Inside templates/success.html
Report incorrect code
Copy
Ask AI
<html>
  <head>
    <title>Telnyx Meeting Scheduler</title>
  </head>
<body>
    <p>{{name}}, thanks for booking a meeting for <em>{{meeting_name}}</em>!</p>
    <p>You are scheduled for {{meetingDT}} and will receive a courtesy reminder at {{phone}} three hours before your meeting.</p>
  </body>
</html>

After pasting the above content, Kindly check and remove any new line added
​
Implement the SMS notification
Create a simple function that sends an SMS message parameterized on the destination number and message. The decorator @celery.task allows us to schedule this function to run in the future.
Report incorrect code
Copy
Ask AI
@celery.task
def send_reminder(to, message):
    telnyx.Message.create(
        to=to,
        from_=app.config['FROM_NUMBER'],
        text=message
    )

After pasting the above content, Kindly check and remove any new line added
from is a reserved word in Python. The Telnyx Python Library adds an underscore character to any parameter that would conflict with a reserved keyword.
​
Parse User Input and Schedule the Message
Setup our route which will handle both GET and POST requests.
Report incorrect code
Copy
Ask AI
@app.route('/', methods=['GET', 'POST'])
def schedule_meeting():
    if request.method == "POST":
        # ...
    return render_template('index.html')

After pasting the above content, Kindly check and remove any new line added
Now, within the conditional, first parse the user date/time input.
Report incorrect code
Copy
Ask AI
meeting_date = datetime.strptime(request.form['meeting_date'], '%Y-%m-%d')
meeting_time = datetime.strptime(request.form['meeting_time'], '%H:%M').time()
meeting_datetime = datetime.combine(meeting_date, meeting_time)

After pasting the above content, Kindly check and remove any new line added
Next, only allow meetings to be scheduled that are three hours and five minutes in the future or later.
Report incorrect code
Copy
Ask AI
now = datetime.now()
if meeting_datetime - timedelta(hours=3, minutes=5) < now:
    flash('Appointment time must be at least 3:05 hours from now')
    return render_template('index.html')

After pasting the above content, Kindly check and remove any new line added
Then, compute the reminder time and message, and schedule the reminder.
​
Remind the User
Remind the user 3 hours before the meeting.
Report incorrect code
Copy
Ask AI
reminder_datetime = meeting_datetime - timedelta(hours=3)

message = "{customer_name}, you have a meeting scheduled for {meeting_time}".format(customer_name=request.form['customer_name'], meeting_time=str(meeting_datetime))
to = "{country_code}{phone}".format(country_code=app.config['COUNTRY_CODE'], phone=request.form['phone'])

send_reminder.apply_async([to, message], eta=reminder_datetime)

After pasting the above content, Kindly check and remove any new line added
Finally, render the success template.
Report incorrect code
Copy
Ask AI
return render_template('success.html',
                       name=request.form['customer_name'],
                       meeting_name=request.form['meeting_name'],
                       phone=request.form['phone'],
                       meeting_datetime=str(meeting_datetime))

After pasting the above content, Kindly check and remove any new line added
And at the end of the file, start the server.
Report incorrect code
Copy
Ask AI
if __name__ == '__main__':
    app.run(port=5010)

After pasting the above content, Kindly check and remove any new line added
​
Final schedule_meeting_server.py
All together your schedule_meeting_server.py file should look something like:
Report incorrect code
Copy
Ask AI
import uuid
from datetime import datetime, timedelta

import telnyx
from celery import Celery
from flask import Flask, request, render_template, flash

app = Flask(__name__)
app.secret_key = uuid.uuid4()
app.config.from_pyfile('config_file.cfg')
celery = Celery('schedule_meeting_server', broker='redis://localhost:6379')

telnyx.api_key = app.config['API_KEY']

@celery.task
def send_reminder(to, message):
    telnyx.Message.create(
        to=to,
        from_=app.config['FROM_NUMBER'],
        text=message
    )

@app.route('/', methods=['GET', 'POST'])
def schedule_meeting():
    if request.method == "POST":
        meeting_date = datetime.strptime(request.form['meeting_date'], '%Y-%m-%d')
        meeting_time = datetime.strptime(request.form['meeting_time'], '%H:%M').time()
        meeting_datetime = datetime.combine(meeting_date, meeting_time)

        now = datetime.now()

        if meeting_datetime - timedelta(hours=3, minutes=5) < now:
            flash('Appointmenttest time must be at least 3:05 hours from now')
            return render_template('index.html')

        reminder_datetime = meeting_datetime - timedelta(hours=3)

        message = "{customer_name}, you have a meeting scheduled for {meeting_time}".format(customer_name=request.form['customer_name'], meeting_time=str(meeting_datetime))
        to = "{country_code}{phone}".format(country_code=app.config['COUNTRY_CODE'], phone=request.form['phone'])

        send_reminder.apply_async([to, message], eta=reminder_datetime)

        return render_template('success.html', name=request.form['customer_name'], meeting_name=request.form['meeting_name'],
                               phone=request.form['phone'], meeting_datetime=str(meeting_datetime))

    return render_template('index.html')

if __name__ == '__main__':
    app.run(port=5010)

After pasting the above content, Kindly check and remove any new line added
​
Running the project
Make sure redis is running in the background, and then start the Celery task and Python server. Assuming your code is in schedule_meeting_server.py.
In one terminal, launch the Celery worker (be sure to activate your virtual environment)
Report incorrect code
Copy
Ask AI
$ celery -A schedule_meeting_server.celery worker

After pasting the above content, Kindly check and remove any new line added
Then launch the python flask server
Report incorrect code
Copy
Ask AI
$ python schedule_meeting_server.py

After pasting the above content, Kindly check and remove any new line added
​
Node for Appointment Reminders
⏱ 15 minutes build time || Difficulty Level: Intermediate || Github Repo
​
Pre-reqs
Telnyx Portal Account and an API Key
A provisioned SMS enabled number
Messaging Profile.
Familiarity with the messaging quickstart guide.
​
Configuration
Run the npm init command accepting the defaults
npm install the necessary packages to run the application.
Create a config.json file in your project directory
Create a templates folder for our template views
Create the index.js file to host the express application
Create the index.html and success.html in the templates folder
Report incorrect code
Copy
Ask AI
$ npm init -y
$ npm i express
$ npm i express-nunjucks
$ npm i moment
$ npm i nunjucks
$ npm i telnyx
$ mkdir templates
$ touch config.json index.js templates/index.html templates/success.html

After pasting the above content, Kindly check and remove any new line added
First, use this guide to provision an SMS number and messaging profile, and create an API key. Then add those to the config file, along with your country code.
Report incorrect code
Copy
Ask AI
{
    "COUNTRY_CODE": "+1",
    "FROM_NUMBER": "YOUR_TELNYX_NUMBER"
}

After pasting the above content, Kindly check and remove any new line added
This file contains a secret key, it should not be committed to source control.
​
Server initialization
First, import the config.json file and initialize the Telnyx library.
Report incorrect code
Copy
Ask AI
import Telnyx from 'telnyx';

const telnyx = new Telnyx("YOUR_API_KEY");

After pasting the above content, Kindly check and remove any new line added
Then create an express app that watches the templates directory with Nunjucks, a simple templating language, and parses form data.
Report incorrect code
Copy
Ask AI
import moment from 'moment';
import express from 'express';
import expressNunjucks from 'express-nunjucks';

const app = express();
app.use(express.urlencoded());
app.set('views', `${__dirname}/templates`);

expressNunjucks(app, {
    watch: true,
    noCache: true,
});

After pasting the above content, Kindly check and remove any new line added
​
Collect user input
Fill out the index.html in the templates folder with a simple HTML form, which collects the meeting date, time, customer name, and phone number.
Report incorrect code
Copy
Ask AI
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML//EN">
<html>
    <head>
        <meta charset="utf-8">
        <title>Telnyx Meeting Scheduler</title>
    </head>
    <body>
        <!--If form submission results in error, flash error message -->
        {% if message %}
            <h2>{{ message }}</h2>
        {% endif %}
        <div>
        <h1>Telnyx Meeting Scheduling</h1>
        <form action="/" method="post">
        <div>
            <label for="name">Your name: </label>
            <input type="text" name="customer_name" >
        </div>
        <div>
            <label for="treatment">Meeting name: </label>
            <input type="text" name="meeting_name" >
        </div>
        <div>
            <label for="meeting-date">Appointment date: </label>
            <input type="date" id="meeting_date" name="meeting_date" >
        </div>
        <div>
            <label for="meeting_time">Meeting time: </label>
            <input type="time" id="meeting_time" name="meeting_time" >
        </div>
        <div>
            <label for="phone">Your mobile number: </label>
            <input type="tel" id="phone" name="phone" >
        </div>
        <div>
            <input type="submit" value="Schedule now!">
        </div>
        </form>

        </div>
    </body>
</html>

After pasting the above content, Kindly check and remove any new line added
Then back in index.js serve the index file with a new express route.
Report incorrect code
Copy
Ask AI
app.get('/', (req, res) => {
    res.render('index');
});

After pasting the above content, Kindly check and remove any new line added
​
Implement the SMS notification
Create a function that sends an SMS message parameterized on the destination number and text.
Report incorrect code
Copy
Ask AI
function sendReminder(to, message) {
    telnyx.messages.create({
        to: `${config.COUNTRY_CODE}${to}`,
        from: config.FROM_NUMBER,
        text: message
    });
}

After pasting the above content, Kindly check and remove any new line added
​
Parse user input and schedule the message
Within the POST handler, parse the meeting time and compute how far into the future it is. We’re using the moment Javascript library for this. Note that moment will use the current timezone for both datetime instances.
Report incorrect code
Copy
Ask AI
app.post('/', (req, res) => {
    const meetingDatetime = moment(
        `${req.body.meeting_date} ${req.body.meeting_time}`,
        'YYYY-MM-DD hh:mm');
    const now = moment();

    const delta = moment.duration(meetingDatetime.diff(now));
    // ...
});

After pasting the above content, Kindly check and remove any new line added
If the meeting is sooner than 3 hours, 5 minutes from now, return an error.
Report incorrect code
Copy
Ask AI
if (delta < moment.duration({hours: 3, minutes: 5})) {
    res.render('index', {message: 'Can only schedule meetings at least 3 hours, 5 minutes in the future'});
} else {
    // ...
}

After pasting the above content, Kindly check and remove any new line added
​
Remind the user
If the time is valid, compute when to send the reminder and schedule the function call. Note that we’re using setTimeout here, but a production solution should make use of an asynchronous processing toolkit.
Report incorrect code
Copy
Ask AI
const reminderDatetime = meetingDatetime.subtract(3, 'hours');
const message = `${req.body.customer_name}, you have a meeting scheduled for ${meetingDatetime}`;

setTimeout(() => {
    sendReminder(req.body.phone, message);
}, reminderDatetime.diff(now));

After pasting the above content, Kindly check and remove any new line added
Finally, fill out the success template success.html in the templates folder
Report incorrect code
Copy
Ask AI
<html>
  <head>
    <title>Telnyx Meeting Scheduler</title>
  </head>
<body>
    <p>{{name}}, thanks for booking a meeting for <em>{{meetingName}}</em>!</p>
    <p>You are scheduled for {{meetingDT}} and will receive a courtesy reminder at {{phone}} three hours before your meeting.</p>
  </body>
</html>

After pasting the above content, Kindly check and remove any new line added
Then render the template after the setTimeout statement.
Report incorrect code
Copy
Ask AI
res.render('success', {
    name: req.body.customer_name,
    meetingName: req.body.meeting_name,
    meetingDT: meetingDatetime,
    phone: req.body.phone
});

After pasting the above content, Kindly check and remove any new line added
​
Start the Server
Start the Express app.
Report incorrect code
Copy
Ask AI
const port = 3000;
app.listen(port, () => console.log(`App running on port ${port}`));

After pasting the above content, Kindly check and remove any new line added
​
Final index.js
All together your index.js file should look something like:
Report incorrect code
Copy
Ask AI
import config from'./config.json';
import Telnyx from 'telnyx';
import moment from 'moment';
import express from 'express';
import expressNunjucks from 'express-nunjucks';

const telnyx = new Telnyx("YOUR_API_KEY");

const app = express();
app.use(express.urlencoded());
app.set('views', `${__dirname}/templates`);

expressNunjucks(app, {
    watch: true,
    noCache: true,
});

app.get('/', (req, res) => {
    res.render('index');
});

function sendReminder(to, message) {
    telnyx.messages.create({
        to: `${config.COUNTRY_CODE}${to}`,
        from: config.FROM_NUMBER,
        text: message
    });
}

app.post('/', (req, res) => {
    const meetingDatetime = moment(
        `${req.body.meeting_date} ${req.body.meeting_time}`,
        'YYYY-MM-DD hh:mm');
    const now = moment();

    const delta = moment.duration(meetingDatetime.diff(now));
    if (delta < moment.duration({hours: 3, minutes: 5})) {
        res.render('index', {message: 'Can only schedule meetings at least 3 hours, 5 minutes in the future'});
    } else {
        const reminderDatetime = meetingDatetime.subtract(3, 'hours');
        const message = `${req.body.customer_name}, you have a meeting scheduled for ${meetingDatetime}`;

        setTimeout(() => {
            sendReminder(req.body.phone, message);
        }, reminderDatetime.diff(now));

        res.render('success', {
            name: req.body.customer_name,
            meetingName: req.body.meeting_name,
            meetingDT: meetingDatetime,
            phone: req.body.phone
        });
    }
});

const port = 3000;
app.listen(port, () => console.log(`App running on port ${port}`));


After pasting the above content, Kindly check and remove any new line added
​
Running the project
Launch the index.js file from the command line and open your browser to http://localhost:3000 to set an appointment reminder.
Report incorrect code
Copy
Ask AI
$ node index.js
App running on port 3000

After pasting the above content, Kindly check and remove any new line added
​
Ruby for Appointment Reminders
⏱ 15 minutes build time || Difficulty Level: Intermediate || Github Repo
​
Pre-reqs
Telnyx Portal Account and an API Key
A provisioned SMS enabled number
Messaging Profile.
Familiarity with the messaging quickstart guide.
​
Configuration
Create a config.yml file in your project directory.
Report incorrect code
Copy
Ask AI
$ touch config.yml

After pasting the above content, Kindly check and remove any new line added
Then, use this guide to provision an SMS number and messaging profile, and create an API key. Then add those to the config.yml file, along with your country code.
Report incorrect code
Copy
Ask AI
api_key: "YOUR_API_KEY"
country_code: "+1"
from_number: "YOUR_TELNYX_NUMBER"

After pasting the above content, Kindly check and remove any new line added
​
Server initialization
Create a scheduler.rb file for the application and install the Gems needed to run the application.
Report incorrect code
Copy
Ask AI
$ touch scheduler.rb
$ gem install 'telnyx'
$ gem install 'sinatra'
$ gem install 'rufus-scheduler'
$ gem install 'activesupport'

After pasting the above content, Kindly check and remove any new line added
The first piece of our application loads the config YAML file, configures Telnyx, and starts a Rufus scheduler.
Report incorrect code
Copy
Ask AI
require 'sinatra'
require 'date'
require 'active_support/all'
require 'rufus/scheduler'
require 'telnyx'
require 'yaml'

$config = YAML.load(File.open('config.yml').read)
Telnyx.api_key = $config['api_key']
scheduler = Rufus::Scheduler.new

After pasting the above content, Kindly check and remove any new line added
​
Collect user input
Create a simple HTML form within a views folder named index.erb which collects the meeting date, time, customer name, and phone number.
Report incorrect code
Copy
Ask AI
$ mkdir views
$ touch views/index.erb

After pasting the above content, Kindly check and remove any new line added
The index.erb file should look something like
Report incorrect code
Copy
Ask AI
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML//EN">
<html>
    <head>
        <meta charset="utf-8">
        <title>Telnyx Meeting Scheduler</title>
    </head>
    <body>
        <% if defined?(message) %>
            <h2><%= message %></h2>
        <% end %>
        <div>
        <h1>Telnyx Meeting Scheduling</h1>
        <form action="/" method="post">
        <div>
            <label for="name">Your name: </label>
            <input type="text" name="customer_name" >
        </div>
        <div>
            <label for="treatment">Meeting name: </label>
            <input type="text" name="meeting_name" >
        </div>
        <div>
            <label for="meeting-date">Appointment date: </label>
            <input type="date" id="meeting_date" name="meeting_date" >
        </div>
        <div>
            <label for="meeting_time">Meeting time: </label>
            <input type="time" id="meeting_time" name="meeting_time" >
        </div>
        <div>
            <label for="phone">Your mobile number: </label>
            <input type="tel" id="phone" name="phone" >
        </div>
        <div>
            <input type="submit" value="Schedule now!">
        </div>
        </form>

        </div>
    </body>
</html>

After pasting the above content, Kindly check and remove any new line added
We’ll serve it with Sinatra.
Report incorrect code
Copy
Ask AI
get '/' do
  erb :index
end

After pasting the above content, Kindly check and remove any new line added
​
Implement the SMS notification
Create a simple function that sends an SMS message parameterized on the destination number and text.
Report incorrect code
Copy
Ask AI
def send_reminder(to, message)
    Telnyx::Message.create(
        from: $config['from_number'],
        to: "#{$config['country_code']}#{to}",
        text: message
    )
end

After pasting the above content, Kindly check and remove any new line added
​
Parse user input and schedule the message
Within the POST handler, parse the meeting time, and compute how far into the future it is. Note that we are inserting the current timezone into the user submitted data in order to match with the output of DateTime.now.
Report incorrect code
Copy
Ask AI
post '/' do
    meeting_datetime = DateTime.strptime(
        "#{params[:meeting_date]} #{params[:meeting_time]} #{DateTime.now.strftime('%Z')}",
        '%Y-%m-%d %H:%M %Z')
    current_datetime = DateTime.now

    delta = meeting_datetime.to_time - current_datetime.to_time
    # ...
end

After pasting the above content, Kindly check and remove any new line added
If the meeting is sooner than 3 hours, 5 minutes from now, return an error.
Report incorrect code
Copy
Ask AI
if delta < 11100 # 3 hours, 5 minutes in seconds
    return erb :index, :locals => {:message => 'Can only schedule meetings at least 3 hours 5 minutes in advance'}
else
    # ...
end

After pasting the above content, Kindly check and remove any new line added
​
Remind the User
If the time is valid, compute when to send the reminder and schedule the function call.
Report incorrect code
Copy
Ask AI
meeting_dt_formatted = meeting_datetime.strftime('%Y-%m-%d %l:%M %p')
reminder_time = meeting_datetime.to_time - 3.hours

scheduler.at reminder_time do
    message = "#{params[:customer_name]}, you have a meeting scheduled for #{meeting_dt_formatted}"
    send_reminder params[:phone], message
end

After pasting the above content, Kindly check and remove any new line added
We’ll use a new template confirm the reminder was set.
Report incorrect code
Copy
Ask AI
$ touch views/success.erb

After pasting the above content, Kindly check and remove any new line added
The success.erb file should look something like:
Report incorrect code
Copy
Ask AI
<html>
  <head>
    <title>Telnyx Meeting Scheduler</title>
  </head>
<body>
    <p><%= name %>, thanks for booking a meeting for <em><%= meeting_name %></em>!</p>
    <p>You are scheduled for <%= meeting_dt %> and will receive a courtesy reminder at <%= phone %> three hours before your meeting.</p>
  </body>
</html>

After pasting the above content, Kindly check and remove any new line added
Finally, render the success template`
Report incorrect code
Copy
Ask AI
erb :success, :locals => {
    :name => params[:customer_name],
    :meeting_name => params[:meeting_name],
    :meeting_dt => meeting_dt_formatted,
    :phone => params[:phone]
}

After pasting the above content, Kindly check and remove any new line added
​
Final scheduler.rb
All together, your scheduler.rb should look something like:
Report incorrect code
Copy
Ask AI
require 'sinatra'
require 'date'
require 'active_support/all'
require 'rufus/scheduler'
require 'telnyx'
require 'yaml'

$config = YAML.safe_load(File.open('config.yml').read)
Telnyx.api_key = $config['api_key']
scheduler = Rufus::Scheduler.new

def send_reminder(to, message)
  Telnyx::Message.create(
    from: $config['from_number'],
    to: "#{$config['country_code']}#{to}",
    text: message
  )
end

get '/' do
  erb :index
end

post '/' do
  meeting_datetime = DateTime.strptime(
    "#{params[:meeting_date]} #{params[:meeting_time]} #{DateTime.now.strftime('%Z')}",
    '%Y-%m-%d %H:%M %Z'
  )
  current_datetime = DateTime.now

  delta = meeting_datetime.to_time - current_datetime.to_time
  if delta < 11_100 # 3 hours, 5 minutes in seconds
    return erb :index, locals: { message: 'Can only schedule meetings at least 3 hours 5 minutes in advance' }
  else
    meeting_dt_formatted = meeting_datetime.strftime('%Y-%m-%d %l:%M %p')
    reminder_time = meeting_datetime.to_time - 3.hours

    scheduler.at reminder_time do
      message = "#{params[:customer_name]}, you have a meeting scheduled for #{meeting_dt_formatted}"
      send_reminder params[:phone], message
    end

    erb :success, locals: {
      name: params[:customer_name],
      meeting_name: params[:meeting_name],
      meeting_dt: meeting_dt_formatted,
      phone: params[:phone]
    }
  end
end

After pasting the above content, Kindly check and remove any new line added
​
Running the project
Launch the scheduler.rb file from the command line and open your browser to http://localhost:4567 to set an appointment reminder.
Report incorrect code
Copy
Ask AI
$  ruby scheduler.rb
[2020-09-24 13:16:39] INFO  WEBrick 1.6.0
[2020-09-24 13:16:39] INFO  ruby 2.7.1 (2020-03-31) [x86_64-darwin19]
== Sinatra (v2.1.0) has taken the stage on 4567 for development with backup from WEBrick
[2020-09-24 13:16:39] INFO  WEBrick::HTTPServer#start: pid=75889 port=4567

After pasting the above content, Kindly check and remove any new line added

Was this page helpful?

Yes
No
Two-Factor Authentication (2FA)
Hosted SMS
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Hosted Sms


**URL:** https://developers.telnyx.com/docs/messaging/messages/hosted-sms

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Compliance & Verification
Use Cases & Integrations
Two-Factor Authentication (2FA)
Appointment Reminders
Hosted SMS
Receive and Respond to SMS/MMS
Twexit API
Zapier Integration
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Use Cases & Integrations
Hosted SMS
Copy page

Bring your own number onto the Telnyx platform for SMS and MMS. Start building on Telnyx today.

| cURL | .NET | Portal |
Overview
Hosted SMS allows you to bring your own number onto the Telnyx platform for SMS and MMS use only. The number remains with your current voice provider for voice services, but routes all inbound and outbound SMS and MMS messages through the Telnyx network.
This is especially useful for landline numbers that normally would not have messaging capabilities. Telnyx can supplement the voice capabilities of that number by adding messaging functionality without affecting voice services.
Hosted numbers must go through a verification process to ensure that you are the authorized user for that number and have the authority to make changes to the number’s messaging routing.
To complete the verification, we need two documents: a signed Letter of Authorization (LOA) and the most recent bill from your current voice provider clearly showing your information and the number to be hosted with Telnyx.
Hosting numbers with Telnyx is not the same as porting a number, but they both have a similar process.
Not all numbers are capable of being Hosted with Telnyx.
​
cURL
​
Setting up your first Hosted SMS number
​
Check phone number eligibility for hosted messaging
Before creating a hosted SMS order, you can check if your phone numbers are eligible for hosted messaging.
Report incorrect code
Copy
Ask AI
curl -X POST \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --data '{"phone_numbers": ["+13125550001", "+553125550002"]}' \
  "https://api.telnyx.com/v2/messaging_hosted_number_orders/eligibility_numbers_check"

​
Example response
Report incorrect code
Copy
Ask AI
{
  "phone_numbers": [
    {
      "detail": "Phone number is eligible for hosted messaging",
      "phone_number": "+13125550001",
      "eligible": true,
      "eligible_status": "eligible"
    },
    {
      "detail": "Phone number is not a valid US number",
      "phone_number": "+553125550002",
      "eligible": false,
      "eligible_status": "number_is_not_a_us_number"
    }
  ]
}

The eligibility check returns a status for each phone number. Only numbers with "eligible": true and "eligible_status": "eligible" can be used for hosted messaging. Possible status values and descriptions are included in the eligibility check table.
​
Table of eligible statuses for Hosted SMS Order
eligible_status	description
billing_account_check_failed	Billing check failed. Try again or check billing.
billing_account_is_abolished	Account is abolished in billing.
eligible	Number is eligible for creating a Hosted SMS order.
number_can_not_be_active_in_your_account	Active numbers in your account are not allowed.
number_can_not_be_in_telnyx	Number already exists on the Telnyx platform and cannot be hosted.
number_can_not_be_repeated	Duplicate numbers are not allowed.
number_can_not_be_wireless	Wireless numbers are not allowed.
number_can_not_hosted_with_a_telnyx_subscriber	Number is already hosted with a Telnyx subscriber and cannot be hosted again.
number_is_not_a_us_number	Numbers outside the United States are not allowed.
number_is_not_a_valid_routing_number	Number is not a valid local routing number.
number_is_not_in_e164_format	Number must be in E.164 format.
numbers_can_not_be_validated	Numbers could not be validated. Try again or contact support.
​
Create a hosted SMS order
This creates a new hosted sms number order:
Report incorrect code
Copy
Ask AI

curl -X POST \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  -d '{"messaging_profile_id":"16fd2706-8baf-433b-82eb-8c7fada847da", "phone_numbers":["+13125550001"]}' \
  "https://api.telnyx.com/v2/messaging_hosted_number_orders"

​
Example response
Report incorrect code
Copy
Ask AI
{
    "record_type": "messaging_hosted_number_order",
    "id": "7d9b9fdc-d073-4c3d-9c74-bf0622b3830c",
    "messaging_profile_id": "16fd2706-8baf-433b-82eb-8c7fada847da",
    "status": "pending",
    "phone_numbers": [
        {
            "record_type": "messaging_hosted_number",
            "id": "bda67701-2c08-47ba-8242-f6e6b235cca8",
            "phone_number": "+13125550001",
            "status": "pending"
        }
    ]
}

The numbers in this order are created in a pending status. They will remain that way until you validate the phone numbers and submit the necessary authorization documents. Once the Telnyx team reviews and approves your order, the status will change to successful.
If there is a problem with the order request, the error statuses are the same as those in the eligibility check table. You can check the eligible_status field in the response to see the reason for the error.
​
Validate phone numbers
This is a prerequisite for Uploading authorization documents.
You need to validate the phone numbers in your order. This is done by sending two requests (API references: 1, 2), one to create the verification codes and the other to validate the verification codes.
​
1. Create the verification codes
The first request generates the verification codes for the phone numbers in your order. The verification codes are sent to the respective phone numbers.
Request:
Report incorrect code
Copy
Ask AI
curl --request POST \
  --url https://api.telnyx.com/v2/messaging_hosted_number_orders/5fcf6884-6c1b-45e4-89b8-5fba9e6c60be/verification_codes \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --header "content-type: application/json" \
  --data '{
  "verification_method": "sms",
  "phone_numbers": ["+15005550108", "+15005550921"]
}'

You will receive a 201 without content if everything is successful and the verification codes are sent to the phone numbers. In this example, SMS codes will be sent to +15005550108 and +15005550921.
​
2. Validate the verification codes
The second request validates the verification codes for the phone numbers in your order. The verification codes must be created in step 1. They will be sent to the phone numbers using the specified verification method.
Request:
Report incorrect code
Copy
Ask AI
curl --request POST \
  --url https://api.telnyx.com/v2/messaging_hosted_number_orders/5fcf6884-6c1b-45e4-89b8-5fba9e6c60be/validation_codes \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --header "content-type: application/json" \
  --data '{
  "verification_codes": [
    {"phone_number": "+15005550108", "code": "87643"}, {"phone_number": "+15005550921", "code": "98276"}
  ]
}'

Response:
Report incorrect code
Copy
Ask AI
{
  "phone_numbers": [
    {
      "phone_number": "+15005550108",
      "status": "verified"
    },
    {
      "phone_number": "+15005550921",
      "status": "verified"
    }
  ],
  "order_id": "5fcf6884-6c1b-45e4-89b8-5fba9e6c60be"
}

You can receive either verified or rejected status for each phone number. If you receive a rejected status, please check the phone number and the verification code. If everything is correct, the status of your phone numbers will be ownership_successful.
​
Uploading authorization documents
Validate phone numbers is a prerequisite for this.
You need to upload two documents in PDF format:
Letter of Authorization
The most recent bill from your voice provider
Report incorrect code
Copy
Ask AI
curl -X POST \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --form "loa=@/path/to/loa" \
  --form "bill=@/path/to/bill" \
  "https://api.telnyx.com/v2/messaging_hosted_number_orders/{id}/actions/file_upload"

​
Example response
Report incorrect code
Copy
Ask AI
{
    "record_type": "messaging_hosted_number_order",
    "id": "7d9b9fdc-d073-4c3d-9c74-bf0622b3830c",
    "messaging_profile_id": "16fd2706-8baf-433b-82eb-8c7fada847da",
    "status": "pending"
}

Now that your order request has all the information needed, our team will review and activate the number(s) for you on the Telnyx platform.
Right now, these numbers will not be visible in the Telnyx Portal. They will however be visible when using the Telnyx API.
​
Notifications
This section describes how the notifications are handled for Hosted SMS Orders.
All notifications are sent to the Webhook URLs configured in your Messaging Profile.
Any change in the status of your Hosted SMS Order will trigger a notification. These changes include:
Order created
Order deleted
Phone number ownership verified
Phone number deleted
LOA uploaded
Order activated successfully
Order activation failed: failed statuses are described in order and numbers failed statuses
Add user configured notifications for email and portal to receive email and portal notifications.
​
Webhooks notifications
The JSON structure received in the webhooks is the following:
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "messaging_hosted_numbers_orders.created",
    "id": "ce7a1221-d9dd-4015-bca0-31856a7a3844",
    "occurred_at": "2025-09-25T01:55:17.373+00:00",
    "payload": {
      "event_type": "created",
      "numbers": [
        {
          "status": "pending",
          "value": "+15035550543"
        },
        {
          "status": "pending",
          "value": "+15035550844"
        }
      ],
      "order_id": "22afcb61-6e9f-449d-a19f-38d67816f3e8",
      "order_status": "pending",
      "profile_id": "6a3ec0cb-95bb-485b-a185-7c35937b7eac",
      "user_id": "37fe3acf-411a-488e-a919-91f726f7726b"
    },
    "record_type": "event"
  },
  "meta": {
    "attempt": 1,
    "delivered_to": "http://webhook-url-example.com"
  }
}

The simplified JSONs for the order and its numbers statuses are:
Created order: order is created and pending, numbers are in pending status.
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "messaging_hosted_numbers_orders.created",
    "payload": {
      "order_status": "pending",
      "numbers": [{"status": "pending"}]
    }
  }
}

Deleted order: order and its numbers are deleted.
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "messaging_hosted_numbers_orders.deleted",
    "payload": {
      "order_status": "deleted",
      "numbers": [{"status": "deleted"}]
    }
  }
}

Ownership verified: the phone number ownership is verified, order is still pending, waiting for LOA and bill upload.
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "messaging_hosted_numbers_orders.updated",
    "payload": {
      "order_status": "pending",
      "numbers": [{"status": "ownership_successful"}]
    }
  }
}

Deleted number: deletes a single number, order is pending.
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "messaging_hosted_numbers_orders.updated",
    "payload": {
      "order_status": "pending",
      "numbers": [{"status": "deleted"}]
    }
  }
}

LOA uploaded: this case does not update any number status.
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "messaging_hosted_numbers_orders.updated",
    "payload": {"order_status": "loa_file_successful"}
  }
}

Activated order: order is activated and successful, numbers are in successful status.
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "messaging_hosted_numbers_orders.updated",
    "payload": {
      "order_status": "successful",
      "numbers": [{"status": "successful"}]
    }
  }
}

Activation failed: order and its numbers failed activation.
Report incorrect code
Copy
Ask AI
{
  "data": {
    "event_type": "messaging_hosted_numbers_orders.updated",
    "payload": {
      "order_status": "failed",
      "numbers": [{"status": "failed"}]
    }
  }
}

​
User configured notifications for Email and Portal
In the Advanced Features - Notifications page you can configure email and portal notifications for Hosted SMS Orders status changes.
Create a New Notification Profile with a name using the “New Profile” button.
Create a New Channel with Email: click the “New Channel” button, select the above profile, select email, and enter your notification email address.
Create Notification Settings: click the “New Settings” button, select “Messaging Hosted SMS Activity”, and select the above profile.
Future notifications will be sent to your email address and will be visible in the portal bell icon. The list of notifications is in the Notifications section.
​
Example of email and portal notification for Hosted SMS Order deleted (only text)
Report incorrect code
Copy
Ask AI
Hosted SMS Order deleted notification

A deleted event for Hosted SMS Order has been detected on your Telnyx account.

ID: 18d630df-728e-4a5e-a656-9a81a8237620
Profile ID: 10f72731-783d-4218-80f5-d61dafcd6a36
Order status: deleted
Numbers' status change (if any):
- +16004453991: deleted

You can view and manage your Hosted SMS Orders in the Telnyx Portal.
If you did not expect this change or have any questions, please contact our support team.

​
Order and Numbers activation failed statuses
You can have failed statuses for both the order and its numbers. The possible failed statuses are:
Order Status	Description
carrier_rejected	Losing carrier rejected a number porting request.
failed	Order has been closed. Contact support for more information.
ineligible_carrier	A number from the losing carrier cannot be ported to Telnyx.
Number Status	Description
failed	Number has been closed. Contact support for more information.
failed_carrier_rejected	Losing carrier rejected a number porting request.
failed_ineligible_carrier	Number from the losing carrier cannot be ported to Telnyx.
failed_number_already_hosted	Number is already in Telnyx and cannot be hosted.
failed_number_not_found	Number is not in Telnyx and cannot be hosted.
failed_timeout	Timed out while activating the number.
​
.NET
​
Setting up your first Hosted SMS number
​
Create a hosted SMS order
This creates a new hosted sms number order:
Report incorrect code
Copy
Ask AI

curl -X POST \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  -d '{"messaging_profile_id":"16fd2706-8baf-433b-82eb-8c7fada847da", "phone_numbers":["+13125550001"]}' \
  "https://api.telnyx.com/v2/messaging_hosted_number_orders"

​
Example response
Report incorrect code
Copy
Ask AI
{
    "record_type": "messaging_hosted_number_order",
    "id": "7d9b9fdc-d073-4c3d-9c74-bf0622b3830c",
    "messaging_profile_id": "16fd2706-8baf-433b-82eb-8c7fada847da",
    "status": "pending",
    "phone_numbers": [
        {
            "record_type": "messaging_hosted_number",
            "id": "bda67701-2c08-47ba-8242-f6e6b235cca8",
            "phone_number": "+13125550001",
            "status": "pending"
        }
    ]
}

The numbers in this order are created in a pending status. They will remain that way until you submit the necessary authorization documents. Once the Telnyx team reviews your order and approves it, the status will change to successful.
​
Uploading authorization documents
You need to upload two documents in PDF format:
Letter of Authorization
The most recent bill from your voice provider
Report incorrect code
Copy
Ask AI
curl -X POST \
  --header "Accept: application/json" \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --form "loa=@/path/to/loa" \
  --form "bill=@/path/to/bill" \
  "https://api.telnyx.com/v2/messaging_hosted_number_orders/{id}/actions/file_upload"

​
Example response
Report incorrect code
Copy
Ask AI
{
    "record_type": "messaging_hosted_number_order",
    "id": "7d9b9fdc-d073-4c3d-9c74-bf0622b3830c",
    "messaging_profile_id": "16fd2706-8baf-433b-82eb-8c7fada847da",
    "status": "pending"
}

Now that your order request has all the information needed, our team will review and activate the number(s) for you on the Telnyx platform.
Right now, these numbers will not be visible in the Telnyx Portal. They will however be visible when using the Telnyx API.
​
Portal
​
Setting up your first Hosted SMS Number
​
Create a hosted SMS order
On the Mission Control Portal, click on to Numbers.
Navigate to Hosted SMS
Click on Add New Order
Enter the number(s) you wish to host with Telnyx in +E.164 format
The system will automatically check the eligibility of the entered phone numbers. Only eligible numbers can be used for hosted messaging.
Choose the Message Profile you’d like to add to the number(s)
Click on Create Order. You will automatically route to the next page where you need to upload your Authorization Documentation.
Upload your LOA
Upload your Bill
Click on Submit
Now that your order request has all the information needed, our team will review and activate the number(s) for you on the Telnyx platform.
Right now, these numbers will not be visible in the Telnyx Portal. They will however be visible when using the Telnyx API.

Was this page helpful?

Yes
No
Appointment Reminders
Receive and Respond to SMS/MMS
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Receive Message


**URL:** https://developers.telnyx.com/docs/messaging/messages/receive-messages/index

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
404
Page Not Found
We couldn't find the page. Maybe you were looking for one of these pages below?
Receiving SMS and MMS
Flutter WebRTC SDK Message
WebRTC Android ReceivedMessageBody
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Twexit


**URL:** https://developers.telnyx.com/docs/messaging/messages/twexit

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Compliance & Verification
Use Cases & Integrations
Two-Factor Authentication (2FA)
Appointment Reminders
Hosted SMS
Receive and Respond to SMS/MMS
Twexit API
Zapier Integration
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Use Cases & Integrations
Twexit
Copy page

send messages and receive message notifications with minimal changes to existing Twilio messaging code

| cURL | Python | Node | Ruby |
The Twexit API allows users to send messages and receive message notifications with minimal changes to existing Twilio messaging code. This makes it easier than ever to leave Twilio and begin utilizing Telnyx to send and receive text messages.
​
Mission control portal setup
To use the Twexit API, please ensure the following:
You have active numbers on the portal.
You have created a Messaging Profile to send and receive messages.
Once you have your profile created, select Twexit API under API Version in the Messaging Profile settings.
You should now receive inbound messages and webhooks in Twilio’s format.
​
Finding the organization id
To find your organization id, run the following curl command:
Don’t forget to update YOUR_API_KEY here.
Report incorrect code
Copy
Ask AI
curl --request GET \
  --url https://api.telnyx.com/v2/whoami \
  --header 'Authorization: Bearer YOUR_API_KEY'

After pasting the above content, Kindly check and remove any new line added
This endpoint will respond with
Report incorrect code
Copy
Ask AI
{
  "data": {
    "organization_id": "ORGANIZATION_ID",
    "user_id": "USER_ID"
  }
}

After pasting the above content, Kindly check and remove any new line added
​
cURL
​
Sending a message
Fill in the organization id and the auth v2 api key below:
Report incorrect code
Copy
Ask AI
curl -u "\${organization_id}":"\${auth_v2_api_key}" \\
--data-urlencode 'From=+13125550000' \\
--data-urlencode 'To=+13125550001' \\
--data-urlencode 'Body=Hello, World!' \\
https://api.telnyx.com/2010-04-01/Accounts/{organization_id}/Messages.json

After pasting the above content, Kindly check and remove any new line added
The response will contain:
Report incorrect code
Copy
Ask AI
{
  "sid": "40317159-f30d-4940-b751-9a6e81727249",
  "date_created": "Wed, 08 Apr 2020 13:20:33 +0000",
  "date_updated": "Wed, 08 Apr 2020 13:20:33 +0000",
  "date_sent": null,
  "account_sid": "${account_id}",
  "to": "+13125550000",
  "from": "+13125550001",
  "messaging_service_sid": "40017155-44c7-4d18-8fa5-332c1a776db5",
  "body": "Hello, World!",
  "status": "queued",
  "num_segments": "1",
  "num_media": "0",
  "direction": "outbound-api",
  "api_version": "2010-04-01",
  "price": null,
  "price_unit": "USD",
  "error_code": null,
  "error_message": null,
  "uri": "/2010-04-01/Accounts/{organization_id}/Messages/40317159-f30d-4940-b751-9a6e81727249.json",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/{organization_id}/Messages/40317159-f30d-4940-b751-9a6e81727249/Media.json"
  }
}

After pasting the above content, Kindly check and remove any new line added
​
Python
​
Sending a message
Fill in the organization id and the auth v2 api key below:
Report incorrect code
Copy
Ask AI
import requests
from requests.auth import HTTPBasicAUth
url = f"https://api.telnyx.com/2010-04-01/Accounts/{organization_id}/Messages.json"
auth = HTTPBasicAuth(organization_id, auth_v2_api_key)
data = {
  "From": "+13125550000", # Your Telnyx number
  "To": "+13125550001",
  "Body": "Hello, World!"
}
response = requests.request('POST', url, auth=auth, data=data)
print(response.text)

After pasting the above content, Kindly check and remove any new line added
The response will contain:
Report incorrect code
Copy
Ask AI
{
  "sid": "40317159-f30d-4940-b751-9a6e81727249",
  "date_created": "Wed, 08 Apr 2020 13:20:33 +0000",
  "date_updated": "Wed, 08 Apr 2020 13:20:33 +0000",
  "date_sent": null,
  "account_sid": "${account_id}",
  "to": "+13125550000",
  "from": "+13125550001",
  "messaging_service_sid": "40017155-44c7-4d18-8fa5-332c1a776db5",
  "body": "Hello, World!",
  "status": "queued",
  "num_segments": "1",
  "num_media": "0",
  "direction": "outbound-api",
  "api_version": "2010-04-01",
  "price": null,
  "price_unit": "USD",
  "error_code": null,
  "error_message": null,
  "uri": "/2010-04-01/Accounts/{organization_id}/Messages/40317159-f30d-4940-b751-9a6e81727249.json",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/{organization_id}/Messages/40317159-f30d-4940-b751-9a6e81727249/Media.json"
  }
}

After pasting the above content, Kindly check and remove any new line added
​
Node
​
Sending a message
Fill in the organization id and the auth v2 api key below:
Report incorrect code
Copy
Ask AI
// https://github.com/visionmedia/superagent#install
import superagent from 'superagent';

superagent
  .auth(organization_id, auth_v2_api_key)
  .post(`https://api.telnyx.com/2010-04-01/Accounts/${organization_id}/Messages.json`)
  .send({
    From: '+13125550000', // Your Telnyx number
    To: '+13125550001',
    Body: "Hello, World!"
  })
  .then((response) => {
    console.log(response.body);
  });

After pasting the above content, Kindly check and remove any new line added
The response will contain:
Report incorrect code
Copy
Ask AI
{
  "sid": "40317159-f30d-4940-b751-9a6e81727249",
  "date_created": "Wed, 08 Apr 2020 13:20:33 +0000",
  "date_updated": "Wed, 08 Apr 2020 13:20:33 +0000",
  "date_sent": null,
  "account_sid": "${account_id}",
  "to": "+13125550000",
  "from": "+13125550001",
  "messaging_service_sid": "40017155-44c7-4d18-8fa5-332c1a776db5",
  "body": "Hello, World!",
  "status": "queued",
  "num_segments": "1",
  "num_media": "0",
  "direction": "outbound-api",
  "api_version": "2010-04-01",
  "price": null,
  "price_unit": "USD",
  "error_code": null,
  "error_message": null,
  "uri": "/2010-04-01/Accounts/{organization_id}/Messages/40317159-f30d-4940-b751-9a6e81727249.json",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/{organization_id}/Messages/40317159-f30d-4940-b751-9a6e81727249/Media.json"
  }
}

After pasting the above content, Kindly check and remove any new line added
​
Ruby
​
Sending a message
Fill in the organization id and the auth v2 api key below:
Report incorrect code
Copy
Ask AI
require "net/http"
require "uri"
uri = URI("https://api.telnyx.com/2010-04-01/Accounts/#{organization_id}/Messages.json")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
request = Net::HTTP::Post.new(uri)
request.basic_auth organization_id, auth_v2_api_key
body = {
  From: "+13125550000", # Your Telnyx number
  To: "+13125550001",
  Body: "Hello, World!"
}
request.body = body.to_json
response = http.request(request)
puts response.read_body

After pasting the above content, Kindly check and remove any new line added
The response will contain:
Report incorrect code
Copy
Ask AI
{
  "sid": "40317159-f30d-4940-b751-9a6e81727249",
  "date_created": "Wed, 08 Apr 2020 13:20:33 +0000",
  "date_updated": "Wed, 08 Apr 2020 13:20:33 +0000",
  "date_sent": null,
  "account_sid": "${account_id}",
  "to": "+13125550000",
  "from": "+13125550001",
  "messaging_service_sid": "40017155-44c7-4d18-8fa5-332c1a776db5",
  "body": "Hello, World!",
  "status": "queued",
  "num_segments": "1",
  "num_media": "0",
  "direction": "outbound-api",
  "api_version": "2010-04-01",
  "price": null,
  "price_unit": "USD",
  "error_code": null,
  "error_message": null,
  "uri": "/2010-04-01/Accounts/{organization_id}/Messages/40317159-f30d-4940-b751-9a6e81727249.json",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/{organization_id}/Messages/40317159-f30d-4940-b751-9a6e81727249/Media.json"
  }
}

After pasting the above content, Kindly check and remove any new line added

Was this page helpful?

Yes
No
Receive and Respond to SMS/MMS
Zapier Integration
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Messages - Zapier Integration


**URL:** https://developers.telnyx.com/docs/messaging/messages/zapier-integration

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
Introduction
Account setup
Getting Started
Account Types & Capabilities
Account Management
AI
Quickstarts
Core features
Tutorials
Integrations
Advanced use cases
OpenAI API Migration Guide
Real-time communications
Getting Started
Messaging
SMS/MMS Fundamentals
Advanced Features
Compliance & Verification
Use Cases & Integrations
Two-Factor Authentication (2FA)
Appointment Reminders
Hosted SMS
Receive and Respond to SMS/MMS
Twexit API
Zapier Integration
Management & Analytics
Voice
SIP Trunking
STIR/SHAKEN
WebRTC
Numbers
Video
Identity
Programmable Fax
IoT and networking
IoT SIM Cards
Private Networks
Cloud storage
Getting Started
Compatibility & Migration
SDK Examples
Advanced Features
Management & Operations
Reporting
Usage Reports
Glossary
AI glossary
APIs glossary
Telecom glossary
Release notes
Real-time communications
Messaging
Use Cases & Integrations
Zapier Integration
Copy page

Telnyx’s Zapier tutorial walks you through how to set up Zapier for weather updates for a given location, to forward text messages from one phone number to another and how to send an auto response message

| Weather Updates | SMS Forwarding | Auto Response |
​
Weather Update
​
Setup Weather Forecast Messages
⏱ 15 minutes build time || Difficulty Level: Beginner
Please note that this integration is still in Beta. Settings and functionality are subject to change as we work to improve the integration and onboarding process.
In this guide, you’ll learn how to get started using Telnyx Messaging with Zapier.
Zapier is a service that helps automate work. You can set up certain triggers that launch preset actions. We’ll walk through a simple setup process for both receiving and sending a message. To follow along, make sure you have signed up for a Zapier account (they’re free!). Make sure you also have a Telnyx account and a messaging-enabled phone number. If you don’t, take a few minutes to follow the Portal Setup guide to get started.
In this tutorial we’ll set up a Zapier Zap that automatically sends the weather forecast to your phone each morning via an SMS message.
​
Get set up with the Telnyx integration on Zapier
Ensure you’ve signed up for a Zapier account and that you have at least one phone number that is messaging enabled before proceeding.
Follow this link to find the Telnyx Zapier integration and click the connect button to get started.
​
Make your forecast Zap
Make sure you’re at the Zapier homepage. In the top right corner, click the Make a Zap! button.
You should now be in Zapier’s editing tool. From here, you can choose a trigger.
A trigger is an event that, when activated, will allow your Zap to move onto the action step.
For this example, we’ll be choosing the “Weather by Zapier” trigger. Find it in the list of triggers and then click on it. If it’s not already in your list of triggers, you can search for it.
Click on the “Choose Trigger Event” dropdown and select “Today’s Forecast”.
Click Continue.
Enter Latitude and Longitude to make sure you’re getting the right weather forecast.
If you don’t know them, you can look them up by clicking the links below the Latitude and Longitude fields. This will redirect you to a separate website where you can look up your coordinates.
Click Continue.
Click Find Forecast to test your connection. If successful, you’ll move on to the Action step (“Do This …”).
For the Action, we want Zapier to send us a text message with the weather forecast information from the trigger. Search for Telnyx in the app search field and then click on the Telnyx app icon to select it as the action.
Click Send SMS under the “Choose Action Event” dropdown.
Click Continue.
​
Integrate your forecast Zap with Telnyx
Click Sign in to Telnyx.
If you don’t see your account, click Add Account to continue.
In the pop-up window, enter your v2 API Key acquired from your Mission Control Portal .
Click Yes, Continue.
Return to the action step in your Zapier Window and click Continue.
For the next step, Customize SMS, enter the Telnyx number you’d like to send from in the “Source Number” field.
The “send” number must be a messaging-enabled number associated with the messaging profile you’ve entered. You can find this in the My Numbers section of the Portal.
Enter your personal phone number in the “Destination Number” field.
For the Message Content, click on the “Insert a Field” dropdown on the right-hand side of the text field to add real weather information we pulled from the trigger. Add the weather updates you’d like to receive in the morning.
Click Continue.
​
Test your forecast Zap
Review the information on the next page. When you’re ready, click Send Test to send today’s weather summary straight to your phone.
If your test was unsuccessful (returning an error message), return to the previous step and ensure that your Source and Destination numbers follow the proper number formats (including adding +1 before the number).
If your test was successful, click Done Editing.
Turn on your Zap.
That’s it. You’ve just automated your first task with Zapier and Telnyx.
​
SMS forwarding
⏱ 15 minutes build time || Difficulty Level: Beginner
Please note that this integration is still in Beta. Settings and functionality are subject to change as we work to improve the integration and onboarding process.
In this guide, you’ll learn how to get started using Telnyx Messaging with Zapier.
Zapier is a service that helps automate work. You can set up certain triggers that launch preset actions. We’ll walk through a simple setup process for both receiving and sending a message. To follow along, make sure you have signed up for a Zapier account (they’re free!). Make sure you also have a Telnyx account and a messaging-enabled phone number. If you don’t, take a few minutes to follow the Portal Setup guide to get started.
In this tutorial, we’ll set up a Zap to forward all inbound messages received by your Telnyx number to your personal number. This can be helpful if you want to see in real time what people are texting your Telnyx number.
​
Step 1: Get set up with the Telnyx Integration on Zapier
Ensure you’ve signed up for a Zapier account and that you have at least one phone number that is messaging enabled before proceeding.
Follow this link to find the Telnyx Zapier integration and click the connect button to get started.
​
Step 2: Make your first Zap
Let’s go ahead and Make a Zap!
Make sure you’re at the Zapier homepage. In the top right corner, click the Make a Zap! button.
Choose Telnyx as the trigger App. If it’s not already in your list of triggers, you can search for it.
Click on the “Choose Trigger Event” dropdown and select “Receive a Message”.
Click Continue.
In the “Choose Account” dropdown menu, select the account you’d like to use for receiving messages.
If you don’t see your account, follow the instructions in Example 1 (steps 12-14).
All numbers associated with the messaging profile will be used for this Zap. For this reason, we highly recommend only attaching a single number to a messaging profile you use for Zaps.
Click Continue.
Click Find Message to test your connection and pull in a sample inbound message webhook to set up the action stage. If successful, you’ll move on to the Action step (“Do This …”).
In the “Do This …” step, click on the Telnyx app icon to select it as the action. If it’s not already in your list of actions, you can search for it.
Click Send SMS under the “Choose Action Event” dropdown.
Click Continue.
​
Step 3: Integrate your Zap with Telnyx
Click Sign in to Telnyx.
If you don’t see your account, click Add Account to continue.
In the pop-up window, enter your v2 API Key acquired from your Mission Control Portal .
Click Yes, Continue.
Return to the action step in your Zapier Window and click Continue.
For the next step, Customize SMS, enter the Telnyx number you’d like to send from in the “Source Number” field.
The “send” number must be a messaging-enabled number associated with the messaging profile you’ve entered. You can find this in the My Numbers section of the Portal.
Enter your personal phone number in the “Destination Number” field.
Fill in the “Message Content” with details from the message that triggered this Zap.
Something like this:
Report incorrect code
Copy
Ask AI
FWD FROM: From-Phone-Number
BODY: Text

After pasting the above content, Kindly check and remove any new line added
“From-Phone-Number” and “Text” are dynamic fields that Zapier can populate from the trigger. Make sure you use the dropdown on the right-hand side of the “Message Content” text field to insert those into the message body.
Click Continue.
​
Step 4: Test your Zap
Click Send Test. You should see the following text come in:
Report incorrect code
Copy
Ask AI
FWD FROM: +16365553226
BODY: Sample Text Sent From Zapier!

After pasting the above content, Kindly check and remove any new line added
If your test was unsuccessful (returning an error message), return to the previous step and ensure that your Source and Destination numbers follow the example number formats (including adding +1 before the number).
If your test was successful, click Done Editing.
Turn on your Zap.
You’ve now set up a quick way to forward inbound messages from your Telnyx number to your real number.
​
Auto response
⏱ 15 minutes build time || Difficulty Level: Beginner
Please note that this integration is still in Beta. Settings and functionality are subject to change as we work to improve the integration and onboarding process.
In this guide, you’ll learn how to get started using Telnyx Messaging with Zapier.
Zapier is a service that helps automate work. You can set up certain triggers that launch preset actions. We’ll walk through a simple setup process for both receiving and sending a message. To follow along, make sure you have signed up for a Zapier account (they’re free!). Make sure you also have a Telnyx account and a messaging-enabled phone number. If you don’t, take a few minutes to follow the Mission Control Portal Setup guide to get started.
In this tutorial, we’ll setup a very basic auto-reply for incoming messages to your Telnyx phone number.
​
Step 1: Get set up with the Telnyx integration on Zapier
Ensure you’ve signed up for a Zapier account and that you have at least one Telnyx phone number that is messaging enabled before proceeding.
Follow this link to find the Telnyx Zapier integration and click the connect button to get started.
​
Step 2: Make your first Zap
Let’s go ahead and Make a Zap!:
Make sure you’re at the Zapier homepage. In the top right corner, click the Make a Zap! button.
Choose Telnyx as the trigger App. If it’s not already in your list of triggers, you can search for it.
Click on the “Choose Trigger Event” dropdown and select “Receive a Message.”
Click Continue.
In the “Choose Account” dropdown menu, select the account you’d like to use for receiving messages.
All numbers associated with the messaging profile will be used for this Zap. For this reason, we highly recommend only attaching a single number to a messaging profile you use for Zaps.
Click Continue.
Click Find Message to test your connection and pull in a sample inbound message webhook to set up the action stage. If successful, you’ll move on to the Action step (“Do This …”).
In the “Do This …” step, click on the Telnyx app icon to select it as the action. If it’s not already in your list of actions, you can search for it.
Click Send SMS under the “Choose Action Event” dropdown.
Click Continue.
​
Step 3: Integrate your Zap with Telnyx
Click on the dropdown menu under “Choose Account” to select the Telnyx account you’d like to use for sending the message.
If you don’t see your account, click Add Account to continue.
In the pop-up window, enter your v2 API Key acquired from your Mission Control Portal .
Click Yes, Continue.
Now we’ll use information from the incoming message again to populate some of these fields. For this step, Customize SMS, enter the Telnyx number you’d like to send from in the “Source Number” field.
The “send” number must be a messaging-enabled number associated with the messaging profile you’ve entered. You can find this in the My Numbers section of the Portal.
Under “Destination Number,” click the dropdown and click on From Phone Number. This makes the source number the receiver of the message we’re going to send now.
Under “Message Content,” enter the automated message you’d like to send out:
Report incorrect code
Copy
Ask AI
Hi there, this is an automated reply!

After pasting the above content, Kindly check and remove any new line added
Click Continue.
​
Step 4: Test your Zap
Click Send Test.
If your test was unsuccessful (returning an error message), return to the previous step and ensure that your Source and Destination numbers follow the example number formats (including adding +1 before the number).
Turn on your Zap.
Go ahead and send a message to the Telnyx number you entered in the Source Number Field. You should see your reply come through automatically.
That’s it. You’ve set up a quick way to auto-reply to messages sent to your Telnyx number.

Was this page helpful?

Yes
No
Twexit API
Spend Limits
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Send A Message


**URL:** https://developers.telnyx.com/api-reference/messages/send-a-message

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
API overview
AI
Assistants
Audio
Chat
Clusters
Conversations
Embeddings
Fine Tuning
Integrations
MCP Servers
Callbacks
Real-Time Communications
Programmable voice
TeXML
Outbound voice profiles
SIP connections
Credentials
Verified numbers
Dialogflow integration
External connects
Call recordings
Media storage
Messaging
Messages
POST
Send a message
POST
Send a group MMS message
POST
Send a long code message
POST
Send a message using number pool
POST
Schedule a message
POST
Send a short code message
GET
Retrieve a message
DEL
Cancel a scheduled message
RCS messaging
Messaging Hosted Number
Number Configurations
Advanced OptIn/OptOut
Messaging Profiles
Messaging URL Domains
Mobile Number Configurations
Phone Number Configurations
Short Codes
Callbacks
Toll-free verification
10DLC
Video
Fax
Push credentials
Numbers & Identity
Phone numbers
Voicemail
Voice Channels
Bundles
Number portout
Phone number porting
Porting order
Documents
Number lookup
Verify
Emergency
Connectivity & Networking
SIM Cards
SIM Card Actions
Global IPs
Mobile Network Operators
Networks
OTA updates
Private Wireless Gateways
Public Internet Gateways
Regions
SIM Card Group Actions
SIM Card Groups
SIM Card Orders
Virtual Cross Connects
WireGuard Interfaces
Wireless Regions
Wireless Blocklists
Callbacks
Storage & Data
Storage (S3-Compatible)
Storage (JSON Companion)
Account & Billing
Payment APIs
Notifications
Addresses
Balance
Authentication providers
IP addresses
Managed accounts
Invoices
Billing groups
Detail records
Usage reports
Webhooks
Audit trail
Taggings
Integration Secrets
SETI
SETI Observability
Callbacks
OAuth
OAuth Discovery
OAuth Protocol
OAuth Clients
OAuth Grants
Callbacks
Real-Time Communications
Messaging
Messages
Send a message
Copy page

Send a message with a Phone Number, Alphanumeric Sender ID, Short Code or Number Pool.

This endpoint allows you to send a message with any messaging resource. Current messaging resources include: long-code, short-code, number-pool, and alphanumeric-sender-id.

POST
/
messages
Try it
JavaScript

JavaScript

Copy
Ask AI
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
});

const response = await client.messages.send({ to: '+18445550001' });

console.log(response.data);
200
4XX
Copy
Ask AI
{
  "data": {
    "record_type": "message",
    "direction": "outbound",
    "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
    "type": "MMS",
    "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
    "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
    "from": {
      "phone_number": "+18445550001",
      "carrier": "TELNYX LLC",
      "line_type": "VoIP"
    },
    "to": [
      {
        "phone_number": "+18665550001",
        "status": "queued",
        "carrier": "T-MOBILE USA, INC.",
        "line_type": "Wireless"
      }
    ],
    "cc": [],
    "text": "Hello, World!",
    "subject": "From Telnyx!",
    "media": [
      {
        "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
        "content_type": null,
        "sha256": null,
        "size": null
      }
    ],
    "webhook_url": "https://www.example.com/hooks",
    "webhook_failover_url": "https://backup.example.com/hooks",
    "encoding": "GSM-7",
    "parts": 1,
    "tags": [
      "Greetings"
    ],
    "cost": {
      "amount": "0.0051",
      "currency": "USD"
    },
    "cost_breakdown": {
      "carrier_fee": {
        "amount": "0.00305",
        "currency": "USD"
      },
      "rate": {
        "amount": "0.00205",
        "currency": "USD"
      }
    },
    "tcr_campaign_id": "TCPA3X7",
    "tcr_campaign_billable": true,
    "tcr_campaign_registered": "REGISTERED",
    "received_at": "2019-01-23T18:10:02.574Z",
    "sent_at": null,
    "completed_at": null,
    "valid_until": null,
    "errors": []
  }
}
Authorizations
​
Authorization
stringheaderrequired

Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Body
application/json

Message payload

​
to
string<address>required

Receiving address (+E.164 formatted phone number or short code).

Example:

"+E.164"

​
from
string<address>

Sending address (+E.164 formatted phone number, alphanumeric sender ID, or short code).

Required if sending with a phone number, short code, or alphanumeric sender ID.

​
messaging_profile_id
string

Unique identifier for a messaging profile.

Required if sending via number pool or with an alphanumeric sender ID.

​
text
string

Message body (i.e., content) as a non-empty string.

Required for SMS

​
subject
string

Subject of multimedia message

​
media_urls
string<url>[]

A list of media URLs. The total media size must be less than 1 MB.

Required for MMS

​
webhook_url
string<url>

The URL where webhooks related to this message will be sent.

​
webhook_failover_url
string<url>

The failover URL where webhooks related to this message will be sent if sending to the primary URL fails.

​
use_profile_webhooks
booleandefault:true

If the profile this number is associated with has webhooks, use them for delivery notifications. If webhooks are also specified on the message itself, they will be attempted first, then those on the profile.

​
type
enum<string>

The protocol for sending the message, either SMS or MMS.

Available options: SMS, MMS 
​
auto_detect
booleandefault:false

Automatically detect if an SMS message is unusually long and exceeds a recommended limit of message parts.

​
send_at
string<date-time> | null

ISO 8601 formatted date indicating when to send the message - accurate up till a minute.

Response
200
application/json

Successful response with details about a message.

​
data
object

Show child attributes

Example:
{
  "record_type": "message",
  "direction": "outbound",
  "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
  "type": "MMS",
  "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
  "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
  "from": {
    "phone_number": "+18445550001",
    "carrier": "TELNYX LLC",
    "line_type": "VoIP"
  },
  "to": [
    {
      "phone_number": "+18665550001",
      "status": "queued",
      "carrier": "T-MOBILE USA, INC.",
      "line_type": "Wireless"
    }
  ],
  "cc": [],
  "text": "Hello, World!",
  "subject": "From Telnyx!",
  "media": [
    {
      "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
      "content_type": null,
      "sha256": null,
      "size": null
    }
  ],
  "webhook_url": "https://www.example.com/hooks",
  "webhook_failover_url": "https://backup.example.com/hooks",
  "encoding": "GSM-7",
  "parts": 1,
  "tags": ["Greetings"],
  "cost": { "amount": "0.0051", "currency": "USD" },
  "cost_breakdown": {
    "carrier_fee": { "amount": "0.00305", "currency": "USD" },
    "rate": { "amount": "0.00205", "currency": "USD" }
  },
  "tcr_campaign_id": "TCPA3X7",
  "tcr_campaign_billable": true,
  "tcr_campaign_registered": "REGISTERED",
  "received_at": "2019-01-23T18:10:02.574Z",
  "sent_at": null,
  "completed_at": null,
  "valid_until": null,
  "errors": []
}

Was this page helpful?

Yes
No
Transcription
Send a group MMS message
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Retrieve A Message


**URL:** https://developers.telnyx.com/api-reference/messages/retrieve-a-message

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
API overview
AI
Assistants
Audio
Chat
Clusters
Conversations
Embeddings
Fine Tuning
Integrations
MCP Servers
Callbacks
Real-Time Communications
Programmable voice
TeXML
Outbound voice profiles
SIP connections
Credentials
Verified numbers
Dialogflow integration
External connects
Call recordings
Media storage
Messaging
Messages
POST
Send a message
POST
Send a group MMS message
POST
Send a long code message
POST
Send a message using number pool
POST
Schedule a message
POST
Send a short code message
GET
Retrieve a message
DEL
Cancel a scheduled message
RCS messaging
Messaging Hosted Number
Number Configurations
Advanced OptIn/OptOut
Messaging Profiles
Messaging URL Domains
Mobile Number Configurations
Phone Number Configurations
Short Codes
Callbacks
Toll-free verification
10DLC
Video
Fax
Push credentials
Numbers & Identity
Phone numbers
Voicemail
Voice Channels
Bundles
Number portout
Phone number porting
Porting order
Documents
Number lookup
Verify
Emergency
Connectivity & Networking
SIM Cards
SIM Card Actions
Global IPs
Mobile Network Operators
Networks
OTA updates
Private Wireless Gateways
Public Internet Gateways
Regions
SIM Card Group Actions
SIM Card Groups
SIM Card Orders
Virtual Cross Connects
WireGuard Interfaces
Wireless Regions
Wireless Blocklists
Callbacks
Storage & Data
Storage (S3-Compatible)
Storage (JSON Companion)
Account & Billing
Payment APIs
Notifications
Addresses
Balance
Authentication providers
IP addresses
Managed accounts
Invoices
Billing groups
Detail records
Usage reports
Webhooks
Audit trail
Taggings
Integration Secrets
SETI
SETI Observability
Callbacks
OAuth
OAuth Discovery
OAuth Protocol
OAuth Clients
OAuth Grants
Callbacks
Real-Time Communications
Messaging
Messages
Retrieve a message
Copy page

Note: This API endpoint can only retrieve messages that are no older than 10 days since their creation. If you require messages older than this, please generate an MDR report.

GET
/
messages
/
{id}
Try it
JavaScript

JavaScript

Copy
Ask AI
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
});

const message = await client.messages.retrieve('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');

console.log(message.data);
200
4XX
Copy
Ask AI
{
  "data": {
    "record_type": "message",
    "direction": "outbound",
    "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
    "type": "MMS",
    "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
    "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
    "from": {
      "phone_number": "+18445550001",
      "carrier": "TELNYX LLC",
      "line_type": "VoIP"
    },
    "to": [
      {
        "phone_number": "+18665550001",
        "status": "queued",
        "carrier": "T-MOBILE USA, INC.",
        "line_type": "Wireless"
      }
    ],
    "cc": [],
    "text": "Hello, World!",
    "subject": "From Telnyx!",
    "media": [
      {
        "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
        "content_type": null,
        "sha256": null,
        "size": null
      }
    ],
    "webhook_url": "https://www.example.com/hooks",
    "webhook_failover_url": "https://backup.example.com/hooks",
    "encoding": "GSM-7",
    "parts": 1,
    "tags": [
      "Greetings"
    ],
    "cost": {
      "amount": "0.0051",
      "currency": "USD"
    },
    "cost_breakdown": {
      "carrier_fee": {
        "amount": "0.00305",
        "currency": "USD"
      },
      "rate": {
        "amount": "0.00205",
        "currency": "USD"
      }
    },
    "tcr_campaign_id": "TCPA3X7",
    "tcr_campaign_billable": true,
    "tcr_campaign_registered": "REGISTERED",
    "received_at": "2019-01-23T18:10:02.574Z",
    "sent_at": null,
    "completed_at": null,
    "valid_until": null,
    "errors": []
  }
}
Authorizations
​
Authorization
stringheaderrequired

Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Path Parameters
​
id
string<uuid>required

The id of the message

Response
200
application/json

Successful response with details of a message.

​
data
object
Option 1
Option 2

Show child attributes

Example:
{
  "record_type": "message",
  "direction": "outbound",
  "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
  "type": "MMS",
  "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
  "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
  "from": {
    "phone_number": "+18445550001",
    "carrier": "TELNYX LLC",
    "line_type": "VoIP"
  },
  "to": [
    {
      "phone_number": "+18665550001",
      "status": "queued",
      "carrier": "T-MOBILE USA, INC.",
      "line_type": "Wireless"
    }
  ],
  "cc": [],
  "text": "Hello, World!",
  "subject": "From Telnyx!",
  "media": [
    {
      "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
      "content_type": null,
      "sha256": null,
      "size": null
    }
  ],
  "webhook_url": "https://www.example.com/hooks",
  "webhook_failover_url": "https://backup.example.com/hooks",
  "encoding": "GSM-7",
  "parts": 1,
  "tags": ["Greetings"],
  "cost": { "amount": "0.0051", "currency": "USD" },
  "cost_breakdown": {
    "carrier_fee": { "amount": "0.00305", "currency": "USD" },
    "rate": { "amount": "0.00205", "currency": "USD" }
  },
  "tcr_campaign_id": "TCPA3X7",
  "tcr_campaign_billable": true,
  "tcr_campaign_registered": "REGISTERED",
  "received_at": "2019-01-23T18:10:02.574Z",
  "sent_at": null,
  "completed_at": null,
  "valid_until": null,
  "errors": []
}

Was this page helpful?

Yes
No
Send a short code message
Cancel a scheduled message
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Send A Group Mms Message


**URL:** https://developers.telnyx.com/api-reference/messages/send-a-group-mms-message

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
API overview
AI
Assistants
Audio
Chat
Clusters
Conversations
Embeddings
Fine Tuning
Integrations
MCP Servers
Callbacks
Real-Time Communications
Programmable voice
TeXML
Outbound voice profiles
SIP connections
Credentials
Verified numbers
Dialogflow integration
External connects
Call recordings
Media storage
Messaging
Messages
POST
Send a message
POST
Send a group MMS message
POST
Send a long code message
POST
Send a message using number pool
POST
Schedule a message
POST
Send a short code message
GET
Retrieve a message
DEL
Cancel a scheduled message
RCS messaging
Messaging Hosted Number
Number Configurations
Advanced OptIn/OptOut
Messaging Profiles
Messaging URL Domains
Mobile Number Configurations
Phone Number Configurations
Short Codes
Callbacks
Toll-free verification
10DLC
Video
Fax
Push credentials
Numbers & Identity
Phone numbers
Voicemail
Voice Channels
Bundles
Number portout
Phone number porting
Porting order
Documents
Number lookup
Verify
Emergency
Connectivity & Networking
SIM Cards
SIM Card Actions
Global IPs
Mobile Network Operators
Networks
OTA updates
Private Wireless Gateways
Public Internet Gateways
Regions
SIM Card Group Actions
SIM Card Groups
SIM Card Orders
Virtual Cross Connects
WireGuard Interfaces
Wireless Regions
Wireless Blocklists
Callbacks
Storage & Data
Storage (S3-Compatible)
Storage (JSON Companion)
Account & Billing
Payment APIs
Notifications
Addresses
Balance
Authentication providers
IP addresses
Managed accounts
Invoices
Billing groups
Detail records
Usage reports
Webhooks
Audit trail
Taggings
Integration Secrets
SETI
SETI Observability
Callbacks
OAuth
OAuth Discovery
OAuth Protocol
OAuth Clients
OAuth Grants
Callbacks
Real-Time Communications
Messaging
Messages
Send a group MMS message
Copy page
POST
/
messages
/
group_mms
Try it
JavaScript

JavaScript

Copy
Ask AI
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
});

const response = await client.messages.sendGroupMms({
  from: '+13125551234',
  to: ['+18655551234', '+14155551234'],
});

console.log(response.data);
200
4XX
Copy
Ask AI
{
  "data": {
    "record_type": "message",
    "direction": "outbound",
    "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
    "type": "MMS",
    "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
    "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
    "from": {
      "phone_number": "+18445550001",
      "carrier": "TELNYX LLC",
      "line_type": "VoIP"
    },
    "to": [
      {
        "phone_number": "+18665550001",
        "status": "queued",
        "carrier": "T-MOBILE USA, INC.",
        "line_type": "Wireless"
      }
    ],
    "cc": [],
    "text": "Hello, World!",
    "subject": "From Telnyx!",
    "media": [
      {
        "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
        "content_type": null,
        "sha256": null,
        "size": null
      }
    ],
    "webhook_url": "https://www.example.com/hooks",
    "webhook_failover_url": "https://backup.example.com/hooks",
    "encoding": "GSM-7",
    "parts": 1,
    "tags": [
      "Greetings"
    ],
    "cost": {
      "amount": "0.0051",
      "currency": "USD"
    },
    "cost_breakdown": {
      "carrier_fee": {
        "amount": "0.00305",
        "currency": "USD"
      },
      "rate": {
        "amount": "0.00205",
        "currency": "USD"
      }
    },
    "tcr_campaign_id": "TCPA3X7",
    "tcr_campaign_billable": true,
    "tcr_campaign_registered": "REGISTERED",
    "received_at": "2019-01-23T18:10:02.574Z",
    "sent_at": null,
    "completed_at": null,
    "valid_until": null,
    "errors": []
  }
}
Authorizations
​
Authorization
stringheaderrequired

Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Body
application/json

Message payload

​
from
string<address>required

Phone number, in +E.164 format, used to send the message.

​
to
string<address>[]required

A list of destinations. No more than 8 destinations are allowed.

Receiving address (+E.164 formatted phone number or short code).

​
text
string

Message body (i.e., content) as a non-empty string.

​
subject
string

Subject of multimedia message

​
media_urls
string<url>[]

A list of media URLs. The total media size must be less than 1 MB.

​
webhook_url
string<url>

The URL where webhooks related to this message will be sent.

​
webhook_failover_url
string<url>

The failover URL where webhooks related to this message will be sent if sending to the primary URL fails.

​
use_profile_webhooks
booleandefault:true

If the profile this number is associated with has webhooks, use them for delivery notifications. If webhooks are also specified on the message itself, they will be attempted first, then those on the profile.

Response
200
application/json

Successful response with details about a message.

​
data
object

Show child attributes

Example:
{
  "record_type": "message",
  "direction": "outbound",
  "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
  "type": "MMS",
  "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
  "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
  "from": {
    "phone_number": "+18445550001",
    "carrier": "TELNYX LLC",
    "line_type": "VoIP"
  },
  "to": [
    {
      "phone_number": "+18665550001",
      "status": "queued",
      "carrier": "T-MOBILE USA, INC.",
      "line_type": "Wireless"
    }
  ],
  "cc": [],
  "text": "Hello, World!",
  "subject": "From Telnyx!",
  "media": [
    {
      "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
      "content_type": null,
      "sha256": null,
      "size": null
    }
  ],
  "webhook_url": "https://www.example.com/hooks",
  "webhook_failover_url": "https://backup.example.com/hooks",
  "encoding": "GSM-7",
  "parts": 1,
  "tags": ["Greetings"],
  "cost": { "amount": "0.0051", "currency": "USD" },
  "cost_breakdown": {
    "carrier_fee": { "amount": "0.00305", "currency": "USD" },
    "rate": { "amount": "0.00205", "currency": "USD" }
  },
  "tcr_campaign_id": "TCPA3X7",
  "tcr_campaign_billable": true,
  "tcr_campaign_registered": "REGISTERED",
  "received_at": "2019-01-23T18:10:02.574Z",
  "sent_at": null,
  "completed_at": null,
  "valid_until": null,
  "errors": []
}

Was this page helpful?

Yes
No
Send a message
Send a long code message
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Send A Long Code Message


**URL:** https://developers.telnyx.com/api-reference/messages/send-a-long-code-message

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
API overview
AI
Assistants
Audio
Chat
Clusters
Conversations
Embeddings
Fine Tuning
Integrations
MCP Servers
Callbacks
Real-Time Communications
Programmable voice
TeXML
Outbound voice profiles
SIP connections
Credentials
Verified numbers
Dialogflow integration
External connects
Call recordings
Media storage
Messaging
Messages
POST
Send a message
POST
Send a group MMS message
POST
Send a long code message
POST
Send a message using number pool
POST
Schedule a message
POST
Send a short code message
GET
Retrieve a message
DEL
Cancel a scheduled message
RCS messaging
Messaging Hosted Number
Number Configurations
Advanced OptIn/OptOut
Messaging Profiles
Messaging URL Domains
Mobile Number Configurations
Phone Number Configurations
Short Codes
Callbacks
Toll-free verification
10DLC
Video
Fax
Push credentials
Numbers & Identity
Phone numbers
Voicemail
Voice Channels
Bundles
Number portout
Phone number porting
Porting order
Documents
Number lookup
Verify
Emergency
Connectivity & Networking
SIM Cards
SIM Card Actions
Global IPs
Mobile Network Operators
Networks
OTA updates
Private Wireless Gateways
Public Internet Gateways
Regions
SIM Card Group Actions
SIM Card Groups
SIM Card Orders
Virtual Cross Connects
WireGuard Interfaces
Wireless Regions
Wireless Blocklists
Callbacks
Storage & Data
Storage (S3-Compatible)
Storage (JSON Companion)
Account & Billing
Payment APIs
Notifications
Addresses
Balance
Authentication providers
IP addresses
Managed accounts
Invoices
Billing groups
Detail records
Usage reports
Webhooks
Audit trail
Taggings
Integration Secrets
SETI
SETI Observability
Callbacks
OAuth
OAuth Discovery
OAuth Protocol
OAuth Clients
OAuth Grants
Callbacks
Real-Time Communications
Messaging
Messages
Send a long code message
Copy page
POST
/
messages
/
long_code
Try it
JavaScript

JavaScript

Copy
Ask AI
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
});

const response = await client.messages.sendLongCode({ from: '+18445550001', to: '+13125550002' });

console.log(response.data);
200
4XX
Copy
Ask AI
{
  "data": {
    "record_type": "message",
    "direction": "outbound",
    "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
    "type": "MMS",
    "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
    "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
    "from": {
      "phone_number": "+18445550001",
      "carrier": "TELNYX LLC",
      "line_type": "VoIP"
    },
    "to": [
      {
        "phone_number": "+18665550001",
        "status": "queued",
        "carrier": "T-MOBILE USA, INC.",
        "line_type": "Wireless"
      }
    ],
    "cc": [],
    "text": "Hello, World!",
    "subject": "From Telnyx!",
    "media": [
      {
        "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
        "content_type": null,
        "sha256": null,
        "size": null
      }
    ],
    "webhook_url": "https://www.example.com/hooks",
    "webhook_failover_url": "https://backup.example.com/hooks",
    "encoding": "GSM-7",
    "parts": 1,
    "tags": [
      "Greetings"
    ],
    "cost": {
      "amount": "0.0051",
      "currency": "USD"
    },
    "cost_breakdown": {
      "carrier_fee": {
        "amount": "0.00305",
        "currency": "USD"
      },
      "rate": {
        "amount": "0.00205",
        "currency": "USD"
      }
    },
    "tcr_campaign_id": "TCPA3X7",
    "tcr_campaign_billable": true,
    "tcr_campaign_registered": "REGISTERED",
    "received_at": "2019-01-23T18:10:02.574Z",
    "sent_at": null,
    "completed_at": null,
    "valid_until": null,
    "errors": []
  }
}
Authorizations
​
Authorization
stringheaderrequired

Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Body
application/json

Message payload

​
from
string<address>required

Phone number, in +E.164 format, used to send the message.

​
to
string<address>required

Receiving address (+E.164 formatted phone number or short code).

Example:

"+E.164"

​
text
string

Message body (i.e., content) as a non-empty string.

Required for SMS

​
subject
string

Subject of multimedia message

​
media_urls
string<url>[]

A list of media URLs. The total media size must be less than 1 MB.

Required for MMS

​
webhook_url
string<url>

The URL where webhooks related to this message will be sent.

​
webhook_failover_url
string<url>

The failover URL where webhooks related to this message will be sent if sending to the primary URL fails.

​
use_profile_webhooks
booleandefault:true

If the profile this number is associated with has webhooks, use them for delivery notifications. If webhooks are also specified on the message itself, they will be attempted first, then those on the profile.

​
type
enum<string>

The protocol for sending the message, either SMS or MMS.

Available options: SMS, MMS 
​
auto_detect
booleandefault:false

Automatically detect if an SMS message is unusually long and exceeds a recommended limit of message parts.

Response
200
application/json

Successful response with details about a message.

​
data
object

Show child attributes

Example:
{
  "record_type": "message",
  "direction": "outbound",
  "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
  "type": "MMS",
  "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
  "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
  "from": {
    "phone_number": "+18445550001",
    "carrier": "TELNYX LLC",
    "line_type": "VoIP"
  },
  "to": [
    {
      "phone_number": "+18665550001",
      "status": "queued",
      "carrier": "T-MOBILE USA, INC.",
      "line_type": "Wireless"
    }
  ],
  "cc": [],
  "text": "Hello, World!",
  "subject": "From Telnyx!",
  "media": [
    {
      "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
      "content_type": null,
      "sha256": null,
      "size": null
    }
  ],
  "webhook_url": "https://www.example.com/hooks",
  "webhook_failover_url": "https://backup.example.com/hooks",
  "encoding": "GSM-7",
  "parts": 1,
  "tags": ["Greetings"],
  "cost": { "amount": "0.0051", "currency": "USD" },
  "cost_breakdown": {
    "carrier_fee": { "amount": "0.00305", "currency": "USD" },
    "rate": { "amount": "0.00205", "currency": "USD" }
  },
  "tcr_campaign_id": "TCPA3X7",
  "tcr_campaign_billable": true,
  "tcr_campaign_registered": "REGISTERED",
  "received_at": "2019-01-23T18:10:02.574Z",
  "sent_at": null,
  "completed_at": null,
  "valid_until": null,
  "errors": []
}

Was this page helpful?

Yes
No
Send a group MMS message
Send a message using number pool
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Send A Message Using Number Pool


**URL:** https://developers.telnyx.com/api-reference/messages/send-a-message-using-number-pool

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
API overview
AI
Assistants
Audio
Chat
Clusters
Conversations
Embeddings
Fine Tuning
Integrations
MCP Servers
Callbacks
Real-Time Communications
Programmable voice
TeXML
Outbound voice profiles
SIP connections
Credentials
Verified numbers
Dialogflow integration
External connects
Call recordings
Media storage
Messaging
Messages
POST
Send a message
POST
Send a group MMS message
POST
Send a long code message
POST
Send a message using number pool
POST
Schedule a message
POST
Send a short code message
GET
Retrieve a message
DEL
Cancel a scheduled message
RCS messaging
Messaging Hosted Number
Number Configurations
Advanced OptIn/OptOut
Messaging Profiles
Messaging URL Domains
Mobile Number Configurations
Phone Number Configurations
Short Codes
Callbacks
Toll-free verification
10DLC
Video
Fax
Push credentials
Numbers & Identity
Phone numbers
Voicemail
Voice Channels
Bundles
Number portout
Phone number porting
Porting order
Documents
Number lookup
Verify
Emergency
Connectivity & Networking
SIM Cards
SIM Card Actions
Global IPs
Mobile Network Operators
Networks
OTA updates
Private Wireless Gateways
Public Internet Gateways
Regions
SIM Card Group Actions
SIM Card Groups
SIM Card Orders
Virtual Cross Connects
WireGuard Interfaces
Wireless Regions
Wireless Blocklists
Callbacks
Storage & Data
Storage (S3-Compatible)
Storage (JSON Companion)
Account & Billing
Payment APIs
Notifications
Addresses
Balance
Authentication providers
IP addresses
Managed accounts
Invoices
Billing groups
Detail records
Usage reports
Webhooks
Audit trail
Taggings
Integration Secrets
SETI
SETI Observability
Callbacks
OAuth
OAuth Discovery
OAuth Protocol
OAuth Clients
OAuth Grants
Callbacks
Real-Time Communications
Messaging
Messages
Send a message using number pool
Copy page
POST
/
messages
/
number_pool
Try it
JavaScript

JavaScript

Copy
Ask AI
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
});

const response = await client.messages.sendNumberPool({
  messaging_profile_id: 'abc85f64-5717-4562-b3fc-2c9600000000',
  to: '+13125550002',
});

console.log(response.data);
200
4XX
Copy
Ask AI
{
  "data": {
    "record_type": "message",
    "direction": "outbound",
    "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
    "type": "MMS",
    "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
    "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
    "from": {
      "phone_number": "+18445550001",
      "carrier": "TELNYX LLC",
      "line_type": "VoIP"
    },
    "to": [
      {
        "phone_number": "+18665550001",
        "status": "queued",
        "carrier": "T-MOBILE USA, INC.",
        "line_type": "Wireless"
      }
    ],
    "cc": [],
    "text": "Hello, World!",
    "subject": "From Telnyx!",
    "media": [
      {
        "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
        "content_type": null,
        "sha256": null,
        "size": null
      }
    ],
    "webhook_url": "https://www.example.com/hooks",
    "webhook_failover_url": "https://backup.example.com/hooks",
    "encoding": "GSM-7",
    "parts": 1,
    "tags": [
      "Greetings"
    ],
    "cost": {
      "amount": "0.0051",
      "currency": "USD"
    },
    "cost_breakdown": {
      "carrier_fee": {
        "amount": "0.00305",
        "currency": "USD"
      },
      "rate": {
        "amount": "0.00205",
        "currency": "USD"
      }
    },
    "tcr_campaign_id": "TCPA3X7",
    "tcr_campaign_billable": true,
    "tcr_campaign_registered": "REGISTERED",
    "received_at": "2019-01-23T18:10:02.574Z",
    "sent_at": null,
    "completed_at": null,
    "valid_until": null,
    "errors": []
  }
}
Authorizations
​
Authorization
stringheaderrequired

Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Body
application/json

Message payload

​
messaging_profile_id
stringrequired

Unique identifier for a messaging profile.

​
to
string<address>required

Receiving address (+E.164 formatted phone number or short code).

Example:

"+E.164"

​
text
string

Message body (i.e., content) as a non-empty string.

Required for SMS

​
subject
string

Subject of multimedia message

​
media_urls
string<url>[]

A list of media URLs. The total media size must be less than 1 MB.

Required for MMS

​
webhook_url
string<url>

The URL where webhooks related to this message will be sent.

​
webhook_failover_url
string<url>

The failover URL where webhooks related to this message will be sent if sending to the primary URL fails.

​
use_profile_webhooks
booleandefault:true

If the profile this number is associated with has webhooks, use them for delivery notifications. If webhooks are also specified on the message itself, they will be attempted first, then those on the profile.

​
type
enum<string>

The protocol for sending the message, either SMS or MMS.

Available options: SMS, MMS 
​
auto_detect
booleandefault:false

Automatically detect if an SMS message is unusually long and exceeds a recommended limit of message parts.

Response
200
application/json

Successful response with details about a message.

​
data
object

Show child attributes

Example:
{
  "record_type": "message",
  "direction": "outbound",
  "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
  "type": "MMS",
  "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
  "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
  "from": {
    "phone_number": "+18445550001",
    "carrier": "TELNYX LLC",
    "line_type": "VoIP"
  },
  "to": [
    {
      "phone_number": "+18665550001",
      "status": "queued",
      "carrier": "T-MOBILE USA, INC.",
      "line_type": "Wireless"
    }
  ],
  "cc": [],
  "text": "Hello, World!",
  "subject": "From Telnyx!",
  "media": [
    {
      "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
      "content_type": null,
      "sha256": null,
      "size": null
    }
  ],
  "webhook_url": "https://www.example.com/hooks",
  "webhook_failover_url": "https://backup.example.com/hooks",
  "encoding": "GSM-7",
  "parts": 1,
  "tags": ["Greetings"],
  "cost": { "amount": "0.0051", "currency": "USD" },
  "cost_breakdown": {
    "carrier_fee": { "amount": "0.00305", "currency": "USD" },
    "rate": { "amount": "0.00205", "currency": "USD" }
  },
  "tcr_campaign_id": "TCPA3X7",
  "tcr_campaign_billable": true,
  "tcr_campaign_registered": "REGISTERED",
  "received_at": "2019-01-23T18:10:02.574Z",
  "sent_at": null,
  "completed_at": null,
  "valid_until": null,
  "errors": []
}

Was this page helpful?

Yes
No
Send a long code message
Schedule a message
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Schedule A Message


**URL:** https://developers.telnyx.com/api-reference/messages/schedule-a-message

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
API overview
AI
Assistants
Audio
Chat
Clusters
Conversations
Embeddings
Fine Tuning
Integrations
MCP Servers
Callbacks
Real-Time Communications
Programmable voice
TeXML
Outbound voice profiles
SIP connections
Credentials
Verified numbers
Dialogflow integration
External connects
Call recordings
Media storage
Messaging
Messages
POST
Send a message
POST
Send a group MMS message
POST
Send a long code message
POST
Send a message using number pool
POST
Schedule a message
POST
Send a short code message
GET
Retrieve a message
DEL
Cancel a scheduled message
RCS messaging
Messaging Hosted Number
Number Configurations
Advanced OptIn/OptOut
Messaging Profiles
Messaging URL Domains
Mobile Number Configurations
Phone Number Configurations
Short Codes
Callbacks
Toll-free verification
10DLC
Video
Fax
Push credentials
Numbers & Identity
Phone numbers
Voicemail
Voice Channels
Bundles
Number portout
Phone number porting
Porting order
Documents
Number lookup
Verify
Emergency
Connectivity & Networking
SIM Cards
SIM Card Actions
Global IPs
Mobile Network Operators
Networks
OTA updates
Private Wireless Gateways
Public Internet Gateways
Regions
SIM Card Group Actions
SIM Card Groups
SIM Card Orders
Virtual Cross Connects
WireGuard Interfaces
Wireless Regions
Wireless Blocklists
Callbacks
Storage & Data
Storage (S3-Compatible)
Storage (JSON Companion)
Account & Billing
Payment APIs
Notifications
Addresses
Balance
Authentication providers
IP addresses
Managed accounts
Invoices
Billing groups
Detail records
Usage reports
Webhooks
Audit trail
Taggings
Integration Secrets
SETI
SETI Observability
Callbacks
OAuth
OAuth Discovery
OAuth Protocol
OAuth Clients
OAuth Grants
Callbacks
Real-Time Communications
Messaging
Messages
Schedule a message
Copy page

Schedule a message with a Phone Number, Alphanumeric Sender ID, Short Code or Number Pool.

This endpoint allows you to schedule a message with any messaging resource. Current messaging resources include: long-code, short-code, number-pool, and alphanumeric-sender-id.

POST
/
messages
/
schedule
Try it
JavaScript

JavaScript

Copy
Ask AI
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
});

const response = await client.messages.schedule({ to: '+18445550001' });

console.log(response.data);
200
4XX
Copy
Ask AI
{
  "data": {
    "record_type": "message",
    "direction": "outbound",
    "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
    "type": "MMS",
    "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
    "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
    "from": {
      "phone_number": "+18445550001",
      "carrier": "TELNYX LLC",
      "line_type": "VoIP"
    },
    "to": [
      {
        "phone_number": "+18665550001",
        "status": "queued",
        "carrier": "T-MOBILE USA, INC.",
        "line_type": "Wireless"
      }
    ],
    "cc": [],
    "text": "Hello, World!",
    "subject": "From Telnyx!",
    "media": [
      {
        "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
        "content_type": null,
        "sha256": null,
        "size": null
      }
    ],
    "webhook_url": "https://www.example.com/hooks",
    "webhook_failover_url": "https://backup.example.com/hooks",
    "encoding": "GSM-7",
    "parts": 1,
    "tags": [
      "Greetings"
    ],
    "cost": {
      "amount": "0.0051",
      "currency": "USD"
    },
    "cost_breakdown": {
      "carrier_fee": {
        "amount": "0.00305",
        "currency": "USD"
      },
      "rate": {
        "amount": "0.00205",
        "currency": "USD"
      }
    },
    "tcr_campaign_id": "TCPA3X7",
    "tcr_campaign_billable": true,
    "tcr_campaign_registered": "REGISTERED",
    "received_at": "2019-01-23T18:10:02.574Z",
    "sent_at": null,
    "completed_at": null,
    "valid_until": null,
    "errors": []
  }
}
Authorizations
​
Authorization
stringheaderrequired

Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Body
application/json

Message payload with send_at set

​
to
string<address>required

Receiving address (+E.164 formatted phone number or short code).

Example:

"+E.164"

​
from
string<address>

Sending address (+E.164 formatted phone number, alphanumeric sender ID, or short code).

Required if sending with a phone number, short code, or alphanumeric sender ID.

​
messaging_profile_id
string

Unique identifier for a messaging profile.

Required if sending via number pool or with an alphanumeric sender ID.

​
text
string

Message body (i.e., content) as a non-empty string.

Required for SMS

​
subject
string

Subject of multimedia message

​
media_urls
string<url>[]

A list of media URLs. The total media size must be less than 1 MB.

Required for MMS

​
webhook_url
string<url>

The URL where webhooks related to this message will be sent.

​
webhook_failover_url
string<url>

The failover URL where webhooks related to this message will be sent if sending to the primary URL fails.

​
use_profile_webhooks
booleandefault:true

If the profile this number is associated with has webhooks, use them for delivery notifications. If webhooks are also specified on the message itself, they will be attempted first, then those on the profile.

​
type
enum<string>

The protocol for sending the message, either SMS or MMS.

Available options: SMS, MMS 
​
auto_detect
booleandefault:false

Automatically detect if an SMS message is unusually long and exceeds a recommended limit of message parts.

​
send_at
string<date-time>

ISO 8601 formatted date indicating when to send the message - accurate up till a minute.

Response
200
application/json

Successful response with details about a message.

​
data
object

Show child attributes

Example:
{
  "record_type": "message",
  "direction": "outbound",
  "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
  "type": "MMS",
  "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
  "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
  "from": {
    "phone_number": "+18445550001",
    "carrier": "TELNYX LLC",
    "line_type": "VoIP"
  },
  "to": [
    {
      "phone_number": "+18665550001",
      "status": "queued",
      "carrier": "T-MOBILE USA, INC.",
      "line_type": "Wireless"
    }
  ],
  "cc": [],
  "text": "Hello, World!",
  "subject": "From Telnyx!",
  "media": [
    {
      "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
      "content_type": null,
      "sha256": null,
      "size": null
    }
  ],
  "webhook_url": "https://www.example.com/hooks",
  "webhook_failover_url": "https://backup.example.com/hooks",
  "encoding": "GSM-7",
  "parts": 1,
  "tags": ["Greetings"],
  "cost": { "amount": "0.0051", "currency": "USD" },
  "cost_breakdown": {
    "carrier_fee": { "amount": "0.00305", "currency": "USD" },
    "rate": { "amount": "0.00205", "currency": "USD" }
  },
  "tcr_campaign_id": "TCPA3X7",
  "tcr_campaign_billable": true,
  "tcr_campaign_registered": "REGISTERED",
  "received_at": "2019-01-23T18:10:02.574Z",
  "sent_at": null,
  "completed_at": null,
  "valid_until": null,
  "errors": []
}

Was this page helpful?

Yes
No
Send a message using number pool
Send a short code message
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Send A Short Code Message


**URL:** https://developers.telnyx.com/api-reference/messages/send-a-short-code-message

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
API overview
AI
Assistants
Audio
Chat
Clusters
Conversations
Embeddings
Fine Tuning
Integrations
MCP Servers
Callbacks
Real-Time Communications
Programmable voice
TeXML
Outbound voice profiles
SIP connections
Credentials
Verified numbers
Dialogflow integration
External connects
Call recordings
Media storage
Messaging
Messages
POST
Send a message
POST
Send a group MMS message
POST
Send a long code message
POST
Send a message using number pool
POST
Schedule a message
POST
Send a short code message
GET
Retrieve a message
DEL
Cancel a scheduled message
RCS messaging
Messaging Hosted Number
Number Configurations
Advanced OptIn/OptOut
Messaging Profiles
Messaging URL Domains
Mobile Number Configurations
Phone Number Configurations
Short Codes
Callbacks
Toll-free verification
10DLC
Video
Fax
Push credentials
Numbers & Identity
Phone numbers
Voicemail
Voice Channels
Bundles
Number portout
Phone number porting
Porting order
Documents
Number lookup
Verify
Emergency
Connectivity & Networking
SIM Cards
SIM Card Actions
Global IPs
Mobile Network Operators
Networks
OTA updates
Private Wireless Gateways
Public Internet Gateways
Regions
SIM Card Group Actions
SIM Card Groups
SIM Card Orders
Virtual Cross Connects
WireGuard Interfaces
Wireless Regions
Wireless Blocklists
Callbacks
Storage & Data
Storage (S3-Compatible)
Storage (JSON Companion)
Account & Billing
Payment APIs
Notifications
Addresses
Balance
Authentication providers
IP addresses
Managed accounts
Invoices
Billing groups
Detail records
Usage reports
Webhooks
Audit trail
Taggings
Integration Secrets
SETI
SETI Observability
Callbacks
OAuth
OAuth Discovery
OAuth Protocol
OAuth Clients
OAuth Grants
Callbacks
Real-Time Communications
Messaging
Messages
Send a short code message
Copy page
POST
/
messages
/
short_code
Try it
JavaScript

JavaScript

Copy
Ask AI
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
});

const response = await client.messages.sendShortCode({ from: '+18445550001', to: '+18445550001' });

console.log(response.data);
200
4XX
Copy
Ask AI
{
  "data": {
    "record_type": "message",
    "direction": "outbound",
    "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
    "type": "MMS",
    "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
    "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
    "from": {
      "phone_number": "+18445550001",
      "carrier": "TELNYX LLC",
      "line_type": "VoIP"
    },
    "to": [
      {
        "phone_number": "+18665550001",
        "status": "queued",
        "carrier": "T-MOBILE USA, INC.",
        "line_type": "Wireless"
      }
    ],
    "cc": [],
    "text": "Hello, World!",
    "subject": "From Telnyx!",
    "media": [
      {
        "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
        "content_type": null,
        "sha256": null,
        "size": null
      }
    ],
    "webhook_url": "https://www.example.com/hooks",
    "webhook_failover_url": "https://backup.example.com/hooks",
    "encoding": "GSM-7",
    "parts": 1,
    "tags": [
      "Greetings"
    ],
    "cost": {
      "amount": "0.0051",
      "currency": "USD"
    },
    "cost_breakdown": {
      "carrier_fee": {
        "amount": "0.00305",
        "currency": "USD"
      },
      "rate": {
        "amount": "0.00205",
        "currency": "USD"
      }
    },
    "tcr_campaign_id": "TCPA3X7",
    "tcr_campaign_billable": true,
    "tcr_campaign_registered": "REGISTERED",
    "received_at": "2019-01-23T18:10:02.574Z",
    "sent_at": null,
    "completed_at": null,
    "valid_until": null,
    "errors": []
  }
}
Authorizations
​
Authorization
stringheaderrequired

Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Body
application/json

Message payload

​
from
string<address>required

Phone number, in +E.164 format, used to send the message.

​
to
string<address>required

Receiving address (+E.164 formatted phone number or short code).

Example:

"+E.164"

​
text
string

Message body (i.e., content) as a non-empty string.

Required for SMS

​
subject
string

Subject of multimedia message

​
media_urls
string<url>[]

A list of media URLs. The total media size must be less than 1 MB.

Required for MMS

​
webhook_url
string<url>

The URL where webhooks related to this message will be sent.

​
webhook_failover_url
string<url>

The failover URL where webhooks related to this message will be sent if sending to the primary URL fails.

​
use_profile_webhooks
booleandefault:true

If the profile this number is associated with has webhooks, use them for delivery notifications. If webhooks are also specified on the message itself, they will be attempted first, then those on the profile.

​
type
enum<string>

The protocol for sending the message, either SMS or MMS.

Available options: SMS, MMS 
​
auto_detect
booleandefault:false

Automatically detect if an SMS message is unusually long and exceeds a recommended limit of message parts.

Response
200
application/json

Successful response with details about a message.

​
data
object

Show child attributes

Example:
{
  "record_type": "message",
  "direction": "outbound",
  "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
  "type": "MMS",
  "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
  "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
  "from": {
    "phone_number": "+18445550001",
    "carrier": "TELNYX LLC",
    "line_type": "VoIP"
  },
  "to": [
    {
      "phone_number": "+18665550001",
      "status": "queued",
      "carrier": "T-MOBILE USA, INC.",
      "line_type": "Wireless"
    }
  ],
  "cc": [],
  "text": "Hello, World!",
  "subject": "From Telnyx!",
  "media": [
    {
      "url": "https://pbs.twimg.com/profile_images/1142168442042118144/AW3F4fFD_400x400.png",
      "content_type": null,
      "sha256": null,
      "size": null
    }
  ],
  "webhook_url": "https://www.example.com/hooks",
  "webhook_failover_url": "https://backup.example.com/hooks",
  "encoding": "GSM-7",
  "parts": 1,
  "tags": ["Greetings"],
  "cost": { "amount": "0.0051", "currency": "USD" },
  "cost_breakdown": {
    "carrier_fee": { "amount": "0.00305", "currency": "USD" },
    "rate": { "amount": "0.00205", "currency": "USD" }
  },
  "tcr_campaign_id": "TCPA3X7",
  "tcr_campaign_billable": true,
  "tcr_campaign_registered": "REGISTERED",
  "received_at": "2019-01-23T18:10:02.574Z",
  "sent_at": null,
  "completed_at": null,
  "valid_until": null,
  "errors": []
}

Was this page helpful?

Yes
No
Schedule a message
Retrieve a message
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github

---

## Cancel A Scheduled Message


**URL:** https://developers.telnyx.com/api-reference/messages/cancel-a-scheduled-message

---

Skip to main content
Telnyx home page
Search...
Ctrl K
Login
Sign Up
Guides
Development
API reference
Contact us
Slack community
API overview
AI
Assistants
Audio
Chat
Clusters
Conversations
Embeddings
Fine Tuning
Integrations
MCP Servers
Callbacks
Real-Time Communications
Programmable voice
TeXML
Outbound voice profiles
SIP connections
Credentials
Verified numbers
Dialogflow integration
External connects
Call recordings
Media storage
Messaging
Messages
POST
Send a message
POST
Send a group MMS message
POST
Send a long code message
POST
Send a message using number pool
POST
Schedule a message
POST
Send a short code message
GET
Retrieve a message
DEL
Cancel a scheduled message
RCS messaging
Messaging Hosted Number
Number Configurations
Advanced OptIn/OptOut
Messaging Profiles
Messaging URL Domains
Mobile Number Configurations
Phone Number Configurations
Short Codes
Callbacks
Toll-free verification
10DLC
Video
Fax
Push credentials
Numbers & Identity
Phone numbers
Voicemail
Voice Channels
Bundles
Number portout
Phone number porting
Porting order
Documents
Number lookup
Verify
Emergency
Connectivity & Networking
SIM Cards
SIM Card Actions
Global IPs
Mobile Network Operators
Networks
OTA updates
Private Wireless Gateways
Public Internet Gateways
Regions
SIM Card Group Actions
SIM Card Groups
SIM Card Orders
Virtual Cross Connects
WireGuard Interfaces
Wireless Regions
Wireless Blocklists
Callbacks
Storage & Data
Storage (S3-Compatible)
Storage (JSON Companion)
Account & Billing
Payment APIs
Notifications
Addresses
Balance
Authentication providers
IP addresses
Managed accounts
Invoices
Billing groups
Detail records
Usage reports
Webhooks
Audit trail
Taggings
Integration Secrets
SETI
SETI Observability
Callbacks
OAuth
OAuth Discovery
OAuth Protocol
OAuth Clients
OAuth Grants
Callbacks
Real-Time Communications
Messaging
Messages
Cancel a scheduled message
Copy page

Cancel a scheduled message that has not yet been sent. Only messages with status=scheduled and send_at more than a minute from now can be cancelled.

DELETE
/
messages
/
{id}
Try it
JavaScript

JavaScript

Copy
Ask AI
import Telnyx from 'telnyx';

const client = new Telnyx({
  apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
});

const response = await client.messages.cancelScheduled('182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e');

console.log(response.id);
200
403
404
4XX
Copy
Ask AI
{
  "record_type": "message",
  "direction": "outbound",
  "id": "40385f64-5717-4562-b3fc-2c963f66afa6",
  "type": "SMS",
  "messaging_profile_id": "4000eba1-a0c0-4563-9925-b25e842a7cb6",
  "organization_id": "b448f9cc-a842-4784-98e9-03c1a5872950",
  "from": {
    "phone_number": "+18445550001",
    "carrier": "TELNYX LLC",
    "line_type": "VoIP"
  },
  "to": [
    {
      "phone_number": "+18665550001",
      "status": "cancelled",
      "carrier": "T-MOBILE USA, INC.",
      "line_type": "Wireless"
    }
  ],
  "cc": [],
  "text": "Hello, World!",
  "subject": "From Telnyx!",
  "media": [],
  "webhook_url": "https://www.example.com/hooks",
  "webhook_failover_url": "https://backup.example.com/hooks",
  "encoding": "GSM-7",
  "parts": 1,
  "tags": [
    "Greetings"
  ],
  "cost": {
    "amount": "0.0",
    "currency": "USD"
  },
  "cost_breakdown": null,
  "tcr_campaign_id": "TCPA3X7",
  "tcr_campaign_billable": true,
  "tcr_campaign_registered": "REGISTERED",
  "received_at": "2019-01-23T18:10:02.574Z",
  "sent_at": null,
  "completed_at": null,
  "valid_until": null,
  "errors": []
}
Authorizations
​
Authorization
stringheaderrequired

Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Path Parameters
​
id
string<uuid>required

The id of the message to cancel

Response
200
application/json

Successful response

​
record_type
enum<string>

Identifies the type of the resource.

Available options: message 
Example:

"message"

​
direction
enum<string>

The direction of the message. Inbound messages are sent to you whereas outbound messages are sent from you.

Available options: outbound 
Example:

"outbound"

​
id
string<uuid>

Identifies the type of resource.

​
type
enum<string>

The type of message.

Available options: SMS, MMS 
​
messaging_profile_id
string

Unique identifier for a messaging profile.

​
organization_id
string<uuid>

The id of the organization the messaging profile belongs to.

​
from
object

Show child attributes

​
to
object[]

Show child attributes

​
cc
object[]

Show child attributes

​
text
string

Message body (i.e., content) as a non-empty string.

Required for SMS

​
subject
string | null

Subject of multimedia message

​
media
object[]

Show child attributes

​
webhook_url
string<url> | null

The URL where webhooks related to this message will be sent.

​
webhook_failover_url
string<url> | null

The failover URL where webhooks related to this message will be sent if sending to the primary URL fails.

​
encoding
string

Encoding scheme used for the message body.

​
parts
integer

Number of parts into which the message's body must be split.

Required range: 1 <= x <= 10
​
tags
string[]

Tags associated with the resource.

​
cost
object

Show child attributes

​
cost_breakdown
object

Detailed breakdown of the message cost components.

Show child attributes

​
tcr_campaign_id
string | null

The Campaign Registry (TCR) campaign ID associated with the message.

​
tcr_campaign_billable
boolean

Indicates whether the TCR campaign is billable.

​
tcr_campaign_registered
string | null

The registration status of the TCR campaign.

Example:

"REGISTERED"

​
received_at
string<date-time>

ISO 8601 formatted date indicating when the message request was received.

​
sent_at
string<date-time> | null

ISO 8601 formatted date indicating when the message was sent.

​
completed_at
string<date-time> | null

ISO 8601 formatted date indicating when the message was finalized.

​
valid_until
string<date-time> | null

Message must be out of the queue by this time or else it will be discarded and marked as 'sending_failed'. Once the message moves out of the queue, this field will be nulled

​
errors
object[]

These errors may point at addressees when referring to unsuccessful/unconfirmed delivery statuses.

Show child attributes

Was this page helpful?

Yes
No
Retrieve a message
Generate RCS deeplink
Ctrl+I
Telnyx home page
Support Center
Slack community
Contact us
SETI
slack
x
linkedin
github