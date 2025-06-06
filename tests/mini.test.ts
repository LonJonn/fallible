import { describe, expect, expectTypeOf, test } from "vitest";
import { Result, type Err, type Ok } from "../src/mini";

declare const queryDb: <T>(query: string) => Promise<Ok<T> | Err<DatabaseError>>;

class FooError extends Result.TaggedError("FooError") {}
class BarError extends Result.TaggedError("BarError") {}
class DatabaseError extends Result.TaggedError("DatabaseError")<{ reason: string }> {}
class BannedAccountError extends Result.TaggedError("BannedAccountError")<{ reason: string }> {}

type User = { name: string; banned: boolean; banReason: string };

async function getUser(id: string) {
  const user = await queryDb<User>(`SELECT * FROM users WHERE id = ${id}`);

  if (Result.isError(user)) {
    return user;
  }

  if (user.value.banned) {
    return Result.err(new BannedAccountError({ reason: user.value.banReason }));
  }

  return Result.ok(user.value);
}

test("correct types", () => {
  expectTypeOf(getUser).returns.resolves.toEqualTypeOf<Ok<User> | Err<DatabaseError> | Err<BannedAccountError>>();
});

test("serialise", () => {
  const err = Result.err(new DatabaseError({ reason: "OH SHI" }));
  expect(JSON.parse(JSON.stringify(err))).toMatchObject({ error: { _tag: "DatabaseError" } });
});

async function getUserName(id: string) {
  const user = await getUser(id);

  if (Result.isError(user)) {
    return Result.matchError(user, {
      DatabaseError: () => Result.ok(null),
      BannedAccountError: (e) => Result.ok(`Banned User (${e.reason})`),
    });
  }

  return Result.ok(user.value.name);
}

expectTypeOf(getUserName).returns.resolves.toEqualTypeOf<Ok<string> | Ok<null>>();

function foo() {
  return Math.random() ? Result.err(new FooError()) : Result.ok(1);
}

function bar() {
  return Math.random() ? Result.err(new BarError()) : Result.ok(2);
}

async function baz() {
  const result = Result.all(await Promise.all([foo(), bar(), getUser("1"), queryDb<12>("")]));

  if (Result.isError(result, "DatabaseError")) {
    return Result.ok(null);
  }

  if (Result.isError(result)) {
    return result;
  }

  return Result.ok(result.value[3]);
}
