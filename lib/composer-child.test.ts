import test from 'node:test';
import assert from 'node:assert/strict';
import { childEventRefreshes, childInitial, childListArgs, childState, visibleChildren } from './composer-child.ts';

test('child avatars abbreviate actual titles and reflect pending input before activity', () => {
  assert.equal(childInitial('UI review'), 'UI');
  assert.equal(childInitial('Queue check'), 'QC');
  assert.equal(childInitial('코드 검토'), '코검');
  assert.equal(childInitial(''), '↗');
  assert.equal(childState('active', true), 'wait');
  assert.equal(childState('active', false), 'run');
  assert.equal(childState('idle', false), 'done');
  assert.equal(childState('error', false), 'error');
});

test('archived children stay out of the pill summary while idle unarchived children stay', () => {
  const rows = [
    { id: 'done', title: '완료', titleFallback: null, providerId: 'grok', archivedAt: null, hasPendingInteraction: false, runtime: { displayStatus: 'idle' } },
    { id: 'archived', title: '보관', titleFallback: null, providerId: 'grok', archivedAt: 10, hasPendingInteraction: false, runtime: { displayStatus: 'idle' } },
    { id: 'run', title: null, titleFallback: '실행', providerId: 'grok', archivedAt: null, hasPendingInteraction: false, runtime: { displayStatus: 'active' } },
  ];
  const visible = visibleChildren(rows);
  assert.deepEqual(visible.map(child => child.id), ['done', 'run']);
  assert.deepEqual(visible.map(child => ({
    id: child.id,
    title: child.title ?? child.titleFallback ?? 'Child Thread',
    providerId: child.providerId,
    state: childState(child.runtime.displayStatus, child.hasPendingInteraction),
  })), [
    { id: 'done', title: '완료', providerId: 'grok', state: 'done' },
    { id: 'run', title: '실행', providerId: 'grok', state: 'run' },
  ]);
  assert.deepEqual(visibleChildren([rows[1]]).map(child => child.id), []);
  const query = childListArgs('parent', 100);
  assert.equal(query.archived, false);
  assert.deepEqual(query, { parentThreadId: 'parent', limit: 100, offset: 100, archived: false, signal: undefined });
});

test('archived-changed refreshes before the child id gate, including a child never shown', () => {
  const scope = { threadId: 'parent', parentId: null as string | null, childIds: new Set(['live']) };
  assert.equal(childEventRefreshes({ id: 'never-seen', changes: ['archived-changed'] }, scope), true);
  assert.equal(childEventRefreshes({ id: 'live', changes: ['archived-changed'] }, scope), true);
  assert.equal(childEventRefreshes({ changes: ['archived-changed'] }, scope), true);
  assert.equal(childEventRefreshes({ id: 'never-seen', changes: ['status-changed'] }, scope), false);
  assert.equal(childEventRefreshes({ id: 'live', changes: ['status-changed'] }, scope), true);
  assert.equal(childEventRefreshes({ id: 'live', changes: ['read-state-changed'] }, scope), false);
  assert.equal(childEventRefreshes({ id: 'new', changes: ['thread-created'] }, scope), true);
  assert.equal(childEventRefreshes({ id: 'mom', changes: ['title-changed'] }, { ...scope, parentId: 'mom' }), true);
  assert.equal(childEventRefreshes({ id: 'mom', changes: ['status-changed'] }, { ...scope, parentId: 'mom' }), false);
  assert.equal(childEventRefreshes({ id: 'live', changes: ['events-appended'], metadata: { eventTypes: ['turn/completed'] } }, scope), true);
  assert.equal(childEventRefreshes({ id: 'live', changes: ['events-appended'], metadata: { eventTypes: ['item/backgroundTask/progress'] } }, scope), true);
  assert.equal(childEventRefreshes({ id: 'live', changes: ['events-appended'], metadata: { eventTypes: ['item/completed'] } }, scope), false);
});
