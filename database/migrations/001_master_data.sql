-- =====================================================================
-- 001_master_data.sql
-- ID generators + master/reference tables
-- Departments, Requesters, Budgets, Suppliers, policy configuration
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Deterministic, zero-padded ID generation
--    PR-2026-000001 | RFQ-2026-000001 | QUO-<supplier-code>-2026-000001
--    PO-2026-000001 | DEL-<PO-id>-01
--    The data generator passes explicit IDs; the backend relies on defaults.
-- ---------------------------------------------------------------------
create table if not exists id_counters (
    counter_key text primary key,
    last_value  bigint not null default 0
);

create or replace function next_counter(p_key text) returns bigint
language plpgsql as $$
declare v bigint;
begin
    insert into id_counters (counter_key, last_value) values (p_key, 1)
    on conflict (counter_key)
    do update set last_value = id_counters.last_value + 1
    returning last_value into v;
    return v;
end $$;

-- PREFIX-YYYY-NNNNNN
create or replace function next_year_id(p_prefix text, p_year int default 2026, p_width int default 6)
returns text language sql as $$
    select p_prefix || '-' || p_year || '-' ||
           lpad(next_counter(p_prefix || '-' || p_year)::text, p_width, '0');
$$;

-- PREFIX-NNNNNN (master data with no year)
create or replace function next_simple_id(p_prefix text, p_width int default 6)
returns text language sql as $$
    select p_prefix || '-' || lpad(next_counter(p_prefix)::text, p_width, '0');
$$;

-- QUO-<supplier-code>-YYYY-NNNNNN
create or replace function next_quote_id(p_supplier_code text, p_year int default 2026)
returns text language sql as $$
    select 'QUO-' || upper(p_supplier_code) || '-' || p_year || '-' ||
           lpad(next_counter('QUO-' || p_year)::text, 6, '0');
$$;

-- DEL-<PO-id>-NN
create or replace function next_delivery_id(p_po_id text)
returns text language sql as $$
    select 'DEL-' || p_po_id || '-' || lpad(next_counter('DEL-' || p_po_id)::text, 2, '0');
$$;

-- generic updated_at touch
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Departments  (1:N Requesters, 1:N Budgets, 1:N PurchaseRequests)
-- ---------------------------------------------------------------------
create table departments (
    department_id  text primary key default next_simple_id('DEP', 3)
                   check (department_id ~ '^DEP-[0-9]{3}$'),
    name           text not null unique,
    cost_center    text not null unique,
    status         text not null default 'active' check (status in ('active', 'inactive')),
    effective_from date not null default date '2026-01-01',
    effective_to   date,
    created_at     timestamptz not null default now(),
    check (effective_to is null or effective_to >= effective_from)
);

-- ---------------------------------------------------------------------
-- 3. Requesters (also the "user" table: requesters, approvers, analysts, admins)
-- ---------------------------------------------------------------------
create table requesters (
    requester_id    text primary key default next_simple_id('RQT', 6)
                    check (requester_id ~ '^RQT-[0-9]{6}$'),
    employee_code   text not null unique,
    full_name       text not null,
    email           text not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    department_id   text not null references departments(department_id),
    role            text not null default 'requester'
                    check (role in ('requester','approver','process_owner','operations_analyst','system_admin')),
    approval_level  smallint check (approval_level between 1 and 4),   -- 1 Dept Mgr, 2 Proc Head, 3 Finance Dir, 4 CFO
    is_active       boolean not null default true,
    hired_on        date not null default date '2020-01-01',
    created_at      timestamptz not null default now(),
    check (role <> 'approver' or approval_level is not null)
);
create index idx_requesters_department on requesters(department_id);

alter table departments
    add column head_requester_id text references requesters(requester_id);

-- ---------------------------------------------------------------------
-- 4. Budgets  (1 Department : N Budgets; spend tracked in budget_ledger)
-- ---------------------------------------------------------------------
create table budgets (
    budget_id        text primary key default next_year_id('BUD', 2026, 4)
                     check (budget_id ~ '^BUD-[0-9]{4}-[0-9]{4}$'),
    department_id    text not null references departments(department_id),
    fiscal_year      smallint not null check (fiscal_year between 2020 and 2100),
    category         text,                                  -- NULL = all categories
    allocated_amount numeric(14,2) not null check (allocated_amount > 0),
    currency_code    char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
    effective_from   date not null,
    effective_to     date not null,
    status           text not null default 'active' check (status in ('draft','active','frozen','closed')),
    created_at       timestamptz not null default now(),
    check (effective_to >= effective_from)
);
create unique index uq_budget_dept_year_cat
    on budgets (department_id, fiscal_year, coalesce(category, '*'));

-- ---------------------------------------------------------------------
-- 5. Suppliers  (+ N:M bridge to categories)
-- ---------------------------------------------------------------------
create table suppliers (
    supplier_id        text primary key default next_simple_id('SUP', 6)
                       check (supplier_id ~ '^SUP-[0-9]{6}$'),
    supplier_code      text not null unique check (supplier_code ~ '^[A-Z0-9]{3,10}$'),  -- used in QUO ids
    name               text not null,
    country_code       char(2) not null check (country_code ~ '^[A-Z]{2}$'),
    default_currency   char(3) not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
    payment_terms_days smallint not null default 30 check (payment_terms_days between 0 and 180),
    status             text not null default 'active'
                       check (status in ('onboarding','active','inactive','blacklisted')),
    risk_level         text not null default 'low' check (risk_level in ('low','medium','high','critical')),
    risk_flag          boolean not null default false,
    risk_reason        text,
    onboarded_on       date not null default date '2024-01-01',
    deactivated_on     date,
    created_at         timestamptz not null default now(),
    check (not risk_flag or risk_reason is not null),            -- every flag has a reason
    check (deactivated_on is null or deactivated_on >= onboarded_on)
);

create table supplier_categories (
    supplier_id text not null references suppliers(supplier_id) on delete cascade,
    category    text not null,
    primary key (supplier_id, category)
);

-- ---------------------------------------------------------------------
-- 6. Policy configuration (documented rules, not hard-coded magic numbers)
-- ---------------------------------------------------------------------
create table policy_parameters (
    param_key   text primary key,
    param_value text not null,
    description text not null
);

-- Approval thresholds: amount in [min_amount, max_amount)  (min inclusive, max exclusive)
-- A request needs approved decisions from levels 1..required_level.
create table approval_thresholds (
    threshold_id   smallint primary key,
    name           text not null,
    min_amount     numeric(14,2) not null check (min_amount >= 0),
    max_amount     numeric(14,2),                      -- NULL = unbounded
    required_level smallint not null check (required_level between 1 and 4),
    effective_from date not null default date '2026-01-01',
    effective_to   date,
    check (max_amount is null or max_amount > min_amount)
);
