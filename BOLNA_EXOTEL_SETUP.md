# Bolna + Exotel Integration Setup

## Problem
Your calls are failing with: `"Calling from_number doesn't exist for exotel"`

## Root Cause
The phone number **+919513886363** needs to be registered directly in Bolna's dashboard. Bolna doesn't provide an API to register phone numbers - this must be done manually through their web interface.

## Solution Steps

### 1. Register Phone Number in Bolna Dashboard
1. Go to https://app.bolna.dev
2. Log in with your account (API Key: `bn-a4283a69b86d404d81fd1af434c1cabe`)
3. Navigate to **Settings** → **Phone Numbers** or **Telephony Providers**
4. Add your Exotel phone number: **+919513886363**
5. Configure it with provider: **exotel**

### 2. Verify Exotel Credentials in Bolna
Make sure these are configured in Bolna dashboard:
- **EXOTEL_SID**: arabiangulfpetrochem1
- **EXOTEL_API_KEY**: e4743d0ec0ccd0b6539616d640491e8e19501762b0c6ede2
- **EXOTEL_API_SECRET**: 88be57091f060d82edd549ee98315bcd1a44a91b8eb5813e
- **EXOTEL_DOMAIN**: api.exotel.com
- **EXOTEL_PHONE_NUMBER**: +919513886363
- **EXOTEL_OUTBOUND_APP_ID**: 1115811

### 3. Test After Registration
Once the phone number is registered in Bolna:
1. Go to your AI Agents page
2. Edit your agent
3. Assign phone number **+919513886363**
4. Click **"Sync to Bolna"**
5. Try making a call

## Current Status
✅ Exotel provider credentials are configured
✅ Phone number +919513886363 is in your database
✅ Agent can be assigned to the phone number
❌ Phone number NOT registered in Bolna (must be done manually)

## Alternative: Use Bolna's Test Number
If you can't register your Exotel number in Bolna, ask Bolna support if they have a test Exotel number you can use for development.

## Support
If you need help registering the phone number:
- Email: support@bolna.dev
- Check Bolna documentation: https://docs.bolna.dev
