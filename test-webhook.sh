#!/bin/bash

# Test webhook endpoints to verify status updates work correctly

echo "Testing Bolna Webhook..."
echo "========================"

# Test Bolna webhook with different statuses
curl -X POST http://localhost:5000/api/webhooks/bolna/call-status \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "test-bolna-call-123",
    "status": "answered",
    "duration": 120,
    "cost_per_minute": 0.015,
    "metadata": {
      "callId": "replace-with-real-call-id",
      "organizationId": "replace-with-real-org-id"
    }
  }'

echo -e "\n\nTesting Exotel Webhook..."
echo "========================"

# Test Exotel webhook with different statuses
curl -X POST http://localhost:5000/api/webhooks/exotel/call-status \
  -H "Content-Type: application/json" \
  -d '{
    "CallSid": "test-exotel-sid-123",
    "Status": "answered",
    "Duration": "120",
    "Price": "0.012",
    "CustomField": "{\"callId\":\"replace-with-real-call-id\",\"organizationId\":\"replace-with-real-org-id\"}"
  }'

echo -e "\n\nDone! Check server logs for webhook processing details."
