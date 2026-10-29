-- =====================================================================
-- 003_events_audit.sql
-- Append-only history: status events, budget ledger, exception register.
-- Separate "ground_truth" schema for labelled anomalies (never used as features).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Status events (state changes are recorded, never overwritten)
-- ---------------------------------------------------------------------
create table status_events (
    event_id    bigint generated always as identity primary key,
    entity_type text not null check (entity_type in
                ('purchase_request','rfq','supplier_quote','purchase_order','delivery','approval','exception')),
    entity_id   text not null,
    from_status text,
    to_status   text not null,
    actor_id    text references requesters(requester_id),
    reason      text,
    event_at    timestamptz not null default now(),
    metadata    jsonb not null default '{}'::jsonb
);
create index idx_status_events_entity on status_events(entity_type, entity_id, event_at);

-- Auto-log status changes on UPDATE. Set a reason from the API with:
--   select set_config('app.change_reason', 'why', true);
-- Bulk loaders write explicit events and may bypass this with
--   set session_replication_role = replica;
create or replace function log_status_change() returns trigger
language plpgsql as $$
begin
    if new.status is distinct from old.status then
        insert into status_events (entity_type, entity_id, from_status, to_status, reason)
        values (tg_argv[0], to_jsonb(new) ->> tg_argv[1], old.status, new.status,
                current_setting('app.change_reason', true));
    end if;
    return new;
end $$;

create trigger trg_pr_status  after update of status on purchase_requests
    for each row execute function log_status_change('purchase_request', 'pr_id');
create trigger trg_rfq_status after update of status on rfqs
    for each row execute function log_status_change('rfq', 'rfq_id');
create trigger trg_quo_status after update of status on supplier_quotes
    for each row execute function log_status_change('supplier_quote', 'quote_id');
create trigger trg_po_status  after update of status on purchase_orders
    for each row execute function log_status_change('purchase_order', 'po_id');
create trigger trg_del_status after update of status on deliveries
    for each row execute function log_status_change('delivery', 'delivery_id');

-- ---------------------------------------------------------------------
-- 2. Budget ledger (reservation / commitment history)
--    available = allocation + adjustment
--                - (reservation - reservation_release)
--                - (commitment  - commitment_release)
-- ---------------------------------------------------------------------
create table budget_ledger (
    ledger_id  bigint generated always as identity primary key,
    budget_id  text not null references budgets(budget_id),
    entry_type text not null check (entry_type in
               ('allocation','adjustment','reservation','reservation_release',
                'commitment','commitment_release')),
    amount     numeric(14,2) not null,                -- positive; sign is implied by entry_type
    pr_id      text references purchase_requests(pr_id),
    po_id      text references purchase_orders(po_id),
    entry_date date not null,
    notes      text,
    created_at timestamptz not null default now(),
    check (entry_type = 'adjustment' or amount > 0),
    check (entry_type not in ('reservation','reservation_release') or pr_id is not null),
    check (entry_type not in ('commitment','commitment_release') or po_id is not null)
);
create index idx_ledger_budget on budget_ledger(budget_id, entry_date);
create index idx_ledger_pr on budget_ledger(pr_id);
create index idx_ledger_po on budget_ledger(po_id);

-- ---------------------------------------------------------------------
-- 3. Exception register (operational: what the system detected/flagged and why)
-- ---------------------------------------------------------------------
create table exceptions (
    exception_id    text primary key default next_year_id('EXC')
                    check (exception_id ~ '^EXC-[0-9]{4}-[0-9]{6}$'),
    issue_type      text not null check (issue_type in
                    ('po_without_approval','quote_expired_before_award','non_cheapest_without_rationale',
                     'supplier_inactive','budget_overrun','duplicate_request','quote_currency_mismatch',
                     'single_source','split_purchase','supplier_risk_flag','partial_delivery',
                     'insufficient_quotes','po_value_mismatch','quote_expired')),
    entity_type     text not null,
    entity_id       text not null,
    severity        text not null default 'medium' check (severity in ('low','medium','high','critical')),
    reason          text not null,                        -- every exception has a reason
    status          text not null default 'open'
                    check (status in ('open','acknowledged','resolved','waived')),
    detected_by     text not null default 'system',
    detected_at     timestamptz not null default now(),
    resolved_by     text references requesters(requester_id),
    resolved_at     timestamptz,
    resolution_note text,
    check (status not in ('resolved','waived') or (resolved_at is not null and resolution_note is not null))
);
create index idx_exceptions_entity on exceptions(entity_type, entity_id);
create index idx_exceptions_type on exceptions(issue_type, status);

-- ---------------------------------------------------------------------
-- 4. Ground truth (kept in its own schema; never joined into feature views)
-- ---------------------------------------------------------------------
create schema if not exists ground_truth;

create table ground_truth.anomaly_labels (
    label_id          bigint generated always as identity primary key,
    issue_type        text not null,
    entity_type       text not null,
    entity_id         text not null,
    is_anomaly        boolean not null default true,
    expected_decision text,                               -- e.g. 'reject_po', 'require_rationale'
    expected_reason   text not null,
    injected_by_rule  text not null,
    generator_seed    integer not null,
    created_at        timestamptz not null default now()
);
create index idx_gt_entity on ground_truth.anomaly_labels(entity_type, entity_id);
