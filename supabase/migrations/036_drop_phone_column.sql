-- Remove coluna phone (não utilizada) da tabela users
ALTER TABLE users DROP COLUMN IF EXISTS phone;
