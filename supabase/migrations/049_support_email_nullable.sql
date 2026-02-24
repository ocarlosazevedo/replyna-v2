-- support_email is no longer required - imap_user is used by the system
ALTER TABLE shops ALTER COLUMN support_email DROP NOT NULL;
