#!/bin/bash
set -e

# Deploy all Supabase Edge Functions with JWT verification disabled at the gateway.
# WARNING: Only safe if each function implements its own auth checks or is intended to be public.

FUNCTIONS=(
  "accept-migration-invite"
  "accept-migration-invite-stripe"
  "admin-check-auth-user"
  "admin-conversation-details"
  "admin-create-client"
  "admin-dashboard-stats"
  "admin-delete-client"
  "admin-delete-client-stripe"
  "admin-generate-password-link"
  "admin-get-clients"
  "admin-impersonate-user"
  "admin-login"
  "admin-migration-invites"
  "admin-send-reset-password"
  "cancel-subscription"
  "charge-extra-emails"
  "charge-extra-emails-stripe"
  "cleanup-queue"
  "create-asaas-subscription"
  "create-billing-portal"
  "create-billing-portal-stripe"
  "create-checkout-session"
  "debug-shops"
  "diagnostic-cron"
  "fetch-emails"
  "fix-customer-names"
  "fix-email-html"
  "fix-encoding"
  "get-financial-stats"
  "get-financial-stats-stripe"
  "get-user-profile"
  "migrate-passwords"
  "pay-pending-invoice"
  "pay-pending-invoice-stripe"
  "process-emails"
  "process-pending-credits"
  "process-pending-migrations"
  "process-queue"
  "process-shop-emails"
  "reprocess-message"
  "stripe-debug"
  "stripe-webhook"
  "sync-coupon"
  "sync-coupon-stripe"
  "sync-stripe-customer"
  "test-image-extraction"
  "test-imap-connection"
  "test-shop-connection"
  "translate-message"
  "update-payment-method"
  "update-subscription"
  "update-subscription-stripe"
  "validate-migration-token"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying ${fn}..."
  supabase functions deploy "${fn}" --no-verify-jwt
  echo "Done: ${fn}"
done

echo "All functions deployed."
