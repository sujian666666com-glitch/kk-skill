# Data Flow and Linkage Map

Use this after the main business flow is roughly understood, and again before final PRD output. The goal is to ensure a PRD explains how data moves and what each action links to, not only what pages and statuses exist.

## Four Flows

For complex requirements, separate four flows:

| Flow | Purpose | Output |
|---|---|---|
| Business flow | What users/systems do to complete the business outcome | Main process and branches |
| Object flow | How each business object is created, changes, and ends | Object lifecycle / state machine |
| Data flow | Where data comes from, how it is transformed, persisted, consumed, and written back | Data flow map |
| Linkage flow | What else changes when one action happens | Linkage / side-effect map |

Do not treat these as the same thing. A single business action may update multiple objects, create messages, change visibility, lock source data, update statistics, and trigger external sync.

## Data Flow Map

Use this table when data source, transformation, or downstream consumption is unclear:

| Data Item | Trigger / Step | Visible Source Mark | Source / Authority | Input Conditions | Transform / Rule | Validation | Persisted Object / Field | Consumer | Writeback / Sync | Timing | Failure Handling | Reality / Consistency Check | Confirm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Check:

- Source: manual input, selected records, imported file, synced system, API callback, generated rule, configuration, historical snapshot.
- Authority: which source wins when copied data differs from source data.
- Transform: aggregation, split, mapping, rounding, dedupe, status conversion, field derivation.
- Timing: real-time, scheduled sync, manual refresh, after audit, after payment, after callback, T+N.
- Consumer: list, detail, downstream object, report/statistic, notification, permission, external system.
- Writeback: whether status, amount, lock, result, timestamp, or error reason is returned to upstream objects.
- Reality / consistency: whether the named source exists in the flow, contains the data used, uses the same authority in every module, and has a defined update/snapshot rule.

If a data item is displayed or used but has no source/authority/consumer, mark it as "数据流待确认".

## Resource / Value Flow Map

Use this for any money or non-finance resource: inventory, coupon, quota, points, capacity, task slots, asset usage, content permission, membership rights, API usage, visibility, approval authority. A resource/value flow is data flow plus business conservation: the system must show where the resource comes from, when it is reserved, how it is allocated, when it is consumed, and how it is released.

| Resource / Value | Source | Authoritative Anchor | Owner / Pool | Trace Source | Eligibility | Reserve / Occupy Trigger | Allocate / Combine Rule | Partial Insufficiency Rule | Consume / Settle Trigger | Release / Reverse Rule | Role Perspective / Counterparty Visibility | Confirm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Rules:

- Do not invent an authoritative anchor. Pick the field/event that makes the resource belong to the business object, not the easiest timestamp in the system.
- Pool and trace are different. The pool controls current availability; trace explains where it came from. Do not require one-to-one pairing unless business rules need source-level locking.
- If users can combine multiple pools/sources, specify priority, split, ledger/status effect, and disabled reason when the combined amount/capacity/permission is still insufficient.
- Reserve and release are not finance-only. Inventory can be reserved, appointment slots can be held, coupons can be locked, quotas can be occupied, permissions can be granted/revoked.
- Role perspective matters: actor, owner, counterparty, approver, platform/admin, and tenant may see different totals, traces, disabled reasons, and history.

## Aggregation and Dimension Preservation Gate

Do not let a single total destroy useful business dimensions. A downstream step may use summary calculation while reports, audit, diagnosis, or profit analysis still need dimension analysis.

Use this when a PRD says "single total", "按总额", "不按车/不按明细", "汇总后传导", or when a detail dimension is removed.

| Decision | Must Define |
|---|---|
| Summary calculation | Which downstream object uses the single total and why it does not need detail allocation |
| Preserved dimensions | Which detail dimensions remain stored: vehicle dimension, customer/shipper, supplier, contract, route, project, tenant, period, cost type |
| Analysis use | Which pages/reports still support dimension analysis such as single-vehicle profit, customer profitability, supplier cost, exception diagnosis |
| Attribution rule | When a detail can map to a customer/vehicle/contract, whether it should be linked for analysis even if settlement uses total |
| Non-allocation boundary | Which downstream calculations explicitly do not allocate by detail, and what tradeoff that creates |
| Drilldown | How users jump from total to details and reconcile totals with detail sums |
| Historical change | Whether later mapping corrections rebuild only analysis dimensions or also downstream financial results |

Example: profit sharing may use a bill's single total for settlement, but the system can still keep vehicle dimension and customer mapping for single-vehicle profit analysis. Do not delete the detail dimension just because the settlement formula uses the total.

## Source Detail Eligibility Gate

Use this before any PRD says users or the system can select source details to generate a bill, reconciliation record, settlement record, payment request, invoice, profit-sharing record, or recovery batch. "Selectable source details" are not just list filters; they are financial input boundaries.

Define:

| Item | Must Define |
|---|---|
| Source detail object | order, waybill, cost item, income item, consumption item, bill line, payment line |
| Ownership scope | customer, supplier, contractor, project, route, organization, tenant, contract |
| Required business state | completed, signed, fee-confirmed, audited, payable, receivable, exception-free, not cancelled, not voided |
| Amount/source readiness | amount exists, formula source is available, currency/tax/rounding are defined, abnormal amount behavior is clear |
| Period eligibility | which attribution anchor and period boundary place the detail in the selectable window |
| Existing occupation | whether already selected by draft/pending/confirmed/paid/profit-shared records blocks reuse |
| Occupation timing | when selection creates occupation: draft save, submit, audit approval, payment, or receipt |
| Release rule | which reverse actions release occupation and which terminal states keep it occupied |
| Unavailable reason | how unavailable details are hidden or shown with a reason |
| Snapshot rule | whether generated records freeze source fields or follow later source/master-data changes |

If eligibility or occupation is undefined, do not write final wording like "select waybills" or "select orders". Mark it as source detail eligibility pending and ask the smallest question needed.

## Internal Generated Data

Treat internal data as sourced data, not as magic. For every system-generated record, status, statistic, snapshot, message, task, jump parameter, or derived amount, define:

| Generated Data | Trigger | Input Data | Generation Rule / Version | Persisted Object | Authority After Generation | Consumers | Rebuild / Correction | Failure Handling | Confirm |
|---|---|---|---|---|---|---|---|---|---|

If the PRD says "系统生成 / 自动生成 / 自动统计 / 自动同步", it must name the trigger, inputs, rule, persisted result, and what happens when inputs later change.

## Linkage Map

Use this table for every high-impact action:

| Action / Event | Primary Object | Linked Object / Module | Linkage Type | Change / Side Effect | Trigger Timing | Reverse / Rollback | User Visibility | Risk | Confirm |
|---|---|---|---|---|---|---|---|---|---|

Common linkage types:

- Object linkage: create/update/void/rebuild another object.
- State linkage: one object's state changes another object's status, visibility, or selectable scope.
- Data linkage: copied fields, aggregated amounts, snapshots, source-detail occupation.
- Amount/ledger linkage: balance, frozen amount, payable/receivable, invoice amount, settlement amount.
- Permission/visibility linkage: disabled data still visible historically, selectable scope changes, role-specific buttons.
- Page linkage: jump parameters, default filters, detail entry, empty target behavior.
- Notification/task linkage: message, to-do, approval task, exception task.
- Report/statistic linkage: counters, success rate, amount totals, dashboard metrics.
- External linkage: push, callback, sync, retry, dedupe, timeout.
- Audit/log linkage: operation record, before/after value, reason, operator, time.

## Payment Completion Side-Effect Gate

Payment success is often a business event, not only a payment status change. When a payment order comes from another business module, define the attached actions that run after payment completion and the failure behavior when those actions cannot finish.

Use this gate for finance and non-finance flows where a completion event unlocks downstream work: supplier payment completion, payroll payment, refund completion, subscription payment, booking deposit, inventory purchase, membership renewal, ad spend recharge, or any external payment/callback.

| Item | Must Define |
|---|---|
| Payment source | original business object, payment order, channel callback, auto-completed adjustment, or manual confirmation |
| Completion event | paid, partially paid, failed, refunded, voided, red-flushed, or callback confirmed |
| Attached actions | source object status writeback, supplier payroll detail output, invoice/write-off update, balance release, allocation creation, message, external push, report/statistic update |
| Idempotency | stable key for payment callback and each attached action; repeated callbacks must not repeat money, files, or pushes |
| Retry | which attached actions can retry, retry trigger, retry limit, manual retry entry, and what stays pending |
| Partial failure | whether payment stays completed while side effect is pending/failed, or whether compensation is required |
| Visibility | where users see payment result, attached action result, failure reason, and recovery button |
| Reverse | refund, cancel, void, red flush, or compensation effect on already completed attached actions |

Do not hide this under "after payment, linkage is handled automatically." The PRD must say what is linked, when it runs, how it is retried, and how operators recover it.

## Post-Event Writeback Gate

Use this whenever a transaction completion, approval, payment, refund, settlement, issuance, sync, import, cancellation, or external callback changes existing objects after the main record is created. Creating downstream records is not enough; the PRD must also list every existing field that is written back because those fields often drive the next business decision.

Build a writeback inventory:

| Item | Must Define |
|---|---|
| Source event | transaction completion, payment success, audit pass, refund success, batch created, external callback, sync completed, void/red flush, or manual correction |
| Source event timestamp | the authoritative event time used for writeback, display, period attribution, retry, and audit |
| Target object | original business object, related master data, account/ledger, contractor/driver/supplier/customer profile, summary/statistic record, source detail, report cache, or external system |
| Exact persisted field | field name in business language, previous value, new value, default/null behavior, and whether it is list/detail/search/export visible |
| Business period | if writing a month/period field, define which business period it represents and which event/date anchors it |
| Writeback policy | overwrite, keep max/latest, append, accumulate, clear, recompute, version, or block after lock |
| Consumer | which later page, eligibility rule, duplicate check, filter, statistic, settlement, or external push reads the field |
| Idempotency/concurrency | stable key, duplicate callback behavior, race handling, and whether repeated completion changes the field again |
| Reverse/correction behavior | refund, void, red flush, cancellation, correction, or re-sync effect; whether to rollback, recompute, preserve history, or create an adjustment |
| Visibility/recovery | where users can see the writeback result, failure reason, retry/rebuild entry, and audit history |

Example: after labor fee payment succeeds, it may create a value-added payroll batch, but that is not enough. If the business says payment success also updates last labor payment time and labor payment month on the contractor/driver/service relationship, the PRD must state the target object, exact persisted field, source event timestamp, business period, writeback policy, consumer, idempotency, and reverse/correction behavior.

Red flag: the PRD lists only created downstream records such as "create batch / create payment order / generate bill", but does not list field writebacks on existing objects. That usually hides eligibility, duplicate prevention, reporting, and next-period logic.

## Reverse Linkage

Every cancel, reject, refund, red flush, void, rollback, rebuild, disable, or re-sync must define:

| Reverse Action | Reverted Object | Released Lock / Occupation | Reverted Data | Recomputed Data | Not Reverted | Reason / Audit | Confirm |
|---|---|---|---|---|---|---|---|

If the forward action links to another object, the reverse action must say whether the linked object is rolled back, kept, voided, or rebuilt.

## Change Impact Questions

When a rule or flow changes, ask:

- Which existing objects are affected?
- Which source data must be reselected, recalculated, or re-synced?
- Which downstream objects need rollback, refresh, or versioning?
- Which pages, filters, counts, exports, and reports change?
- Which notifications, approvals, and external pushes are triggered or cancelled?
- Which historical records must remain visible for audit?

Avoid saying "同步更新 / 自动回滚 / 联动处理" without listing the linked objects, timing, and failure behavior.
