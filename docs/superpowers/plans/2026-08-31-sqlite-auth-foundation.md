# SQLite Authentication Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace in-memory runtime storage for users and sessions with a free local SQLite database that survives server restarts and can be backed up safely.

**Architecture:** Keep the existing service and HTTP interfaces intact while adding focused SQLite adapters behind them. A database factory owns connection setup, a migration runner owns schema evolution, and the runtime composes persistent repositories unless tests inject alternatives.

**Tech Stack:** Node.js 22+, CommonJS, built-in `node:sqlite`, Express 5, bcryptjs, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-persistencia-cotizaciones-panel-fantasma-design.md`

## Global Constraints

- Run locally without paid services.
- Keep database files, SQLite auxiliary files, and backups out of Git.
- Preserve the current repository contracts used by `user-service.js` and `auth-service.js`.
- Enable SQLite foreign keys and WAL mode on every application connection.
- Apply versioned migrations before bootstrap or HTTP traffic is accepted.
- Store only password hashes and session token hashes.
- Use temporary isolated databases in tests; never touch development data.
- This plan covers the persistence foundation only. Quotes, role simulation, and role-specific interfaces get separate implementation plans.

---

## File Structure

**Create:**

- `server/database/database.js`: open and configure a SQLite connection.
- `server/database/migrate.js`: discover and atomically apply ordered SQL migrations.
- `server/database/migrations/001_auth.sql`: create migration ledger, users, and sessions.
- `server/users/sqlite-user-repository.js`: implement the existing user repository contract with SQLite.
- `server/auth/sqlite-session-repository.js`: implement the existing session repository contract with SQLite.
- `server/database/backup.js`: create timestamped SQLite backups from the command line.
- `tests/database-helper.js`: create and dispose isolated temporary databases.
- `tests/database-migrations.test.js`: verify configuration, migration ordering, and persistence.
- `tests/sqlite-user-repository.test.js`: verify user adapter behavior and constraints.
- `tests/sqlite-session-repository.test.js`: verify session adapter behavior and foreign keys.
- `tests/runtime-persistence.test.js`: verify runtime composition and restart persistence.
- `tests/database-backup.test.js`: verify a consistent restorable backup.

**Modify:**

- `server/server.js`: compose SQLite by default, migrate before bootstrap, and expose `close()`.
- `tests/configuration.test.js`: inject isolated storage so runtime tests never create the development database.
- `package.json`: add the `db:backup` command and require Node 22+.
- `.env.example`: document `PUBLITEX_DB_PATH` and `PUBLITEX_BACKUP_DIR`.
- `.gitignore`: ignore runtime databases and backups.
- `README.md`: document storage, backup, and restoration.

The in-memory repositories remain available as test doubles. No existing service should import SQLite directly.

---

### Task 1: Database connection and migration runner

**Files:**
- Create: `server/database/database.js`
- Create: `server/database/migrate.js`
- Create: `server/database/migrations/001_auth.sql`
- Create: `tests/database-helper.js`
- Create: `tests/database-migrations.test.js`

**Interfaces:**
- Produces: `openDatabase({ filename }): DatabaseSync`
- Produces: `migrateDatabase({ database, migrationsDirectory? }): string[]`
- Produces for tests: `withTestDatabase(callback): Promise<void>` where `callback({ database, filename })` runs after migrations.

- [ ] **Step 1: Write failing database and migration tests**

Create tests that open a temporary file, assert `PRAGMA foreign_keys` is `1`, assert `PRAGMA journal_mode` is `wal`, run migrations twice, and reopen the same file to confirm that `schema_migrations` contains exactly `001_auth.sql`. Add a failure case using a temporary migration directory containing invalid SQL; assert that migration version is not recorded after its transaction rolls back.

Use this shape for the main assertion:

```js
test('configura SQLite y aplica cada migración una sola vez', async () => {
  await withTestDatabase(async ({ database, filename }) => {
    assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(database.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    assert.deepEqual(migrateDatabase({ database }), []);
    database.close();

    const reopened = openDatabase({ filename });
    assert.deepEqual(
      reopened.prepare('SELECT version FROM schema_migrations ORDER BY version').all(),
      [{ version: '001_auth.sql' }],
    );
    reopened.close();
  });
});
```

- [ ] **Step 2: Run the tests and verify the expected failure**

Run: `node --test tests/database-migrations.test.js`

Expected: FAIL with `MODULE_NOT_FOUND` for `server/database/database.js` or `tests/database-helper.js`.

- [ ] **Step 3: Implement the connection factory**

Implement `openDatabase` with `DatabaseSync` from `node:sqlite`. Reject an empty filename, ensure the parent directory exists except for `:memory:`, then execute:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

Return the configured database. Do not create application tables in this module.

- [ ] **Step 4: Implement the first migration and runner**

Create `001_auth.sql` with:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('cliente', 'trabajador', 'jefe', 'superadmin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
```

The runner must create `schema_migrations(version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)` before discovery, accept only filenames matching `/^\d{3}_[a-z0-9_]+\.sql$/`, sort them lexically, and apply each pending file plus its ledger insert in one transaction. Return the versions applied during that invocation.

- [ ] **Step 5: Implement the isolated database helper**

Use `fs.mkdtempSync(path.join(os.tmpdir(), 'publitex-db-'))`, open `<temp>/test.sqlite`, run migrations, and guarantee closure plus `fs.rmSync(temp, { recursive: true, force: true })` in `finally`. The helper must tolerate the callback closing the database itself by checking `database.isOpen`.

- [ ] **Step 6: Run the focused tests**

Run: `node --test tests/database-migrations.test.js`

Expected: PASS with no database files created under the repository.

- [ ] **Step 7: Commit the migration foundation**

```bash
git add server/database tests/database-helper.js tests/database-migrations.test.js
git commit -m "feat: add SQLite migration foundation"
```

---

### Task 2: Persistent user repository

**Files:**
- Create: `server/users/sqlite-user-repository.js`
- Create: `tests/sqlite-user-repository.test.js`

**Interfaces:**
- Consumes: migrated `users` table from Task 1.
- Produces: `createSqliteUserRepository({ database, now? })` with async `create(user)`, `findByEmail(email)`, and `findById(id)` methods matching `createUserRepository()`.

- [ ] **Step 1: Write failing repository contract tests**

Test that `create` and both find methods return this domain shape without database column names:

```js
{
  id: 'user-1',
  name: 'Ana',
  email: 'ana@example.com',
  role: 'cliente',
  passwordHash: 'hash:secreto1',
}
```

Also verify missing users return `null`, a reopened database retains the user, and case-insensitive duplicate email insertion rejects with `{ code: 'EMAIL_EXISTS' }`.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/sqlite-user-repository.test.js`

Expected: FAIL with `MODULE_NOT_FOUND` for `sqlite-user-repository.js`.

- [ ] **Step 3: Implement row mapping and prepared statements**

Define a private `toUser(row)` mapper from `password_hash` to `passwordHash`. Prepare insert, email lookup, and id lookup statements once in the factory. Default `now` to `Date.now` and write the same timestamp to `created_at` and `updated_at`.

Catch only SQLite uniqueness errors from `create`, translate them to an error with code `EMAIL_EXISTS` and message `El correo ya está registrado.`, and rethrow all other failures unchanged.

- [ ] **Step 4: Run user persistence and existing service tests**

Run: `node --test tests/sqlite-user-repository.test.js tests/user-service.test.js`

Expected: PASS. Existing in-memory service tests remain unchanged.

- [ ] **Step 5: Commit the user adapter**

```bash
git add server/users/sqlite-user-repository.js tests/sqlite-user-repository.test.js
git commit -m "feat: persist users in SQLite"
```

---

### Task 3: Persistent session repository

**Files:**
- Create: `server/auth/sqlite-session-repository.js`
- Create: `tests/sqlite-session-repository.test.js`

**Interfaces:**
- Consumes: migrated `sessions` and `users` tables from Task 1.
- Produces: `createSqliteSessionRepository({ database })` with async `create(session)`, `findByTokenHash(tokenHash)`, and `deleteByTokenHash(tokenHash)` matching `createSessionRepository()`.

- [ ] **Step 1: Write failing session contract tests**

Insert a user fixture through the SQLite user repository, then verify this session round-trip shape:

```js
{
  tokenHash: 'token-hash',
  userId: 'user-1',
  expiresAt: 28_801_000,
}
```

Verify deletion returns the subsequent lookup to `null`, sessions survive reopening, and creating a session for an unknown user rejects with a foreign-key error.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/sqlite-session-repository.test.js`

Expected: FAIL with `MODULE_NOT_FOUND` for `sqlite-session-repository.js`.

- [ ] **Step 3: Implement prepared session operations**

Map `token_hash`, `user_id`, and `expires_at` to the existing camelCase domain fields. For `created_at`, use `Date.now()` inside `create`; do not add it to the returned domain object because the current authentication service does not consume it. Use `INSERT OR REPLACE` only for identical token hashes; do not suppress foreign-key failures.

- [ ] **Step 4: Run session and authentication service tests**

Run: `node --test tests/sqlite-session-repository.test.js tests/authorization.test.js`

Expected: PASS. The authorization tests continue to use injectable repositories.

- [ ] **Step 5: Commit the session adapter**

```bash
git add server/auth/sqlite-session-repository.js tests/sqlite-session-repository.test.js
git commit -m "feat: persist sessions in SQLite"
```

---

### Task 4: Compose persistence into the runtime

**Files:**
- Modify: `server/server.js`
- Modify: `tests/configuration.test.js`
- Create: `tests/runtime-persistence.test.js`

**Interfaces:**
- Consumes: `openDatabase`, `migrateDatabase`, `createSqliteUserRepository`, and `createSqliteSessionRepository`.
- Produces: `createRuntime(options)` returning `{ app, ready, close, database }`; `close()` is idempotent. Existing injected `users`, `sessions`, `userService`, and `authService` options remain supported.

- [ ] **Step 1: Write failing runtime persistence tests**

Create a temporary database filename and deterministic password/token functions. Build one runtime, await `ready`, register a user through `runtime.authService` or the HTTP API helper, call `close`, then build a second runtime with the same filename and authenticate the same account.

Also assert:

```js
const runtime = createRuntime({ databaseFilename, env: {}, bootstrapUsers: noOpBootstrap });
assert.equal(typeof runtime.close, 'function');
await runtime.ready;
runtime.close();
runtime.close();
```

Add a migration-failure case proving bootstrap is not invoked and `ready` rejects before traffic readiness.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/runtime-persistence.test.js`

Expected: FAIL because the runtime still creates in-memory repositories and has no `close` method.

- [ ] **Step 3: Refactor runtime composition**

Resolve the default database filename as:

```js
const databaseFilename = options.databaseFilename
  || env.PUBLITEX_DB_PATH
  || path.resolve(__dirname, '..', 'data', 'publitex.sqlite');
```

When no repository or higher-level service is injected, open one database, migrate it synchronously, and construct both SQLite repositories. Preserve dependency injection so existing unit and HTTP tests do not need a real database.

Expose `database`, `users`, `sessions`, `userService`, and `authService` on the runtime for focused testing. Make `close()` close only the connection owned by the runtime; never close an externally injected database.

Ensure `startServer` closes the owned database after the HTTP server closes and on startup failure. Keep bootstrap before listening.

Update every `createRuntime` call in `tests/configuration.test.js` to pass `databaseFilename` from an isolated temporary fixture, or inject both existing in-memory repositories. Add cleanup in `test.afterEach`; no test may rely on the default development path.

- [ ] **Step 4: Run runtime and configuration tests**

Run: `node --test tests/runtime-persistence.test.js tests/configuration.test.js tests/user-service.test.js`

Expected: PASS.

- [ ] **Step 5: Run all tests allowed by the environment**

Run: `npm test`

Expected outside a restricted sandbox: all suites PASS. If port binding is denied with `listen EPERM`, rerun and record the non-network suites separately; do not change application code to work around sandbox policy.

- [ ] **Step 6: Commit runtime composition**

```bash
git add server/server.js tests/runtime-persistence.test.js
git commit -m "feat: use SQLite in the application runtime"
```

---

### Task 5: Backup command and local configuration

**Files:**
- Create: `server/database/backup.js`
- Create: `tests/database-backup.test.js`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Produces: `createBackup({ sourceFilename, backupDirectory, now? }): Promise<string>` returning the absolute backup filename.
- Produces CLI: `npm run db:backup` using `PUBLITEX_DB_PATH` or `data/publitex.sqlite`, and `PUBLITEX_BACKUP_DIR` or `backups/`.

- [ ] **Step 1: Write failing backup tests**

Create a migrated temporary source database containing a user, call `createBackup`, and assert:

- the returned file exists;
- its basename matches `publitex-YYYYMMDD-HHMMSS.sqlite` for an injected fixed date;
- opening the backup read-only returns the stored user;
- backing up a missing source rejects without creating an empty database.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/database-backup.test.js`

Expected: FAIL with `MODULE_NOT_FOUND` for `server/database/backup.js`.

- [ ] **Step 3: Implement a consistent backup**

Use the built-in `backup` export from `node:sqlite` against a source connection opened with `{ readOnly: true }`. Create the destination directory recursively, reject an existing destination instead of overwriting it, and close the source connection in `finally`.

When invoked as the main module, read environment variables, call `createBackup`, print only the resulting path, and set a non-zero exit code with a generic Spanish error message on failure.

- [ ] **Step 4: Add scripts and safe ignore rules**

Set these package fields:

```json
"engines": { "node": ">=22.13.0" },
"scripts": {
  "test": "node --test",
  "start": "node server/server.js",
  "dev": "node --watch server/server.js",
  "db:backup": "node server/database/backup.js"
}
```

Add exact ignore rules:

```gitignore
data/*.sqlite
data/*.sqlite-shm
data/*.sqlite-wal
backups/
```

Add `PUBLITEX_DB_PATH=` and `PUBLITEX_BACKUP_DIR=` to `.env.example` without real paths or secrets.

- [ ] **Step 5: Document operation and restoration**

Update `README.md` to state that persistence is now SQLite rather than memory. Document:

```bash
npm run db:backup
```

Document restoration as: stop the server, preserve the current database file under a different name, copy the chosen backup to the configured `PUBLITEX_DB_PATH`, restart, and verify login. Do not provide an automated overwrite command.

- [ ] **Step 6: Run backup, configuration, and complete test suites**

Run: `node --test tests/database-backup.test.js tests/configuration.test.js tests/database-migrations.test.js tests/sqlite-user-repository.test.js tests/sqlite-session-repository.test.js tests/runtime-persistence.test.js`

Expected: PASS.

Run: `npm test`

Expected outside a restricted sandbox: all suites PASS. Any sandbox-only `listen EPERM` result must be reported separately from code failures.

- [ ] **Step 7: Confirm repository hygiene**

Run: `git status --short --ignored`

Expected: generated `.sqlite`, `-wal`, `-shm`, and `backups/` paths appear only with `!!`; source, tests, and documentation are tracked normally.

- [ ] **Step 8: Commit backup and documentation**

```bash
git add server/database/backup.js tests/database-backup.test.js package.json .env.example .gitignore README.md
git commit -m "feat: add local SQLite backup workflow"
```

---

## Plan Completion Check

After Task 5:

1. Start the server with a temporary `PUBLITEX_DB_PATH`.
2. Register a client and close the server normally.
3. Restart with the same path and log in as that client.
4. Run `npm run db:backup` and open the backup with the test helper.
5. Confirm no database or backup is tracked by Git.
6. Record the exact test results, distinguishing sandbox port restrictions from application failures.

The next plan begins only after this foundation passes review. It will add quote aggregates, products, notes, status history, assignments, and change requests on top of these migration and repository primitives.
