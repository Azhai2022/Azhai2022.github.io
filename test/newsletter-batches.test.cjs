'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sendChangesInBatches } = require('../scripts/newsletter-batches');

test('sends each approved change in ordered recipient batches', async () => {
  const calls = [];
  const changes = [
    { changeFingerprint: 'first' },
    { changeFingerprint: 'second' },
  ];
  const responses = [
    { sent: 10, complete: false, afterSubscriberId: 12, recipientCutoff: '2026-10-08T10:00:00.000Z' },
    { sent: 2, complete: true, afterSubscriberId: 14, recipientCutoff: '2026-10-08T10:00:00.000Z' },
    { sent: 0, complete: true, afterSubscriberId: 0, recipientCutoff: '2026-10-08T10:01:00.000Z' },
  ];

  const summary = await sendChangesInBatches(changes, async (path, options) => {
    calls.push({ path, body: JSON.parse(options.body) });
    return responses.shift();
  });

  assert.equal(summary.sent, 12);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.path), Array(3).fill('send-batch'));
  assert.deepEqual(calls.map((call) => call.body.changeFingerprint), ['first', 'first', 'second']);
  assert.equal(calls[0].body.afterSubscriberId, 0);
  assert.equal(calls[1].body.afterSubscriberId, 12);
  assert.equal(calls[1].body.recipientCutoff, '2026-10-08T10:00:00.000Z');
});

test('stops if the server does not advance the recipient cursor', async () => {
  await assert.rejects(
    sendChangesInBatches(
      [{ changeFingerprint: 'first' }],
      async () => ({
        sent: 0,
        complete: false,
        afterSubscriberId: 0,
        recipientCutoff: '2026-10-08T10:00:00.000Z',
      }),
    ),
    /没有向前推进/,
  );
});
