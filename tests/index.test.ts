/**
 * Comprehensive test‑suite for `@lonjonn/fallible`
 * ------------------------------------------------
 * The scenarios mimic a tiny "banking" domain to exercise every public
 * surface‑area of the library with semi‑realistic flows rather than
 * contrived `TestError` values.
 *
 * Runtime assertions use Vitest; type‑level assertions use `expectTypeOf`.
 *
 * What's covered?
 *  • Static helpers — ok, err, die, gen, TaggedError, isError, try, all
 *  • Instance helpers — unwrap(+Overloads), map/flatMap/tap chain, etc.
 *  • Type utilities   — InferOk/InferErr/TagsOf, conditional unwrap, …
 *  • Generator API    — happy‑path + early‑error, serialisable variant.
 *  • JSON safety      — asSerializable removes Symbol.asyncIterator.
 */

import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { err, isError, ok, pipe, Result, UnknownException, type Err, type Ok } from "../src";

it("scratchpad", () => {});

/* -------------------------------------------------- */
/*  Fake domain types & helpers                       */
/* -------------------------------------------------- */

interface User {
  id: number;
  name: string;
  balance: number;
}

class ValidationError extends Result.TaggedError("ValidationError")<{
  field: string;
  issue: string;
}> {}

class NetworkError extends Result.TaggedError("NetworkError")<{
  status: number;
  body: string;
}> {}

class DatabaseError extends Result.TaggedError("DatabaseError")<{ query: string }> {}

type DomainError = ValidationError | NetworkError | DatabaseError;

const fetchUser = (id: number) =>
  Result.gen(async function* () {
    if (id !== 1) {
      return yield* new NetworkError({ status: 404, body: "Not found" });
    }

    return {
      id: 1,
      name: "Alice",
      balance: 100,
    };
  });

const updateBalance = (user: User, delta: number) =>
  Result.gen(async function* () {
    if (delta === 0) {
      return yield* new ValidationError({ field: "amount", issue: "Cannot be zero" });
    }

    if (delta + user.balance < 0) {
      return yield* new ValidationError({ field: "amount", issue: "Insufficient funds" });
    }

    if (Math.random() < 0.05) {
      // pretend DB flaky
      return yield* new DatabaseError({ query: "UPDATE users SET balance …" });
    }

    return { ...user, balance: user.balance + delta };
  });

/* -------------------------------------------------- */
/*  TYPE‑LEVEL UTILITIES                              */
/* -------------------------------------------------- */

describe("🔡  Type utilities", () => {
  it("InferOk / InferErr extract channels from Results & unions", () => {
    type R = Result<number, ValidationError>;
    expectTypeOf<Result.InferOk<R>>().toEqualTypeOf<number>();
    expectTypeOf<Result.InferErr<R>>().toEqualTypeOf<ValidationError>();

    type Mixed = Ok<string> | Err<NetworkError> | Err<DatabaseError>;
    expectTypeOf<Result.InferOk<Mixed>>().toEqualTypeOf<string>();
    expectTypeOf<Result.InferErr<Mixed>>().toEqualTypeOf<NetworkError | DatabaseError>();

    expectTypeOf<Result.InferErr<Result<number, string>>>().toEqualTypeOf<string>();
    expectTypeOf<Result.InferOk<Result<number, string>>>().toEqualTypeOf<number>();

    expectTypeOf<Result.InferErr<Promise<Ok<number>>>>().toEqualTypeOf<never>();
    expectTypeOf<Result.InferOk<Promise<Ok<number>>>>().toEqualTypeOf<number>();

    expectTypeOf<Result.InferErr<Promise<Err<string>>>>().toEqualTypeOf<string>();
    expectTypeOf<Result.InferOk<Promise<Err<string>>>>().toEqualTypeOf<never>();

    expectTypeOf<Result.InferErr<Promise<Ok<number> | Err<string>>>>().toEqualTypeOf<string>();
    expectTypeOf<Result.InferOk<Promise<Ok<number> | Err<string>>>>().toEqualTypeOf<number>();

    expectTypeOf<Result.InferErr<Ok<number>>>().toEqualTypeOf<never>();
    expectTypeOf<Result.InferOk<Ok<number>>>().toEqualTypeOf<number>();

    expectTypeOf<Result.InferErr<Err<string>>>().toEqualTypeOf<string>();
    expectTypeOf<Result.InferOk<Err<string>>>().toEqualTypeOf<never>();

    expectTypeOf<Result.InferErr<Ok<number> | Err<string>>>().toEqualTypeOf<string>();
    expectTypeOf<Result.InferOk<Ok<number> | Err<string>>>().toEqualTypeOf<number>();
  });

  it("TagsOf collects `_tag` literals deeply", () => {
    type Tags = Result.TagsOf<DomainError | { _tag: "Other" }>;
    expectTypeOf<Tags>().toEqualTypeOf<"ValidationError" | "NetworkError" | "DatabaseError" | "Other">();
  });

  it("`.unwrap` is available only when E = never", () => {
    expectTypeOf(ok(1).unwrapSafe).toEqualTypeOf<() => Promise<number>>();
    expectTypeOf(err("bad").unwrapSafe).toEqualTypeOf<never>();
  });
});

/* -------------------------------------------------- */
/*  STATIC CONSTRUCTORS & BASIC BEHAVIOUR             */
/* -------------------------------------------------- */

describe("🏗️  Construction helpers", () => {
  it("ok / err produce the right tagged objects", async () => {
    const o = ok(42);
    expectTypeOf(o).toEqualTypeOf<Result<number, never>>();
    expect(await o).toMatchObject({ isOk: true, value: 42 });

    const e = err("nope");
    expectTypeOf(e).toEqualTypeOf<Result<never, string>>();
    expect(await e).toMatchObject({ isError: true, error: "nope" });
  });

  it("die throws immediately", () => {
    expect(() => Result.die(new Error("boom"))).toThrow("boom");
  });

  it("async iterator semantics", async () => {
    /* ok values yield nothing & return value */
    const o = ok("yes");
    expectTypeOf(o).toEqualTypeOf<Result<string, never>>();
    const vals: any[] = [];
    for await (const v of o) vals.push(v);
    expect(vals).toEqual([]);

    /* err values yield themselves */
    const e = err("fail");
    expectTypeOf(e).toEqualTypeOf<Result<never, string>>();
    let yielded;
    for await (const v of e) yielded = v;
    expect(yielded).toEqual(expect.objectContaining({ error: "fail" }));
  });
});

/* -------------------------------------------------- */
/*  COMBINATORS (instance + static duals)             */
/* -------------------------------------------------- */

describe("🔀  Combinators", () => {
  it("map transforms Ok & preserves Err", async () => {
    const mapped = pipe(
      ok(2),
      Result.map((n) => n * 2),
    );
    expectTypeOf(mapped).toEqualTypeOf<Result<number, never>>();
    expect(await mapped).toMatchObject({ isOk: true, value: 4 });

    const preserved = pipe(
      err("x"),
      Result.map((n) => n * 2),
    );
    expectTypeOf(preserved).toEqualTypeOf<Result<number, string>>();
    expect(await preserved).toMatchObject({ isError: true, error: "x" });
  });

  it("mapError transforms Err & preserves Ok", async () => {
    const upper = pipe(
      err("bad"),
      Result.mapError((s) => s.toUpperCase()),
    );
    expectTypeOf(upper).toEqualTypeOf<Result<never, string>>();
    expect(await upper).toMatchObject({ error: "BAD" });

    const preserved = pipe(
      ok(1),
      Result.mapError(() => new Error()),
    );
    expectTypeOf(preserved).toEqualTypeOf<Result<number, Error>>();
    expect(await preserved).toMatchObject({ value: 1 });
  });

  it("flatMap chains & merges error unions", async () => {
    const r = pipe(
      ok(10),
      Result.flatMap((n) => (n > 0 ? ok(n * 2) : err(new ValidationError({ field: "n", issue: "≤0" })))),
    );
    expectTypeOf(r).toEqualTypeOf<Result<number, ValidationError>>();
    expect(await r).toMatchObject({ isOk: true, value: 20 });
  });

  it("tap / tapError allow side‑effects", async () => {
    const inSpy = vi.fn(() => {});
    const errSpy = vi.fn(() => {});

    const out1 = pipe(ok("🎉"), Result.tap(inSpy));
    expect((await out1).value).toBe("🎉");
    expect(inSpy).toHaveBeenCalledWith("🎉");
    expectTypeOf(out1).toEqualTypeOf<Result<string, never>>();

    const out2 = pipe(err("💥"), Result.tapError(errSpy));
    expect((await out2).error).toBe("💥");
    expect(errSpy).toHaveBeenCalledWith("💥");
    expectTypeOf(out2).toEqualTypeOf<Result<never, string>>();
  });

  it("orElse provides fallback", async () => {
    const r = pipe(
      err(new NetworkError({ status: 500, body: "oops" })),
      Result.orElse((e) => ok(`Recovered from ${e._tag}`)),
    );
    expectTypeOf(r).toEqualTypeOf<Result<string, never>>();
    expect(await r).toMatchObject({ isOk: true, value: "Recovered from NetworkError" });
  });

  it("tapErrorTag fires only on matching tag", async () => {
    const spy = vi.fn(() => {});
    const result = pipe(
      err(new ValidationError({ field: "x", issue: "bad" })),
      Result.tapErrorTag("ValidationError", spy),
    );
    expectTypeOf(result).toEqualTypeOf<Result<never, ValidationError>>();
    await result;
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    // @ts-expect-error wrong tag
    await pipe(err(new NetworkError({ status: 400, body: "bad" })), Result.tapErrorTag("ValidationError", spy));
    expect(spy).not.toHaveBeenCalled();
  });

  it("catchTag converts specific errors", async () => {
    const r = pipe(
      err(new ValidationError({ field: "age", issue: "negative" })),
      Result.catchTag("ValidationError", (v) => ok(`${v.field}: ${v.issue}`)),
    );
    expectTypeOf(r).toEqualTypeOf<Result<string, never>>();
    expect(await r).toMatchObject({ value: "age: negative" });
  });

  it("catchTags handles multiple error codes", async () => {
    const r = pipe(
      err(
        Math.random()
          ? new NetworkError({ status: 404, body: "not found" })
          : new ValidationError({ field: "age", issue: "negative" }),
      ),
      Result.catchTags({
        NetworkError: (n) => ok(`HTTP ${n.status}`),
        ValidationError: (v) => ok(v.issue),
      }),
    );
    expectTypeOf(r).toEqualTypeOf<Result<string, never>>();
    expect(await r).toMatchObject({ value: "HTTP 404" });
  });

  it("unwrap / unwrapOr / unwrapAsTuple", async () => {
    const okResult = ok(9);
    const unwrapped = okResult.unwrapSafe();
    expectTypeOf(unwrapped).toEqualTypeOf<Promise<number>>();
    const u = await unwrapped;
    expect(u).toBe(9);

    const v1Promise = ok(7).unwrapOr("fallback");
    expectTypeOf(v1Promise).toEqualTypeOf<Promise<number | string>>();
    const v1 = await v1Promise;

    const v2Promise = err("x").unwrapOr("fallback");
    expectTypeOf(v2Promise).toEqualTypeOf<Promise<string>>();
    const v2 = await v2Promise;

    expect(v1).toBe(7);
    expect(v2).toBe("fallback");

    const tuplePromise = ok(3).unwrapAsTuple();
    expectTypeOf(tuplePromise).toEqualTypeOf<Promise<[never, null] | [null, number]>>();
    const tuple = await tuplePromise;
    expect(tuple).toEqual([null, 3]);
  });
});

/* -------------------------------------------------- */
/*  ERROR HELPERS & TYPE GUARDS                       */
/* -------------------------------------------------- */

describe("🚦  isError type‑guard", () => {
  it("narrows Err generically", async () => {
    const r = await (Math.random() > 0.5 ? ok("hi") : err(new DatabaseError({ query: "q" })));
    expectTypeOf(r).toEqualTypeOf<Ok<string> | Err<DatabaseError>>();

    if (isError(r)) {
      expectTypeOf(r.error).toEqualTypeOf<DatabaseError>();
      expect(r.error.query).toBe("q");
    } else {
      expectTypeOf(r.value).toEqualTypeOf<string>();
      expect(r.value).toBe("hi");
    }
  });

  it("narrows specific tags", async () => {
    const r = await err(new DatabaseError({ query: "DROP" }));
    expectTypeOf(r).toEqualTypeOf<Err<DatabaseError>>();

    if (isError(r, "DatabaseError")) {
      expectTypeOf(r.error).toEqualTypeOf<DatabaseError>();
      expect(r.error.query).toBe("DROP");
    }
  });
});

/* -------------------------------------------------- */
/*  GENERATOR‑POWERED FLOWS                           */
/* -------------------------------------------------- */

describe("🔄  Result.gen", () => {
  const transfer = (fromId: number, toId: number, amount: number) =>
    Result.gen(async function* () {
      const from = yield* fetchUser(fromId);
      const to = yield* fetchUser(toId);
      const updatedFrom = yield* updateBalance(from, -amount);
      const updatedTo = yield* updateBalance(to, amount);
      return { from: updatedFrom, to: updatedTo };
    });

  expectTypeOf(transfer).toBeFunction();

  it("succeeds end‑to‑end when data happy", async () => {
    const r = await transfer(1, 1, 10); // same user to avoid 404 for toId
    expectTypeOf(r).toEqualTypeOf<
      Ok<{ from: User; to: User }> | Err<NetworkError> | Err<ValidationError> | Err<DatabaseError>
    >();
    expect(r.isOk && r.value.from.balance).toBe(90);
  });

  it("short‑circuits on first error", async () => {
    const r = await transfer(999, 1, 5); // 999 triggers 404
    expectTypeOf(r).toEqualTypeOf<
      Ok<{ from: User; to: User }> | Err<NetworkError> | Err<ValidationError> | Err<DatabaseError>
    >();
    expect(r.isError && r.error._tag).toBe("NetworkError");
  });
});

describe("🔄  Result.fn", () => {
  it("should return a function that returns a Result", async () => {
    const fn = Result.fn(async function* () {
      return "hello";
    });

    const result = fn();
    expectTypeOf(result).toEqualTypeOf<Result<string, never>>();
    expect(await result).toMatchObject({ isOk: true, value: "hello" });
  });

  it("should accept 0 arguments", async () => {
    const greet = Result.fn(async function* () {
      return "hi";
    });

    expectTypeOf(greet).toEqualTypeOf<() => Result<string, never>>();

    const result = greet();
    expect(await result).toMatchObject({ isOk: true, value: "hi" });
  });

  it("should accept 1 or more arguments", async () => {
    const add = Result.fn(async function* (a: number, b: number) {
      if (a < 0 || b < 0) {
        return yield* err(new ValidationError({ field: "input", issue: "negative numbers" }));
      }
      return a + b;
    });

    expectTypeOf(add).toEqualTypeOf<(a: number, b: number) => Result<number, ValidationError>>();

    const success = await add(2, 3);
    expect(success).toMatchObject({ isOk: true, value: 5 });

    const failure = await add(-1, 3);
    expect(failure).toMatchObject({
      isError: true,
      error: expect.objectContaining({
        _tag: "ValidationError",
        field: "input",
        issue: "negative numbers",
      }),
    });
  });

  it("fn.serializable should call .asSerializable() under the hood", async () => {
    const complexFn = Result.fn.serializable(async function* (_obj: { nested: { value: number } }) {
      yield* new ValidationError({ field: "obj", issue: "bad" });
    });

    const result = await complexFn({ nested: { value: 42 } });
    expect(result[Symbol.asyncIterator]).toBeUndefined();
    expect(result.isError && result.error).not.toBeInstanceOf(ValidationError);
  });
});

/* -------------------------------------------------- */
/*  UTILITY STATIC HELPERS                            */
/* -------------------------------------------------- */

describe("🧰  Utility functions", () => {
  it(".try() wraps sync code — success", async () => {
    const r = await Result.try(() => 7);
    expectTypeOf(r).toEqualTypeOf<Ok<number> | Err<UnknownException>>();
    expect(r).toMatchObject({ value: 7 });
  });

  it(".try() wraps sync code — failure into UnknownException", async () => {
    const r = await Result.try(() => {
      throw new Error("oops");
    });
    expectTypeOf(r).toEqualTypeOf<Err<UnknownException>>();
    expect(r.isError && r.error).toBeInstanceOf(UnknownException);
  });

  it(".try() with custom catcher", async () => {
    const r = await Result.try(
      () => {
        throw "raw";
      },
      (raw) => new ValidationError({ field: "?", issue: String(raw) }),
    );
    expectTypeOf(r).toEqualTypeOf<Err<ValidationError>>();
    expect(r.isError && r.error).toBeInstanceOf(ValidationError);
  });

  it(".all() aggregates Ok values & short‑circuits on Err", async () => {
    const mixed = Result.all([ok(1), ok(2), ok(3)]);
    expect(await mixed).toMatchObject({ value: [1, 2, 3] });
    expectTypeOf(mixed).toEqualTypeOf<Result<readonly [number, number, number], never>>();

    const bad = Result.all([ok(1), err("bork"), ok(3)]);
    expect(await bad).toMatchObject({ error: "bork" });
    expectTypeOf(bad).toEqualTypeOf<Result<readonly [number, never, number], string>>();
  });
});

/* -------------------------------------------------- */
/*  SERIALISATION SAFETY                              */
/* -------------------------------------------------- */

describe("📦  asSerializable", () => {
  it('removes Symbol.asyncIterator (to appease solutions such as Next.js "use cache")', async () => {
    const clean = await ok("clean");
    expectTypeOf(clean).toEqualTypeOf<Ok<string>>();
    expect(clean[Symbol.asyncIterator]).toBeUndefined();
  });
});
