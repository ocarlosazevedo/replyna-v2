ALTER TABLE plans ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

UPDATE plans SET slug = 'starter'    WHERE name = 'Starter';
UPDATE plans SET slug = 'business'   WHERE name = 'Business';
UPDATE plans SET slug = 'scale'      WHERE name = 'Scale';
UPDATE plans SET slug = 'high-scale' WHERE name = 'High Scale';
UPDATE plans SET slug = 'enterprise' WHERE name = 'Enterprise';
