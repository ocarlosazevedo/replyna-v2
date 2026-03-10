INSERT INTO plans (name, description, price_monthly, emails_limit, shops_limit, features, is_active, slug, sort_order)
VALUES (
  'Free Trial',
  'Teste grátis por 7 dias',
  0,
  30,
  1,
  '["Integração com 1 loja","30 e-mails/mês inclusos","Atendimento 24 horas por dia"]'::jsonb,
  true,
  'trial',
  0
)
ON CONFLICT (slug) DO NOTHING;
