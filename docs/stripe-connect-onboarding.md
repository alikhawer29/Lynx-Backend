# Stripe Connect Onboarding Fields Documentation

## Overview
This document outlines the fields and information collected during Stripe Connect onboarding for providers in the Lynx Backend system.

## Account Configuration
The system uses **Stripe Express** accounts for providers, which provides the best balance of control and user experience.

## Required Fields Collected During Onboarding

### 1. Basic Business Information
- **Business Type**: Individual (for most service providers)
- **Legal Entity Name**: Provider's full legal name
- **Business Profile**: Description of services provided
- **Website**: Optional - provider's business website
- **MCC (Merchant Category Code)**: Auto-selected based on service type

### 2. Personal Information (for Individual accounts)
- **First Name**: Legal first name
- **Last Name**: Legal last name
- **Email**: Contact email address
- **Phone Number**: Mobile phone for verification
- **Date of Birth**: Must be 18+ years old
- **Physical Address**: 
  - Street address line 1
  - Street address line 2 (optional)
  - City
  - State/Province
  - ZIP/Postal code
  - Country

### 3. Identity Verification
- **SSN (Social Security Number)**: Last 4 digits (US accounts)
- **Personal ID Number**: Varies by country
- **Document Upload**: Government-issued ID verification
  - Driver's license
  - Passport
  - State ID card

### 4. Bank Account Information
- **Account Holder Name**: Must match legal name
- **Account Number**: Full bank account number
- **Routing Number**: ACH routing number (US)
- **Bank Name**: Auto-detected from routing number

### 5. Tax Information
- **Tax ID**: EIN for business or SSN for individuals
- **Tax withholding**: Configuration for tax reporting
- **1099 form**: US tax form preferences

### 6. Service-Specific Requirements
- **License Information**: Professional licenses (if applicable)
- **Certifications**: Service certifications
- **Insurance**: Business insurance details (if required)

## Optional Fields
- **Business Phone**: Separate business phone number
- **Support Email**: Customer support email
- **Support Phone**: Customer support phone
- **Business Logo**: Company logo (for branding)
- **Statement Descriptor**: How charges appear on customer statements

## Verification Process

### 1. Initial Verification
- Email verification
- Phone verification
- Basic identity check

### 2. Enhanced Verification (for higher volumes)
- Document verification
- Address verification
- Business license verification

### 3. Ongoing Monitoring
- Transaction monitoring
- Compliance checks
- Risk assessment

## Account Statuses

### 1. **not_started**
- Provider hasn't started onboarding
- No Stripe account created yet

### 2. **pending**
- Onboarding initiated but not completed
- Some information may be missing
- Account under review

### 3. **restricted**
- Basic functionality enabled
- Some features restricted
- Additional verification required

### 4. **enabled**
- Full functionality available
- All verification complete
- Ready for payouts

### 5. **rejected**
- Application rejected
- Cannot receive payouts
- Must reapply

## Capabilities Enabled

### 1. **card_payments**
- Ability to receive payments
- Process credit/debit cards
- Handle payment disputes

### 2. **transfers**
- Receive transfers from platform
- Withdraw to bank account
- View balance information

## Data Storage in Database

### User Model Fields
```javascript
{
  stripe_account_id: String,           // Stripe account ID
  stripe_account_status: String,       // Account status
  payout_enabled: Boolean,             // Can receive payouts
  payout_schedule: String,             // Manual/weekly/daily
  payout_day: Number,                  // Day of week/disbursement days
  disbursement_days: Number            // Days after booking
}
```

### Security Considerations
- All sensitive data handled by Stripe
- No bank details stored in our database
- PCI compliance handled by Stripe
- Encrypted communication with Stripe API

## Integration Points

### 1. Onboarding Flow
```
Provider clicks "Setup Payouts" → 
Create Stripe Account → 
Redirect to Stripe Onboarding → 
Handle Return Callback → 
Update Account Status
```

### 2. Payout Flow
```
Booking Completed → 
Admin Configures Payout → 
Create Payout Record → 
Process Transfer → 
Update Status
```

### 3. Dashboard Access
```
Provider requests dashboard → 
Create Login Link → 
Redirect to Stripe Express → 
Provider manages finances
```

## Compliance Requirements

### 1. KYC (Know Your Customer)
- Identity verification required
- Address verification
- Business verification

### 2. AML (Anti-Money Laundering)
- Transaction monitoring
- Suspicious activity reporting
- Risk assessment

### 3. Tax Reporting
- 1099-NEC forms (US)
- Tax information collection
- Reporting to tax authorities

## Error Handling

### Common Issues
1. **Incomplete Information**: Missing required fields
2. **Verification Failed**: Document issues
3. **Bank Account Problems**: Invalid account details
4. **Compliance Issues**: High-risk business types

### Resolution Steps
1. Notify provider of missing information
2. Provide guidance for verification
3. Allow re-submission of documents
4. Manual review by Stripe if needed

## Support Resources

### 1. Stripe Documentation
- [Connect Overview](https://stripe.com/docs/connect)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Identity Verification](https://stripe.com/docs/identity-verification)

### 2. Provider Support
- Onboarding assistance
- Document upload help
- Account status inquiries

### 3. Admin Tools
- Account status monitoring
- Manual review capabilities
- Payout management
