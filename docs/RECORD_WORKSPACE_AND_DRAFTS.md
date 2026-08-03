# Record workspace and draft recovery

## Purpose

This change removes the redundant desktop hamburger control, replaces modal-based record editing with a dedicated full-page workspace, and makes dirty forms resumable after they are closed.

## Sidebar behavior

- Desktop uses the collapse or expand arrow inside the sidebar.
- The duplicate hamburger in the desktop top bar is hidden and removed from keyboard navigation.
- Mobile keeps the hamburger because it opens the mobile drawer.

## Record viewing

Metadata-driven ERP records open as full pages with:

- a record header and lifecycle status
- grouped record details
- company, branch and update metadata
- recent activity
- connected workflow records
- workflow actions
- a direct page-edit action

The page is represented in browser history with the module and record identifiers in the URL.

## Record editing

Existing ERP records edit on a dedicated page rather than in the shared dialog. The editor provides:

- grouped form sections
- a section outline
- sticky desktop actions
- responsive phone and tablet layouts
- validation near the affected fields
- AD and BS context for date fields
- explicit distinction between a local draft and published data

Published data changes only after **Save changes**.

## Draft recovery

### Full-page record editing

The editor automatically stores the latest field values in browser local storage. A draft:

- is isolated by workspace, module and record
- remains available for seven days
- is restored when the user returns to Edit
- does not alter the underlying record until published
- is cleared after a successful save
- can be explicitly discarded

Navigating away or closing the browser also preserves the current draft.

### Modal forms

Creation dialogs and remaining bounded-action forms retain their last values when closed. Dirty forms are saved before the dialog closes, including backdrop and Escape-based closure. Reopening the same form restores the saved values.

ERP forms use the existing Formcraft form-workflow draft store. Non-ERP modal forms receive a generic local draft identity based on workspace, route and form identity.

The old discard-confirmation interruption is bypassed only after the draft has been written. An explicit discard action remains available after recovery.

## Scope boundary

This does not convert every small confirmation or bounded action into a page. Comments, scheduling actions and destructive confirmations may remain dialogs. Item viewing and editing use pages; short transactional actions may still use dialogs.

## Validation

Automated coverage verifies:

- the desktop hamburger is not visible or focusable
- the sidebar arrow still collapses and expands the sidebar
- record viewing opens a page without an active dialog
- editing opens a page without an active dialog
- page drafts survive leaving and reopening Edit
- records remain unchanged until Save changes
- saving publishes the draft and returns to view mode
- closing a dirty creation dialog does not open the old discard confirmation
- reopening the dialog restores its values
- mobile retains its drawer hamburger
- record view and edit layouts remain single-column and overflow-free on phones
