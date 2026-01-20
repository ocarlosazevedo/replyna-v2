-- Migration: Adiciona event_type 'spam_detected' ao constraint email_processing_logs
-- Este evento é registrado quando um email é classificado como spam pela IA

-- Remove o constraint antigo
ALTER TABLE email_processing_logs DROP CONSTRAINT IF EXISTS email_processing_logs_event_type_check;

-- Adiciona o novo constraint com 'spam_detected'
ALTER TABLE email_processing_logs ADD CONSTRAINT email_processing_logs_event_type_check CHECK (event_type IN (
    'email_received',
    'email_classified',
    'shopify_lookup',
    'response_generated',
    'response_sent',
    'forwarded_to_human',
    'credits_exhausted',
    'data_requested',
    'spam_detected',
    'error'
));
