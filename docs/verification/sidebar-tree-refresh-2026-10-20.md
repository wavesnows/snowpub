# Sidebar tree refresh verification

Snowpub already scans directories asynchronously and retains the tree across menu switches. However, its reactive data is passed directly to Element Plus's deep data watcher, so changed snapshots and pinned ordering can rebuild the tree. Refresh also filters every node even with an empty query.

The fix uses isolated raw view snapshots and reconciles by path. Existing nodes retain selection/expansion; removals unregister stale descendants. Canonical deletion is path-based. New Markdown notes, demo notes and folders refresh canonical data after writing instead of mutating view snapshots.

Validation (2026-10-20):
- Added regression tests first; they failed before implementation.
- `node --test tests/*.test.cjs`: 16 passed, including 25,000-node incremental updates, ordering, deletion, missing deletion targets, and new-note/folder refresh integration.
- `vue-tsc --noEmit`: passed.
- `vite build`: passed.
- `electron tests/tree-view-electron.smoke.cjs`: passed using the production renderer and isolated home/userData. Adding one file created exactly one node (33 ms observed); 24 DOM menu clicks preserved selection and expansion; pin ordering and bulk deletion passed.
- `git diff --check`: passed.

No real notes or publishing APIs were used. The installed Snowpub application has not been replaced. These checks confirm the identified tree-update issue; they do not establish that every possible source of UI latency is eliminated. Synchronous editor reads/search remain separate potential performance work requiring targeted measurement.
