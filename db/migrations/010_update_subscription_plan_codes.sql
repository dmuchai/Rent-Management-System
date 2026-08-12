alter table public.billing_accounts
  drop constraint if exists billing_accounts_plan_code_check;

update public.billing_accounts
set plan_code = case plan_code
  when 'starter' then 'bronze'
  when 'growth' then 'silver'
  when 'professional' then 'gold'
  else plan_code
end
where plan_code in ('starter', 'growth', 'professional');

alter table public.billing_accounts
  add constraint billing_accounts_plan_code_check
  check (plan_code in ('free', 'bronze', 'silver', 'gold', 'enterprise'));
