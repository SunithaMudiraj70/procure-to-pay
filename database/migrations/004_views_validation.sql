-- =====================================================================
-- 004_views_validation.sql
-- Derived balances, quote comparison, KPI views and rule-violation detection.
-- Violation views read only operational tables (never ground_truth).
-- =====================================================================

-- Budget balances computed from the ledger
create or replace view v_budget_balances as
select b.budget_id,
       b.department_id,
       b.fiscal_year,
       b.category,
       b.allocated_amount,
       coalesce(sum(case when l.entry_type = 'adjustment' then l.amount end), 0)             as adjustments,
       coalesce(sum(case when l.entry_type = 'reservation' then l.amount
                         when l.entry_type = 'reservation_release' then -l.amount end), 0)   as reserved_open,
       coalesce(sum(case when l.entry_type = 'commitment' then l.amount
                         when l.entry_type = 'commitment_release' then -l.amount end), 0)    as committed,
       b.allocated_amount
         + coalesce(sum(case when l.entry_type = 'adjustment' then l.amount end), 0)
         - coalesce(sum(case when l.entry_type = 'reservation' then l.amount
                             when l.entry_type = 'reservation_release' then -l.amount end), 0)
         - coalesce(sum(case when l.entry_type = 'commitment' then l.amount
                             when l.entry_type = 'commitment_release' then -l.amount end), 0) as available_amount
from budgets b
left join budget_ledger l on l.budget_id = b.budget_id
group by b.budget_id;

-- Side-by-side quote comparison per RFQ (landed cost in base currency + delivery time)
create or replace view v_quote_comparison as
select q.rfq_id,
       q.quote_id,
       q.supplier_id,
       s.name                      as supplier_name,
       s.status                    as supplier_status,
       s.risk_flag,
       q.currency_code,
       r.currency_code             as rfq_currency,
       q.total_landed_cost,
       q.total_landed_cost_base,
       q.delivery_days,
       q.valid_until,
       q.status                    as quote_status,
       rank() over (partition by q.rfq_id order by q.total_landed_cost_base) as cost_rank,
       rank() over (partition by q.rfq_id order by q.delivery_days)          as delivery_rank,
       (a.quote_id is not null)    as is_awarded,
       (q.currency_code <> r.currency_code) as currency_mismatch
from supplier_quotes q
join rfqs r      on r.rfq_id = q.rfq_id
join suppliers s on s.supplier_id = q.supplier_id
left join rfq_awards a on a.quote_id = q.quote_id;

-- Ordered vs received quantities per PO line
create or replace view v_po_receipt_status as
select pl.po_id,
       pl.po_line_id,
       pl.quantity                                   as qty_ordered,
       coalesce(sum(dl.qty_delivered - dl.qty_rejected), 0) as qty_accepted,
       pl.quantity - coalesce(sum(dl.qty_delivered - dl.qty_rejected), 0) as qty_outstanding
from purchase_order_lines pl
left join delivery_lines dl on dl.po_line_id = pl.po_line_id
group by pl.po_id, pl.po_line_id, pl.quantity;

-- Required approval level for each PR, from the threshold table
create or replace view v_pr_required_approval as
select pr.pr_id,
       pr.estimated_total,
       t.threshold_id,
       t.required_level
from purchase_requests pr
join approval_thresholds t
  on pr.estimated_total >= t.min_amount
 and (t.max_amount is null or pr.estimated_total < t.max_amount);

-- ---------------------------------------------------------------------
-- Rule violations (detected from operational data only)
-- ---------------------------------------------------------------------
create or replace view v_rule_violations as
-- PO issued without the approvals required by its PR's value
select 'po_without_approval'::text as issue_type, 'purchase_order'::text as entity_type, po.po_id as entity_id,
       'PR ' || po.pr_id || ' lacks required approvals before PO issue' as detail
from purchase_orders po
join v_pr_required_approval ra on ra.pr_id = po.pr_id
where po.status <> 'cancelled'
  and (select count(distinct a.approval_level) from approvals a
        where a.pr_id = po.pr_id and a.decision = 'approved'
          and a.decided_at::date <= po.issued_date) < ra.required_level

union all
-- Quote expired before award
select 'quote_expired_before_award', 'rfq_award', aw.award_id,
       'Quote ' || aw.quote_id || ' expired ' || q.valid_until || ' but awarded ' || aw.awarded_at::date
from rfq_awards aw
join supplier_quotes q on q.quote_id = aw.quote_id
where aw.awarded_at::date > q.valid_until

union all
-- Selected quote not the cheapest and no documented rationale
select 'non_cheapest_without_rationale', 'rfq_award', aw.award_id,
       'Awarded quote ' || aw.quote_id || ' is not lowest landed cost and has no rationale'
from rfq_awards aw
join supplier_quotes q on q.quote_id = aw.quote_id
where q.total_landed_cost_base >
        (select min(q2.total_landed_cost_base) from supplier_quotes q2
          where q2.rfq_id = aw.rfq_id and q2.status <> 'withdrawn')
  and (aw.rationale is null or btrim(aw.rationale) = '')

union all
-- PO to an inactive / blacklisted supplier
select 'supplier_inactive', 'purchase_order', po.po_id,
       'Supplier ' || s.supplier_id || ' is ' || s.status
from purchase_orders po
join suppliers s on s.supplier_id = po.supplier_id
where s.status in ('inactive', 'blacklisted')
  and coalesce(s.deactivated_on, date '1900-01-01') <= po.issued_date

union all
-- Budget overrun
select 'budget_overrun', 'budget', bb.budget_id,
       'Available amount is ' || bb.available_amount
from v_budget_balances bb
where bb.available_amount < 0

union all
-- Duplicate request (explicit link, or same requester/department/value within 7 days)
select 'duplicate_request', 'purchase_request', a.pr_id,
       'Possible duplicate of ' || coalesce(a.duplicate_of_pr_id, b.pr_id)
from purchase_requests a
left join purchase_requests b
       on b.requester_id = a.requester_id
      and b.department_id = a.department_id
      and b.estimated_total = a.estimated_total
      and b.pr_id < a.pr_id
      and abs(a.created_at::date - b.created_at::date) <= 7
where a.duplicate_of_pr_id is not null or b.pr_id is not null

union all
-- Quote currency differs from the RFQ comparison currency
select 'quote_currency_mismatch', 'supplier_quote', q.quote_id,
       'Quote currency ' || q.currency_code || ' vs RFQ currency ' || r.currency_code
from supplier_quotes q
join rfqs r on r.rfq_id = q.rfq_id
where q.currency_code <> r.currency_code

union all
-- Split purchase: several small PRs that together reach the competitive threshold
select 'split_purchase', 'purchase_request', pr.pr_id,
       'Split group ' || pr.split_group_id || ' totals ' || g.group_total
from purchase_requests pr
join (select split_group_id, count(*) as n, sum(estimated_total) as group_total
        from purchase_requests where split_group_id is not null
       group by split_group_id) g on g.split_group_id = pr.split_group_id
where g.n > 1
  and g.group_total >= (select param_value::numeric from policy_parameters where param_key = 'competitive_threshold')

union all
-- Competitive award with too few quotes
select 'insufficient_quotes', 'rfq', r.rfq_id,
       'Only ' || (select count(*) from supplier_quotes q where q.rfq_id = r.rfq_id) ||
       ' quotes, minimum ' || r.min_quotes_required
from rfqs r
where exists (select 1 from rfq_awards a where a.rfq_id = r.rfq_id)
  and (select count(*) from supplier_quotes q where q.rfq_id = r.rfq_id) < r.min_quotes_required

union all
-- PO line differs from the awarded quote line
select 'po_value_mismatch', 'purchase_order', pl.po_id,
       'PO line ' || pl.po_line_id || ' differs from quote line ' || pl.quote_line_id
from purchase_order_lines pl
join quote_lines ql on ql.quote_line_id = pl.quote_line_id
where pl.unit_price <> ql.unit_price or pl.quantity <> ql.quantity

union all
-- PO placed with a risk-flagged supplier
select 'supplier_risk_flag', 'purchase_order', po.po_id,
       'Supplier ' || s.supplier_id || ' risk: ' || coalesce(s.risk_reason, 'n/a')
from purchase_orders po
join suppliers s on s.supplier_id = po.supplier_id
where s.risk_flag;

-- ---------------------------------------------------------------------
-- KPI views for the dashboard
-- ---------------------------------------------------------------------
create or replace view v_kpi_overview as
select
    (select count(*) from purchase_requests)                                        as total_requests,
    (select count(*) from purchase_requests where status in ('submitted','pending_approval')) as pending_approval,
    (select count(*) from rfqs where status in ('issued','quotes_received','evaluated')) as open_rfqs,
    (select count(*) from purchase_orders where status not in ('closed','cancelled'))  as open_pos,
    (select coalesce(sum(total_amount), 0) from purchase_orders where status <> 'cancelled') as total_po_value,
    (select count(*) from exceptions where status = 'open')                         as open_exceptions,
    (select round(100.0 * count(*) filter (where d.actual_date <= d.scheduled_date)
                  / nullif(count(*) filter (where d.actual_date is not null), 0), 1)
       from deliveries d)                                                           as on_time_delivery_pct;

create or replace view v_spend_by_department as
select d.department_id, d.name as department,
       coalesce(sum(po.total_amount) filter (where po.status <> 'cancelled'), 0) as po_value,
       count(po.po_id) filter (where po.status <> 'cancelled')                   as po_count
from departments d
left join purchase_requests pr on pr.department_id = d.department_id
left join purchase_orders po   on po.pr_id = pr.pr_id
group by d.department_id, d.name;

create or replace view v_supplier_scorecard as
select s.supplier_id, s.name, s.status, s.risk_level,
       count(distinct q.quote_id)                                              as quotes_submitted,
       count(distinct a.award_id)                                              as awards_won,
       count(distinct po.po_id)                                                as po_count,
       round(100.0 * count(distinct d.delivery_id) filter (where d.actual_date <= d.scheduled_date)
             / nullif(count(distinct d.delivery_id) filter (where d.actual_date is not null), 0), 1) as on_time_pct
from suppliers s
left join supplier_quotes q   on q.supplier_id = s.supplier_id
left join rfq_awards a        on a.supplier_id = s.supplier_id
left join purchase_orders po  on po.supplier_id = s.supplier_id
left join deliveries d        on d.po_id = po.po_id
group by s.supplier_id, s.name, s.status, s.risk_level;
