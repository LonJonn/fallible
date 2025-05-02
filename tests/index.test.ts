/**
 * Comprehensive test‑suite for `@lonjonn/fallible`
 * ------------------------------------------------
 * The scenarios mimic a tiny “banking” domain to exercise every public
 * surface‑area of the library with semi‑realistic flows rather than
 * contrived `TestError` values.
 *
 * Runtime assertions use Vitest; type‑level assertions use `expectTypeOf`.
 *
 * What’s covered?
 *  • Static helpers — ok, err, die, gen, TaggedError, isError, try, all
 *  • Instance helpers — unwrap(+Overloads), map/flatMap/tap chain, etc.
 *  • Type utilities   — InferOk/InferErr/TagsOf, conditional unwrap, …
 *  • Generator API    — happy‑path + early‑error, serialisable variant.
 *  • JSON safety      — asSerializable removes Symbol.asyncIterator.
 */

import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { Result, ok, err, pipe, isError, UnknownException, type Ok, type Err } from "../src";

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

const fetchUser = Result.gen(async function* (id: number) {
  if (id !== 1) {
    return yield* new NetworkError({ status: 404, body: "Not found" });
  }

  return {
    id: 1,
    name: "Alice",
    balance: 100,
  };
});

const updateBalance = Result.gen(async function* (user: User, delta: number) {
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
  });

  it("TagsOf collects `_tag` literals deeply", () => {
    type Tags = Result.TagsOf<DomainError | { _tag: "Other" }>;
    expectTypeOf<Tags>().toEqualTypeOf<"ValidationError" | "NetworkError" | "DatabaseError" | "Other">();
  });

  it("`.unwrap` is available only when E = never", () => {
    expectTypeOf(ok(1).unwrap).toEqualTypeOf<() => Promise<number>>();
    expectTypeOf(err("bad").unwrap).toEqualTypeOf<never>();
  });
});

/* -------------------------------------------------- */
/*  STATIC CONSTRUCTORS & BASIC BEHAVIOUR             */
/* -------------------------------------------------- */

describe("🏗️  Construction helpers", () => {
  it("ok / err produce the right tagged objects", async () => {
    const o = await ok(42);
    const e = await err("nope");

    expect(o).toMatchObject({ isOk: true, value: 42 });
    expect(e).toMatchObject({ isError: true, error: "nope" });
  });

  it("die throws immediately", () => {
    expect(() => Result.die(new Error("boom"))).toThrow("boom");
  });

  it("async iterator semantics", async () => {
    /* ok values yield nothing & return value */
    const o = ok("yes");
    const vals: any[] = [];
    for await (const v of o) vals.push(v);
    expect(vals).toEqual([]);

    /* err values yield themselves */
    const e = err("fail");
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
    expect(
      await pipe(
        ok(2),
        Result.map((n) => n * 2),
      ),
    ).toMatchObject({ isOk: true, value: 4 });
    expect(
      await pipe(
        err("x"),
        Result.map((n: number) => n * 2),
      ),
    ).toMatchObject({ isError: true, error: "x" });
  });

  it("mapError transforms Err & preserves Ok", async () => {
    const upper = await pipe(
      err("bad"),
      Result.mapError((s) => s.toUpperCase()),
    );
    expect(upper).toMatchObject({ error: "BAD" });

    expect(
      await pipe(
        ok(1),
        Result.mapError(() => new Error()),
      ),
    ).toMatchObject({ value: 1 });
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
    const inSpy = vi.fn();
    const errSpy = vi.fn();

    const out1 = await pipe(ok("🎉"), Result.tap(inSpy));
    expect(inSpy).toHaveBeenCalledWith("🎉");
    expect(out1.value).toBe("🎉");

    const out2 = await pipe(err("💥"), Result.tapError(errSpy));
    expect(errSpy).toHaveBeenCalledWith("💥");
    expect(out2.error).toBe("💥");
  });

  it("orElse provides fallback", async () => {
    const r = await pipe(
      err(new NetworkError({ status: 500, body: "oops" })),
      Result.orElse((e) => ok(`Recovered from ${e._tag}`)),
    );
    expect(r).toMatchObject({ isOk: true, value: "Recovered from NetworkError" });
  });

  it("tapErrorTag fires only on matching tag", async () => {
    const spy = vi.fn(() => {});
    await pipe(err(new ValidationError({ field: "x", issue: "bad" })), Result.tapErrorTag("ValidationError", spy));
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    // @ts-expect-error wrong tag
    await pipe(err(new NetworkError({ status: 400, body: "bad" })), Result.tapErrorTag("ValidationError", spy));
    expect(spy).not.toHaveBeenCalled();
  });

  it("catchTag converts specific errors", async () => {
    const r = await pipe(
      err(new ValidationError({ field: "age", issue: "negative" })),
      Result.catchTag("ValidationError", (v) => ok(`${v.field}: ${v.issue}`)),
    );
    expect(r).toMatchObject({ value: "age: negative" });
  });

  it("catchTags handles multiple error codes", async () => {
    const r = await pipe(
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
    expect(r).toMatchObject({ value: "HTTP 404" });
  });

  it("unwrap / unwrapOr / unwrapAsTuple", async () => {
    const u = await ok(9).unwrap();
    expect(u).toBe(9);

    const v1 = await ok(7).unwrapOr("fallback");
    const v2 = await err("x").unwrapOr("fallback");
    expect(v1).toBe(7);
    expect(v2).toBe("fallback");

    const tuple = await ok(3).unwrapAsTuple();
    expect(tuple).toEqual([null, 3]);
  });
});

/* -------------------------------------------------- */
/*  ERROR HELPERS & TYPE GUARDS                       */
/* -------------------------------------------------- */

describe("🚦  isError type‑guard", () => {
  it("narrows Err generically", async () => {
    const r = await (Math.random() > 0.5 ? ok("hi") : err(new DatabaseError({ query: "q" })));
    if (isError(r)) {
      expectTypeOf(r.error).toEqualTypeOf<DatabaseError>();
      expect(r.error.query).toBe("q");
    } else {
      expect(r.value).toBe("hi");
    }
  });

  it("narrows specific tags", async () => {
    const r = await err(new DatabaseError({ query: "DROP" }));
    if (isError(r, "DatabaseError")) {
      expect(r.error.query).toBe("DROP");
    }
  });
});

/* -------------------------------------------------- */
/*  GENERATOR‑POWERED FLOWS                           */
/* -------------------------------------------------- */

describe("🔄  Result.gen", () => {
  const transfer = Result.gen(async function* (fromId: number, toId: number, amount: number) {
    const from = yield* fetchUser(fromId);
    const to = yield* fetchUser(toId);
    const updatedFrom = yield* updateBalance(from, -amount);
    const updatedTo = yield* updateBalance(to, amount);
    return { from: updatedFrom, to: updatedTo };
  });

  it("succeeds end‑to‑end when data happy", async () => {
    const r = await transfer(1, 1, 10); // same user to avoid 404 for toId
    expect(r.isOk && r.value.from.balance).toBe(90);
  });

  it("short‑circuits on first error", async () => {
    const r = await transfer(999, 1, 5); // 999 triggers 404
    expect(r.isError && r.error._tag).toBe("NetworkError");
  });

  it("serialisable generator removes iterator", async () => {
    const serialisable = Result.gen.serializable(async function* () {
      yield* new DatabaseError({ query: "DROP" });
      return "bar";
    });
    const r = await serialisable();
    expect(r.isError && r.error).not.toBeInstanceOf(DatabaseError);
    expect(r.isError && r.error._tag).toBe("DatabaseError");
  });
});

/* -------------------------------------------------- */
/*  UTILITY STATIC HELPERS                            */
/* -------------------------------------------------- */

describe("🧰  Utility functions", () => {
  it("try wraps sync code — success", async () => {
    const r = await Result.try(() => 7);
    expect(r).toMatchObject({ value: 7 });
  });

  it("try wraps sync code — failure into UnknownException", async () => {
    const r = await Result.try(() => {
      throw new Error("oops");
    });
    expect(r.isError && r.error).toBeInstanceOf(UnknownException);
  });

  it("try with custom catcher", async () => {
    const r = await Result.try({
      try: () => {
        throw "raw";
      },
      catch: (raw) => new ValidationError({ field: "?", issue: String(raw) }),
    });
    expect(r.isError && r.error).toBeInstanceOf(ValidationError);
  });

  it("all aggregates Ok values & short‑circuits on Err", async () => {
    const mixed = await Result.all([ok(1), ok(2), ok(3)]);
    expect(mixed).toMatchObject({ value: [1, 2, 3] });

    const bad = await Result.all([ok(1), err("bork"), ok(3)]);
    expect(bad).toMatchObject({ error: "bork" });
  });
});

/* -------------------------------------------------- */
/*  SERIALISATION SAFETY                              */
/* -------------------------------------------------- */

describe("📦  asSerializable", () => {
  it('removes Symbol.asyncIterator (to appease solutions such as Next.js "use cache")', async () => {
    const clean = await ok("clean");
    expect(clean[Symbol.asyncIterator]).toBeUndefined();
  });
});
