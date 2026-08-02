# Architecture decision: operational records use routes

## Decision

Projects and tasks are rendered through the normal application page renderer and identified by URL query parameters plus the module hash. They do not use modal dialogs as page containers.

Example:

```text
?record=project&recordId=<id>#projects
?record=task&recordId=<id>#tasks
```

## Why

Operational records have history, relationships and many follow-up actions. Treating them as dialogs removed navigation context, broke browser history, encouraged accidental dismissal and made deep links impossible.

## Interaction boundary

- Record page: project and task detail
- Form dialog: focused create/edit workflow
- Small dialog: comment, checklist, dependency, time and confirmation
- Popover: account, notification, status/filter and overflow actions
- Inline: task status, assignee, priority and checklist completion

## Compatibility

The shared dialog remains available for existing bounded workflows. Complex forms are protected from accidental backdrop and Escape dismissal. Existing project and task entry points call the route-based record functions, so search, lists, boards and reports converge on the same record.
