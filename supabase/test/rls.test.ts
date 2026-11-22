import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

// Applies the real migrations to an in-process Postgres (PGlite) with a small
// stand-in for Supabase: an auth schema, auth.uid() read from the same
// request.jwt.claim.sub setting Supabase uses, and the anon/authenticated
// roles with Supabase's default table grants. It checks the Row Level
// Security rules, not Supabase itself.

const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url))
const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'
const ALICE_ROW = 'aaaaaaaa-0000-0000-0000-000000000001'

const db = new PGlite()

beforeAll(async () => {
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    insert into auth.users values ('${ALICE}'), ('${BOB}');
  `)
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
})

/** Runs `sql` as a signed-in user, or as the anon role when `user` is null. */
async function as(user: string | null, sql: string) {
  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '${user ?? ''}', false);
    set role ${user ? 'authenticated' : 'anon'};
  `)
  try {
    return await db.query<Record<string, unknown>>(sql)
  } finally {
    await db.exec('reset role')
  }
}

function insertPomodoro(id: string, userId: string, onConflict = ''): string {
  return `insert into public.pomodoros (id, user_id, started_at, completed_at, device_id)
          values ('${id}', '${userId}', now() - interval '25 minutes', now(), 'device-1') ${onConflict}`
}

describe('row level security', () => {
  it('is enabled on every table in the public schema', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row, row.relname).toMatchObject({ relrowsecurity: true })
  })

  it('lets a user insert their own pomodoro', async () => {
    const result = await as(ALICE, insertPomodoro(ALICE_ROW, ALICE))
    expect(result.affectedRows).toBe(1)
  })

  it('refuses a pomodoro for another user, or from the anon role', async () => {
    await expect(as(ALICE, insertPomodoro('aaaaaaaa-0000-0000-0000-000000000002', BOB))).rejects.toThrow(/row-level security/)
    await expect(as(null, insertPomodoro('aaaaaaaa-0000-0000-0000-000000000003', ALICE))).rejects.toThrow(/row-level security/)
  })

  it('accepts a re-sent pomodoro as a no-op when the client asks to ignore duplicates', async () => {
    const result = await as(ALICE, insertPomodoro(ALICE_ROW, ALICE, 'on conflict (id) do nothing'))
    expect(result.affectedRows).toBe(0)
  })

  it('refuses a re-sent pomodoro as an update, because history is append-only', async () => {
    const upsert = insertPomodoro(ALICE_ROW, ALICE, 'on conflict (id) do update set device_id = excluded.device_id')
    await expect(as(ALICE, upsert)).rejects.toThrow(/row-level security/)
  })

  it('shows each user only their own rows, and the anon role none', async () => {
    expect((await as(ALICE, 'select id from public.pomodoros')).rows).toEqual([{ id: ALICE_ROW }])
    expect((await as(BOB, 'select id from public.pomodoros')).rows).toEqual([])
    expect((await as(null, 'select id from public.pomodoros limit 1')).rows).toEqual([])
  })

  it('does not let anyone update or delete pomodoros', async () => {
    expect((await as(ALICE, `update public.pomodoros set device_id = 'changed'`)).affectedRows).toBe(0)
    expect((await as(BOB, `update public.pomodoros set user_id = '${BOB}'`)).affectedRows).toBe(0)
    expect((await as(ALICE, 'delete from public.pomodoros')).affectedRows).toBe(0)
    expect((await as(ALICE, 'select id from public.pomodoros')).rows).toHaveLength(1)
  })

  it("counts only the caller's own pomodoros", async () => {
    const counts = `select * from public.pomodoro_counts(now() - interval '1 day', now() - interval '7 days')`
    expect((await as(ALICE, counts)).rows).toEqual([{ today_count: 1, week_count: 1, all_time_count: 1 }])
    expect((await as(BOB, counts)).rows).toEqual([{ today_count: 0, week_count: 0, all_time_count: 0 }])
    expect((await as(null, counts)).rows).toEqual([{ today_count: 0, week_count: 0, all_time_count: 0 }])
  })

  it('keeps profiles private to their owner', async () => {
    expect((await as(ALICE, `insert into public.profiles (id) values ('${ALICE}')`)).affectedRows).toBe(1)
    await expect(as(ALICE, `insert into public.profiles (id) values ('${BOB}')`)).rejects.toThrow(/row-level security/)
    expect((await as(BOB, 'select id from public.profiles')).rows).toEqual([])
  })
})
