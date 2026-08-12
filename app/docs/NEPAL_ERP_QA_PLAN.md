# Nepal ERP QA plan

## Mandatory automated gates

- JavaScript syntax validation for every ERP runtime file
- static module-catalogue and UI contract validation
- workflow and cross-module relationship contract validation
- current Formcraft interaction audit
- current Nepal market, invoice and BS calendar audits
- current connected project-operations model tests
- authenticated Chromium regression on desktop and mobile
- Netlify build must fail closed when any required test fails

## Manual acceptance scenarios

### Essentials

- Create organisations and people with PAN/VAT data.
- Schedule an activity, request approval and archive/restore a record.
- Create an automation rule and confirm its configuration is preserved.

### Sales and finance

- Create a lead and convert it to an opportunity.
- Create quotation, confirm sales order, deliver and create invoice.
- Record partial and full payments and confirm outstanding values.
- Create an expense, approve it and create the payment record.
- Confirm NPR formatting and BS date references remain consistent.

### Purchase and stock

- Create supplier/RFQ, approve the purchase order and receive stock.
- Create vendor bill and confirm the linked accounting record.
- Create an inventory adjustment and a replenishment request.
- Create a manufacturing order, quality check and finished-stock movement.

### HR

- Create employee, attendance, time-off, appraisal and payroll-preview records.
- Confirm PAN, SSF, PF and CIT fields are retained.
- Verify viewer roles cannot perform edit or workflow actions.

### Services

- Create helpdesk ticket and convert it into a linked project task.
- Log a field-service job and create its invoice.
- Create a timesheet and confirm project time is updated.

### Websites, marketing and productivity

- Create pages, products, courses, posts, campaigns, events and surveys.
- Create a knowledge article, sign request, document and data-cleaning rule.
- Verify related records and activity history are visible.

## Release blockers

- any console or page error
- data loss after reload or remote state synchronization
- duplicate sequence identifiers
- broken relationship link
- workflow action that creates an orphan record
- viewer role able to mutate data
- accidental outside-click dismissal of a long form
- incorrect money, tax, inventory, payroll or accounting calculation
- unsupported claim of IRD, CBMS or payroll compliance

## Production monitoring

Track failed saves, version conflicts, rejected approvals, automation retries, orphaned links, duplicate sequences and browser runtime errors. The relational ERP migration must be applied and validated before financial, stock, payroll or manufacturing records are treated as authoritative ledgers.
