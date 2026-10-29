-- =====================================================================
-- 005_seed_policy_and_security.sql
-- Policy parameters, approval thresholds, and Row Level Security
-- =====================================================================

insert into policy_parameters (param_key, param_value, description) values
 ('base_currency',               'USD', 'Currency used to compare quotes and report spend'),
 ('fiscal_year',                 '2026','Current fiscal year used in ID nomenclature'),
 ('competitive_threshold',       '5000','Requests at or above this value must be competitively sourced'),
 ('min_quotes_competitive',      '3',   'Minimum supplier quotes for a competitive purchase'),
 ('quote_validity_days_default', '30',  'Default quote validity window'),
 ('split_purchase_window_days',  '14',  'Window for detecting split purchases'),
 ('duplicate_window_days',       '7',   'Window for detecting duplicate requests'),
 ('score_weight_cost',           '0.70','Weight of landed cost in weighted quote score'),
 ('score_weight_delivery',       '0.30','Weight of delivery time in weighted quote score')
on conflict (param_key) do nothing;

-- Amount in [min, max). Approvals needed from levels 1..required_level.
insert into approval_thresholds (threshold_id, name, min_amount, max_amount, required_level) values
 (1, 'Department Manager',          0,      5000,   1),
 (2, 'Procurement Head',            5000,   25000,  2),
 (3, 'Finance Director',            25000,  100000, 3),
 (4, 'CFO',                         100000, null,   4)
on conflict (threshold_id) do nothing;

-- ---------------------------------------------------------------------
-- Row Level Security: the Supabase anon/authenticated keys get NO direct
-- table access. All reads/writes go through the backend (service role / pg).
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
    for t in select schemaname, tablename from pg_tables
              where schemaname in ('public', 'ground_truth')
                and tablename <> 'schema_migrations' loop
        execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    end loop;

    -- Supabase-only roles: lock the ground truth schema away from client keys
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on schema ground_truth from anon, authenticated;
        revoke all on all tables in schema ground_truth from anon, authenticated;
    end if;
end $$;
