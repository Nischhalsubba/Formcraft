# Formcraft connected operations test plan

## Test data

Create one customer-facing project with:

- two owners or collaborators;
- six tasks distributed across all workflow states;
- one milestone;
- one parent task with two subtasks;
- one dependency;
- one checklist;
- one comment;
- one billable and one non-billable time entry;
- one project event;
- one project file;
- one draft invoice and one issued/paid invoice.

## Project workflow

1. Open a project from search, project list and report.
2. Confirm all three entry points open the same URL-backed record page.
3. Refresh the browser and confirm the project record remains open.
4. Use browser Back and Forward and confirm list/record navigation remains correct.
5. Verify progress equals weighted completed task estimates.
6. Verify blocked and overdue tasks change project health.
7. Verify time, budget, billed, paid and outstanding summaries match linked records.

## Task workflow

1. Open a task from project list, global task list, board, search and subtask list.
2. Confirm task key, project, reporter, assignee, status, priority, estimate and due date.
3. Edit the task and click the backdrop. Confirm the form remains open.
4. Add a comment, checklist item, dependency and time entry.
5. Toggle and remove the checklist item.
6. Unlink the dependency.
7. Delete the time entry.
8. Add a subtask and confirm the parent relationship.
9. Attempt a circular parent and dependency relationship and confirm rejection.
10. Drag the task between board columns and confirm status, project health and progress update.

## Cross-module workflow

1. Create an event from the project and confirm it appears in Calendar and project Activity.
2. Create an invoice from the project and confirm the project relationship is preselected.
3. Issue or pay the invoice and confirm project and portfolio totals update.
4. Upload a project/task file and confirm it appears in Files and the related record.
5. Confirm all related actions create activity entries.

## Permission workflow

1. Repeat project/task mutation attempts as owner, editor and viewer.
2. Confirm viewers can read but cannot edit, change status, log time, comment, drag cards or delete records.
3. Confirm owner/editor mutations persist and synchronize.

## Responsive and accessibility workflow

1. Test desktop, tablet and mobile widths.
2. Confirm no page-level horizontal overflow; board and wide tables may scroll within their own containers.
3. Navigate all controls by keyboard.
4. Confirm focus moves to record headings and modal headings.
5. Confirm labels and accessible names exist for icon-only controls.
6. Confirm readable contrast in light and dark themes.

## Failure workflow

1. Disable the network after loading and attempt a mutation.
2. Confirm the app reports offline/retry state without silently discarding the local action.
3. Trigger a workspace version conflict and confirm the latest data reloads with a visible warning.
4. Confirm malformed historic records are normalized without duplicate project codes or task keys.
5. Confirm the Netlify build fails when any syntax, contract, model or browser test fails.
