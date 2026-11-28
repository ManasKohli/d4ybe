import { afterAll, describe, expect, it } from 'vitest';
import type { TransactionSql } from '../../src/db/client.js';
import { createAuthUser, hasDb, inRollback, pgError, SEED, testDb } from '../helpers/db.js';

async function newSubmission(tx: TransactionSql) {
  const studentId = await createAuthUser(tx);
  const [assignment] = await tx<{ id: string }[]>`
    insert into public.assignments (module_slug, cohort_id, title, answer_spec)
    values ('casper', ${SEED.cohortId}, 'Practice set', '{video_link,text}') returning id
  `;
  const [submission] = await tx<{ id: string }[]>`
    insert into public.submissions (assignment_id, student_id, version)
    values (${assignment!.id}, ${studentId}, 1) returning id
  `;
  return { studentId, submissionId: submission!.id };
}

describe.skipIf(!hasDb)('credit_ledger (D12, D16)', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('refuses a debit that would take the balance below zero', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      await tx`insert into public.credit_ledger (student_id, kind, delta, reason) values (${id}, 'review', 1, 'grant')`;
      await tx`insert into public.credit_ledger (student_id, kind, delta, reason) values (${id}, 'review', -1, 'used')`;
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.credit_ledger (student_id, kind, delta, reason) values (${id}, 'review', -1, 'used')`,
      );
      expect(err?.code).toBe('23514');
      expect(err?.message).toContain('no review credits left');
    });
  });

  it('keeps review and one-on-one balances separate', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      await tx`insert into public.credit_ledger (student_id, kind, delta, reason) values (${id}, 'review', 3, 'grant')`;
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.credit_ledger (student_id, kind, delta, reason) values (${id}, 'one_on_one', -1, 'used')`,
      );
      expect(err?.code).toBe('23514');
    });
  });

  it('is append-only: updates and deletes are refused', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      await tx`insert into public.credit_ledger (student_id, kind, delta, reason) values (${id}, 'review', 1, 'grant')`;
      const update = await pgError(tx, (sp) => sp`update public.credit_ledger set delta = 50 where student_id = ${id}`);
      expect(update?.code).toBe('42501');
      const del = await pgError(tx, (sp) => sp`delete from public.credit_ledger where student_id = ${id}`);
      expect(del?.code).toBe('42501');
    });
  });

  it('rejects a zero delta', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.credit_ledger (student_id, kind, delta, reason) values (${id}, 'review', 0, 'noop')`,
      );
      expect(err?.code).toBe('23514');
    });
  });
});

// D16 backstop under real concurrency: two transactions on separate connections.
describe.skipIf(!hasDb)('credit_ledger under concurrent debits', () => {
  const a = testDb();
  const b = testDb();
  let studentId = '';
  afterAll(async () => {
    if (studentId) await a`delete from auth.users where id = ${studentId}`;
    await Promise.all([a.end(), b.end()]);
  });

  it('lets exactly one of two simultaneous debits spend the last credit', async () => {
    studentId = await a.begin((tx) => createAuthUser(tx));
    await a`insert into public.credit_ledger (student_id, kind, delta, reason) values (${studentId}, 'review', 1, 'grant')`;

    const debit = (sql: typeof a) =>
      sql.begin(async (tx) => {
        await tx`insert into public.credit_ledger (student_id, kind, delta, reason) values (${studentId}, 'review', -1, 'used')`;
        await tx`select pg_sleep(0.2)`; // hold the transaction open so the two overlap
      });
    const results = await Promise.allSettled([debit(a), debit(b)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const [row] = await a<{ balance: number }[]>`
      select coalesce(sum(delta), 0)::int as balance from public.credit_ledger where student_id = ${studentId}
    `;
    expect(row?.balance).toBe(0);
  });
});

describe.skipIf(!hasDb)('audit_log', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('is append-only', async () => {
    await inRollback(sql, async (tx) => {
      await tx`insert into public.audit_log (actor_id, action, target) values (${SEED.admin.id}, 'grant', 'x')`;
      const err = await pgError(tx, (sp) => sp`update public.audit_log set action = 'nothing'`);
      expect(err?.code).toBe('42501');
    });
  });

  it.each(['audit_log', 'credit_ledger'])('refuses TRUNCATE on %s', async (table) => {
    await inRollback(sql, async (tx) => {
      const err = await pgError(tx, (sp) => sp.unsafe(`truncate public.${table}`));
      expect(err?.code).toBe('42501');
    });
  });
});

describe.skipIf(!hasDb)('orders', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('needs paid_at once paid', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      const [product] = await tx<{ id: string }[]>`
        insert into public.products (slug, kind, name) values ('test-pkg', 'package', 'Test') returning id
      `;
      const err = await pgError(
        tx,
        (sp) => sp`
          insert into public.orders (user_id, product_id, cohort_id, status, expires_at)
          values (${id}, ${product!.id}, ${SEED.cohortId}, 'paid', now() + interval '30 minutes')
        `,
      );
      expect(err?.code).toBe('23514');
    });
  });
});

describe.skipIf(!hasDb)('enrollments', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('allows one enrollment per student and module', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      await tx`insert into public.enrollments (student_id, module_slug, source) values (${id}, 'dat', 'admin')`;
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.enrollments (student_id, module_slug, source) values (${id}, 'dat', 'hardship')`,
      );
      expect(err?.code).toBe('23505');
    });
  });

  it('requires an order for a purchase', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.enrollments (student_id, module_slug, source) values (${id}, 'dat', 'purchase')`,
      );
      expect(err?.code).toBe('23514');
    });
  });

  it('rejects an unknown module', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.enrollments (student_id, module_slug, source) values (${id}, 'nope', 'admin')`,
      );
      expect(err?.code).toBe('23503');
    });
  });
});

describe.skipIf(!hasDb)('chapter_progress (D19)', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('accepts a chapter that belongs to the module', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      await tx`insert into public.chapter_progress (student_id, module_slug, chapter_slug) values (${id}, 'dat', 'dat-101')`;
    });
  });

  it('rejects a chapter from another module', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.chapter_progress (student_id, module_slug, chapter_slug) values (${id}, 'dat', 'test-day')`,
      );
      expect(err?.code).toBe('23514');
    });
  });
});

describe.skipIf(!hasDb)('submission_items (D36)', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('accepts one item of each kind with only its own field set', async () => {
    await inRollback(sql, async (tx) => {
      const { submissionId } = await newSubmission(tx);
      await tx`
        insert into public.submission_items (submission_id, sort_order, kind, label, video_url, body, storage_path, file_name) values
          (${submissionId}, 0, 'video_link', 'Video 1', 'https://youtu.be/abc', null, null, null),
          (${submissionId}, 1, 'text', 'Typed 1', null, 'My answer', null, null),
          (${submissionId}, 2, 'file', 'Document', null, null, ${`s/${submissionId}/x/a.pdf`}, 'a.pdf')
      `;
    });
  });

  it.each([
    ['a text item with a link', `'text', 'T', 'https://youtu.be/x', 'body'`],
    ['a video item with no link', `'video_link', 'V', null, null`],
    ['a plain-http video link', `'video_link', 'V', 'http://youtu.be/x', null`],
  ])('rejects %s', async (_name, values) => {
    await inRollback(sql, async (tx) => {
      const { submissionId } = await newSubmission(tx);
      const err = await pgError(
        tx,
        (sp) =>
          sp.unsafe(
            `insert into public.submission_items (submission_id, sort_order, kind, label, video_url, body) values ($1, 0, ${values})`,
            [submissionId],
          ),
      );
      expect(err?.code).toBe('23514');
    });
  });
});

describe.skipIf(!hasDb)('reviews', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('allows one live review per submission; a reassigned one stays as history', async () => {
    await inRollback(sql, async (tx) => {
      const { submissionId } = await newSubmission(tx);
      const due = new Date(Date.now() + 7 * 86_400_000);
      await tx`insert into public.reviews (submission_id, mentor_id, due_at, status) values (${submissionId}, ${SEED.mentor.id}, ${due}, 'reassigned')`;
      await tx`insert into public.reviews (submission_id, mentor_id, due_at) values (${submissionId}, ${SEED.mentor.id}, ${due})`;
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.reviews (submission_id, mentor_id, due_at) values (${submissionId}, ${SEED.mentor.id}, ${due})`,
      );
      expect(err?.code).toBe('23505');
    });
  });

  it('keeps a cancelled review as history and allows a new live one (D16 admin cancel)', async () => {
    await inRollback(sql, async (tx) => {
      const { submissionId } = await newSubmission(tx);
      await tx`insert into public.reviews (submission_id, mentor_id, due_at, status) values (${submissionId}, ${SEED.mentor.id}, now(), 'cancelled')`;
      await tx`insert into public.reviews (submission_id, mentor_id, due_at) values (${submissionId}, ${SEED.mentor.id}, now())`;
    });
  });

  it('nulls, not deletes, volunteer hours when their review goes', async () => {
    await inRollback(sql, async (tx) => {
      const { submissionId, studentId } = await newSubmission(tx);
      const [review] = await tx<{ id: string }[]>`
        insert into public.reviews (submission_id, mentor_id, due_at) values (${submissionId}, ${SEED.mentor.id}, now()) returning id
      `;
      await tx`
        insert into public.volunteer_hours (mentor_id, date, activity, student_id, hours, source, review_id)
        values (${SEED.mentor.id}, current_date, 'Review', ${studentId}, 1.5, 'review', ${review!.id})
      `;
      await tx`delete from auth.users where id = ${studentId}`;
      await tx`set constraints all immediate`; // run the deferred checks a commit would
      const [hours] = await tx`select review_id, student_id from public.volunteer_hours where mentor_id = ${SEED.mentor.id}`;
      expect(hours).toEqual({ review_id: null, student_id: null });
    });
  });

  it('needs completed_at exactly when completed', async () => {
    await inRollback(sql, async (tx) => {
      const { submissionId } = await newSubmission(tx);
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.reviews (submission_id, mentor_id, due_at, status) values (${submissionId}, ${SEED.mentor.id}, now(), 'completed')`,
      );
      expect(err?.code).toBe('23514');
    });
  });

  it('caps priorities at three', async () => {
    await inRollback(sql, async (tx) => {
      const { submissionId } = await newSubmission(tx);
      const err = await pgError(
        tx,
        (sp) => sp`insert into public.reviews (submission_id, mentor_id, due_at, priorities) values (${submissionId}, ${SEED.mentor.id}, now(), ${['a', 'b', 'c', 'd']})`,
      );
      expect(err?.code).toBe('23514');
    });
  });
});

describe.skipIf(!hasDb)('mentor_profiles', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('cannot be active before orientation and confidentiality', async () => {
    await inRollback(sql, async (tx) => {
      await tx`insert into public.invites (email, role) values ('m2@example.com', 'mentor')`;
      const id = await createAuthUser(tx, { email: 'm2@example.com', invited: true });
      const err = await pgError(tx, (sp) => sp`update public.mentor_profiles set status = 'active' where user_id = ${id}`);
      expect(err?.code).toBe('23514');
    });
  });
});
