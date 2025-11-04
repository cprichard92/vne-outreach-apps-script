import assert from 'node:assert/strict';
import test from 'node:test';
import { createBounceRetryTestEnv } from './helpers/gas.js';

test('extractBounceRecipientFromBody_ parses standard headers', () => {
  const { extractBounceRecipientFromBody_ } = createBounceRetryTestEnv();
  const body = [
    'Final-Recipient: rfc822; primary@example.com',
    'Original-Recipient: rfc822; alias@example.com',
    '',
    'Diagnostic-Code: smtp; 550 5.1.1 <primary@example.com> User unknown'
  ].join('\n');

  assert.equal(extractBounceRecipientFromBody_(body), 'primary@example.com');
});

test('extractBounceReason_ returns first diagnostic or status line', () => {
  const { extractBounceReason_ } = createBounceRetryTestEnv();
  const body = [
    'Some header',
    'Diagnostic-Code: smtp; 550 5.1.1 mailbox unavailable',
    'Status: 5.1.1'
  ].join('\n');

  assert.equal(
    extractBounceReason_(body),
    'Diagnostic-Code: smtp; 550 5.1.1 mailbox unavailable'
  );
});

test('buildBounceEmailCandidates_ pulls unique addresses from notes and domain guesses', () => {
  const env = createBounceRetryTestEnv();
  const { buildBounceEmailCandidates_, getCell, extractDomain } = env;

  assert.ok(buildBounceEmailCandidates_, 'function should exist');
  assert.ok(getCell, 'getCell helper should be available');
  assert.ok(extractDomain, 'extractDomain helper should be available');

  const colIndex = {
    Email: 1,
    Notes: 2,
    'Rep Targeting Notes': 3,
    'BTG Opportunity Notes': 4,
    POC: 5,
    Source: 6,
  };

  const rowValues = [
    'bounced@example.com',
    'Reach out to alex@example.com and team@example.com',
    'Backup: OWNER@EXAMPLE.com',
    '',
    '',
    'Lead',
  ];

  const candidates = buildBounceEmailCandidates_(
    rowValues,
    colIndex,
    'https://example.com/contact',
    'bounced@example.com'
  );

  const emails = Array.from(candidates, (c) => c.email);

  assert.deepStrictEqual(
    emails,
    [
      'alex@example.com',
      'team@example.com',
      'owner@example.com',
      'info@example.com',
      'contact@example.com',
      'hello@example.com',
      'sales@example.com',
      'beverage@example.com',
      'gm@example.com',
      'events@example.com',
    ]
  );

  const sources = Object.fromEntries(
    Array.from(candidates, (c) => [c.email, c.source])
  );
  assert.equal(sources['alex@example.com'], 'notes');
  assert.equal(sources['team@example.com'], 'notes');
  assert.equal(sources['owner@example.com'], 'rep targeting notes');
  assert.equal(sources['info@example.com'], 'domain-guess');
});

test('isDeliverableCandidate_ filters obvious system addresses', () => {
  const { isDeliverableCandidate_ } = createBounceRetryTestEnv();

  assert.equal(isDeliverableCandidate_('mailer-daemon@googlemail.com'), false);
  assert.equal(isDeliverableCandidate_('postmaster@example.com'), false);
  assert.equal(isDeliverableCandidate_('no-reply@gmail.com'), false);
  assert.equal(isDeliverableCandidate_('info@vneimporters.com'), false);
  assert.equal(isDeliverableCandidate_('buyer@example.com'), true);
});
