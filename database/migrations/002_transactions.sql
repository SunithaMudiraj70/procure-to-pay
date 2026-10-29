-- =====================================================================
-- 002_transactions.sql
-- PurchaseRequest -> RFQ -> SupplierQuote -> Award -> Approval -> PO -> Delivery
-- Structural integrity is enforced by constraints. Business-rule violations
-- (needed for labelled edge cases) are representable, and are detected by the
-- views in 004_views_validation.sql instead of being silently blocked.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Purchase requests (1 Requester : N PR, 1 PR : N RequestLine)
-- ---------------------------------------------------------------------
create table purchase_requests (
    pr_id                       text primary key default next_year_id('PR')
                                check (pr_id ~ '^PR-[0-9]{4}-[0-9]{6}$'),
    requester_id                text not null references requesters(requester_id),
    department_id               text not null references departments(department_id),
    budget_id                   text not null references budgets(budget_id),
    title                       text not null,
    justification               text,
    procurement_type            text not null default 'competitive'
                                check (procurement_type in ('competitive','single_source','direct_low_value')),
    single_source_justification text,
    currency_code               char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
    estimated_total             numeric(14,2) not null default 0 check (estimated_total >= 0),  -- derived from lines
    priority                    text not null default 'normal' check (priority in ('low','normal','high','urgent')),
    needed_by_date              date,
    status                      text not null default 'draft'
                                check (status in ('draft','submitted','pending_approval','approved','rejected',
                                                  'rfq_issued','awarded','po_issued','partially_delivered',
                                                  'delivered','closed','cancelled')),
    split_group_id              text,                                   -- same value = suspected split purchase
    duplicate_of_pr_id          text references purchase_requests(pr_id),
    submitted_at                timestamptz,
    approved_at                 timestamptz,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now(),
    check (procurement_type <> 'single_source' or single_source_justification is not null),
    check (duplicate_of_pr_id is null or duplicate_of_pr_id <> pr_id),
    check (approved_at is null or submitted_at is null or approved_at >= submitted_at)
);
create index idx_pr_requester on purchase_requests(requester_id);
create index idx_pr_department on purchase_requests(department_id);
create index idx_pr_budget on purchase_requests(budget_id);
create index idx_pr_status on purchase_requests(status);
create index idx_pr_split_group on purchase_requests(split_group_id) where split_group_id is not null;

create table request_lines (
    request_line_id     text primary key check (request_line_id ~ '^PR-[0-9]{4}-[0-9]{6}-L[0-9]{2}$'),
    pr_id               text not null references purchase_requests(pr_id) on delete cascade,
    line_no             smallint not null check (line_no > 0),
    item_code           text not null,
    description         text not null,
    category            text not null,
    quantity            numeric(12,2) not null check (quantity > 0),
    uom                 text not null default 'EA',
    estimated_unit_cost numeric(14,2) not null check (estimated_unit_cost >= 0),
    estimated_line_cost numeric(14,2) generated always as (round(quantity * estimated_unit_cost, 2)) stored,
    unique (pr_id, line_no),
    check (request_line_id = pr_id || '-L' || lpad(line_no::text, 2, '0'))
);
create index idx_request_lines_pr on request_lines(pr_id);

-- ---------------------------------------------------------------------
-- 2. RFQs (N:M with request lines via bridge; N:M with suppliers via invitations)
-- ---------------------------------------------------------------------
create table rfqs (
    rfq_id             text primary key default next_year_id('RFQ')
                       check (rfq_id ~ '^RFQ-[0-9]{4}-[0-9]{6}$'),
    created_by         text not null references requesters(requester_id),
    currency_code      char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),  -- comparison currency
    issue_date         date not null,
    closing_date       date not null,
    min_quotes_required smallint not null default 3 check (min_quotes_required >= 1),
    status             text not null default 'draft'
                       check (status in ('draft','issued','quotes_received','evaluated','awarded','cancelled','closed')),
    notes              text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    check (closing_date >= issue_date)
);

create table rfq_request_lines (
    rfq_id          text not null references rfqs(rfq_id) on delete cascade,
    request_line_id text not null references request_lines(request_line_id),
    primary key (rfq_id, request_line_id)
);
create index idx_rfq_lines_line on rfq_request_lines(request_line_id);

create table rfq_suppliers (
    rfq_id          text not null references rfqs(rfq_id) on delete cascade,
    supplier_id     text not null references suppliers(supplier_id),
    invited_on      date not null,
    response_status text not null default 'invited'
                    check (response_status in ('invited','quoted','declined','no_response')),
    primary key (rfq_id, supplier_id)
);

-- ---------------------------------------------------------------------
-- 3. Supplier quotes (1 RFQ : N quotes, 1 quote : N quote lines)
-- ---------------------------------------------------------------------
create table supplier_quotes (
    quote_id              text primary key check (quote_id ~ '^QUO-[A-Z0-9]{3,10}-[0-9]{4}-[0-9]{6}$'),
    rfq_id                text not null references rfqs(rfq_id),
    supplier_id           text not null references suppliers(supplier_id),
    quote_date            date not null,
    valid_until           date not null,
    currency_code         char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
    fx_rate_to_base       numeric(12,6) not null default 1 check (fx_rate_to_base > 0),
    subtotal              numeric(14,2) not null default 0 check (subtotal >= 0),   -- derived from quote_lines
    freight_cost          numeric(14,2) not null default 0 check (freight_cost >= 0),
    duty_cost             numeric(14,2) not null default 0 check (duty_cost >= 0),
    other_charges         numeric(14,2) not null default 0 check (other_charges >= 0),
    total_landed_cost     numeric(14,2) generated always as (subtotal + freight_cost + duty_cost + other_charges) stored,
    total_landed_cost_base numeric(14,2) generated always as
                          (round((subtotal + freight_cost + duty_cost + other_charges) * fx_rate_to_base, 2)) stored,
    delivery_days         smallint not null check (delivery_days > 0),
    payment_terms_days    smallint not null default 30 check (payment_terms_days >= 0),
    status                text not null default 'submitted'
                          check (status in ('submitted','under_review','awarded','rejected','expired','withdrawn')),
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    unique (rfq_id, supplier_id),
    unique (quote_id, rfq_id),                       -- target of composite FKs below
    check (valid_until >= quote_date)
);
create index idx_quotes_rfq on supplier_quotes(rfq_id);
create index idx_quotes_supplier on supplier_quotes(supplier_id);

create table quote_lines (
    quote_line_id   text primary key,
    quote_id        text not null references supplier_quotes(quote_id) on delete cascade,
    line_no         smallint not null check (line_no > 0),
    request_line_id text not null references request_lines(request_line_id),
    quantity        numeric(12,2) not null check (quantity > 0),
    unit_price      numeric(14,2) not null check (unit_price >= 0),
    line_total      numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
    unique (quote_id, line_no),
    unique (quote_id, request_line_id),
    check (quote_line_id = quote_id || '-L' || lpad(line_no::text, 2, '0'))
);

-- Quote comparison snapshots (history is kept; each evaluation_run is a new set of rows)
create table quote_evaluations (
    evaluation_id          bigint generated always as identity primary key,
    rfq_id                 text not null references rfqs(rfq_id),
    quote_id               text not null references supplier_quotes(quote_id),
    evaluation_run         smallint not null default 1,
    total_landed_cost_base numeric(14,2) not null,
    delivery_days          smallint not null,
    cost_rank              smallint not null,
    delivery_rank          smallint not null,
    weighted_score         numeric(7,4) not null,
    is_lowest_cost         boolean not null,
    is_fastest             boolean not null,
    is_eligible            boolean not null default true,
    ineligibility_reason   text,
    evaluated_by           text references requesters(requester_id),
    evaluated_at           timestamptz not null default now(),
    unique (quote_id, evaluation_run),
    check (is_eligible or ineligibility_reason is not null)
);
create index idx_eval_rfq on quote_evaluations(rfq_id);

-- Award decision: one winning quote per RFQ, with an explanation
create table rfq_awards (
    award_id      text primary key default next_year_id('AWD')
                  check (award_id ~ '^AWD-[0-9]{4}-[0-9]{6}$'),
    rfq_id        text not null unique references rfqs(rfq_id),
    quote_id      text not null,
    supplier_id   text not null references suppliers(supplier_id),
    awarded_by    text not null references requesters(requester_id),
    awarded_at    timestamptz not null,
    award_basis   text not null check (award_basis in
                  ('lowest_landed_cost','best_weighted_score','fastest_delivery','sole_source','other')),
    is_lowest_cost boolean not null,
    rationale     text,
    foreign key (quote_id, rfq_id) references supplier_quotes(quote_id, rfq_id)
);

-- ---------------------------------------------------------------------
-- 4. Approvals (1 PR : N approval steps, one per required level)
-- ---------------------------------------------------------------------
create table approvals (
    approval_id    text primary key default next_year_id('APR')
                   check (approval_id ~ '^APR-[0-9]{4}-[0-9]{6}$'),
    pr_id          text not null references purchase_requests(pr_id),
    approval_level smallint not null check (approval_level between 1 and 4),
    approver_id    text not null references requesters(requester_id),
    threshold_id   smallint references approval_thresholds(threshold_id),
    decision       text not null default 'pending'
                   check (decision in ('pending','approved','rejected','escalated')),
    requested_at   timestamptz not null default now(),
    decided_at     timestamptz,
    comments       text,
    unique (pr_id, approval_level),
    check (decision = 'pending' or decided_at is not null),
    check (decided_at is null or decided_at >= requested_at)
);
create index idx_approvals_pr on approvals(pr_id);

-- ---------------------------------------------------------------------
-- 5. Purchase orders (rfq/quote optional: single-source & low-value POs have none)
-- ---------------------------------------------------------------------
create table purchase_orders (
    po_id                text primary key default next_year_id('PO')
                         check (po_id ~ '^PO-[0-9]{4}-[0-9]{6}$'),
    pr_id                text not null references purchase_requests(pr_id),
    rfq_id               text references rfqs(rfq_id),
    quote_id             text,
    award_id             text references rfq_awards(award_id),
    supplier_id          text not null references suppliers(supplier_id),
    issued_by            text not null references requesters(requester_id),
    po_type              text not null default 'competitive'
                         check (po_type in ('competitive','single_source','direct_low_value')),
    currency_code        char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
    subtotal             numeric(14,2) not null default 0 check (subtotal >= 0),   -- derived from po_lines
    freight_cost         numeric(14,2) not null default 0 check (freight_cost >= 0),
    duty_cost            numeric(14,2) not null default 0 check (duty_cost >= 0),
    other_charges        numeric(14,2) not null default 0 check (other_charges >= 0),
    total_amount         numeric(14,2) generated always as (subtotal + freight_cost + duty_cost + other_charges) stored,
    payment_terms_days   smallint not null default 30,
    issued_date          date not null,
    expected_delivery_date date not null,
    status               text not null default 'draft'
                         check (status in ('draft','issued','acknowledged','partially_delivered',
                                           'delivered','closed','cancelled')),
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    foreign key (quote_id, rfq_id) references supplier_quotes(quote_id, rfq_id),
    check (expected_delivery_date >= issued_date),
    check (po_type <> 'competitive' or quote_id is not null),
    check ((quote_id is null) = (rfq_id is null))
);
create index idx_po_pr on purchase_orders(pr_id);
create index idx_po_supplier on purchase_orders(supplier_id);
create index idx_po_status on purchase_orders(status);

create table purchase_order_lines (
    po_line_id      text primary key,
    po_id           text not null references purchase_orders(po_id) on delete cascade,
    line_no         smallint not null check (line_no > 0),
    request_line_id text not null references request_lines(request_line_id),
    quote_line_id   text references quote_lines(quote_line_id),
    description     text not null,
    quantity        numeric(12,2) not null check (quantity > 0),
    unit_price      numeric(14,2) not null check (unit_price >= 0),
    line_total      numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
    unique (po_id, line_no),
    check (po_line_id = po_id || '-L' || lpad(line_no::text, 2, '0'))
);

-- ---------------------------------------------------------------------
-- 6. Deliveries (1 PO : N deliveries -> partial deliveries; 1 delivery : N lines)
--    DEL-<PO-id>-NN, e.g. DEL-PO-2026-000001-01
-- ---------------------------------------------------------------------
create table deliveries (
    delivery_id    text primary key,
    po_id          text not null references purchase_orders(po_id),
    delivery_seq   smallint not null check (delivery_seq > 0),
    scheduled_date date not null,
    actual_date    date,
    status         text not null default 'scheduled'
                   check (status in ('scheduled','in_transit','partial','delivered','delayed','rejected','cancelled')),
    carrier        text,
    tracking_ref   text,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique (po_id, delivery_seq),
    check (delivery_id = 'DEL-' || po_id || '-' || lpad(delivery_seq::text, 2, '0')),
    check (status not in ('partial','delivered') or actual_date is not null)
);
create index idx_deliveries_po on deliveries(po_id);

create table delivery_lines (
    delivery_line_id bigint generated always as identity primary key,
    delivery_id      text not null references deliveries(delivery_id) on delete cascade,
    po_line_id       text not null references purchase_order_lines(po_line_id),
    qty_delivered    numeric(12,2) not null check (qty_delivered >= 0),
    qty_rejected     numeric(12,2) not null default 0 check (qty_rejected >= 0),
    unique (delivery_id, po_line_id),
    check (qty_rejected <= qty_delivered)
);

-- ---------------------------------------------------------------------
-- 7. Derived-value triggers (totals are calculated from source lines)
-- ---------------------------------------------------------------------
create or replace function recalc_pr_total() returns trigger
language plpgsql as $$
declare v_pr text := coalesce(new.pr_id, old.pr_id);
begin
    update purchase_requests
       set estimated_total = coalesce((select sum(estimated_line_cost) from request_lines where pr_id = v_pr), 0)
     where pr_id = v_pr;
    return null;
end $$;
create trigger trg_request_lines_total
    after insert or update or delete on request_lines
    for each row execute function recalc_pr_total();

create or replace function recalc_quote_subtotal() returns trigger
language plpgsql as $$
declare v_q text := coalesce(new.quote_id, old.quote_id);
begin
    update supplier_quotes
       set subtotal = coalesce((select sum(line_total) from quote_lines where quote_id = v_q), 0)
     where quote_id = v_q;
    return null;
end $$;
create trigger trg_quote_lines_subtotal
    after insert or update or delete on quote_lines
    for each row execute function recalc_quote_subtotal();

create or replace function recalc_po_subtotal() returns trigger
language plpgsql as $$
declare v_po text := coalesce(new.po_id, old.po_id);
begin
    update purchase_orders
       set subtotal = coalesce((select sum(line_total) from purchase_order_lines where po_id = v_po), 0)
     where po_id = v_po;
    return null;
end $$;
create trigger trg_po_lines_subtotal
    after insert or update or delete on purchase_order_lines
    for each row execute function recalc_po_subtotal();

create trigger trg_pr_touch  before update on purchase_requests for each row execute function touch_updated_at();
create trigger trg_rfq_touch before update on rfqs             for each row execute function touch_updated_at();
create trigger trg_quo_touch before update on supplier_quotes  for each row execute function touch_updated_at();
create trigger trg_po_touch  before update on purchase_orders  for each row execute function touch_updated_at();
create trigger trg_del_touch before update on deliveries       for each row execute function touch_updated_at();
