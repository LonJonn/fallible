import { describe, expect, expectTypeOf, it } from "vitest";
import { Result, UnknownException, err, isError, ok, pipe } from "../src";

class TestError extends Result.TaggedError("TestError")<{ message: string }> {}
class AnotherError extends Result.TaggedError("AnotherError")<{ message: string }> {}

describe("Scratchpad", () => {
  it("_", async () => {
    // Empty
  });
});

describe("Result", () => {
  describe("Creation and basic functionality", () => {
    it("should create Ok result", async () => {
      const result = ok(42);
      const value = await result;
      expect(value.isOk).toBe(true);
      if (value.isOk) expect(value.value).toBe(42);
    });

    it("should create Err result", async () => {
      const result = err("error");
      const value = await result;
      expect(value.isError).toBe(true);
      if (value.isError) expect(value.error).toBe("error");
    });

    it("should be thenable", async () => {
      const okResult = await ok(42);
      if (okResult.isOk) expect(okResult.value).toBe(42);

      const errResult = await err("error");
      if (errResult.isError) expect(errResult.error).toBe("error");
    });
  });

  describe("Serialization", () => {
    it("removes [Symbol.asyncIterator] when serialized", async () => {
      const result = ok(42).asSerializable();
      const value = await result;
      expect(value[Symbol.asyncIterator]).toBeUndefined();
    });

    it("serializes YieldableError", async () => {
      const result = Result.gen.serializable(async function* () {
        yield* new TestError({ message: "test" });
        yield* new AnotherError({ message: "another" });
      })();

      const value = await result;
      expect(value.isError).toBe(true);
      if (value.isError) expect(value.error).not.toBeInstanceOf(TestError);
      if (value.isError) expect(value.error.message).toBe("test");
    });
  });

  describe("Result methods", () => {
    it(".unwrap() has correct types", async () => {
      const r = Result.try(() => 42);
      const r2 = ok(42);

      expectTypeOf(r.unwrap).toEqualTypeOf<never>();
      expectTypeOf(r2.unwrap).toEqualTypeOf<() => Promise<number>>();
    });

    it("should map Ok values", async () => {
      const result = await pipe(
        ok(42),
        Result.map((x: number) => x * 2),
      );
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(84);
    });

    it("should not map Err values", async () => {
      const result = await pipe(
        err("error"),
        Result.map((x: number) => x * 2),
      );
      expect(result.isError).toBe(true);
      if (result.isError) expect(result.error).toBe("error");
    });

    it("should mapError for Err values", async () => {
      const result = await pipe(
        err("error"),
        Result.mapError((e: string) => e.toUpperCase()),
      );
      expect(result.isError).toBe(true);
      if (result.isError) expect(result.error).toBe("ERROR");
    });

    it("should not mapError for Ok values", async () => {
      const result = await pipe(
        ok(42),
        Result.mapError((e: string) => e.toUpperCase()),
      );
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(42);
    });

    it("should flatMap Ok values", async () => {
      const result = await pipe(
        ok(42),
        Result.flatMap((x: number) => ok(x * 2)),
      );
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(84);
    });

    it("should handle flatMap errors", async () => {
      const result = await pipe(
        ok(42),
        Result.flatMap(() => err("error")),
      );
      expect(result.isError).toBe(true);
      if (result.isError) expect(result.error).toBe("error");
    });

    it("should tap Ok values", async () => {
      let sideEffect = 0;
      const result = await pipe(
        ok(42),
        Result.tap((x: number) => {
          sideEffect = x;
        }),
      );
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(42);
      expect(sideEffect).toBe(42);
    });

    it("should tap errors", async () => {
      let sideEffect = "";
      const result = await pipe(
        err("error"),
        Result.tapError((e: string) => {
          sideEffect = e;
        }),
      );
      expect(result.isError).toBe(true);
      if (result.isError) expect(result.error).toBe("error");
      expect(sideEffect).toBe("error");
    });

    it("should instance method unwrapOr with fallback", async () => {
      const okResult = ok(42);
      expect(await okResult.unwrapOr(0)).toBe(42);

      const errResult = err("error");
      expect(await errResult.unwrapOr(0)).toBe(0);
    });

    it("should static method unwrapOr with fallback", async () => {
      const okResult = ok(42);
      expect(await pipe(okResult, Result.unwrapOr(0))).toBe(42);

      const errResult = err("error");
      expect(await pipe(errResult, Result.unwrapOr(0))).toBe(0);
    });

    it("should instance method unwrapAsTuple", async () => {
      const result = Result.gen(async function* () {
        if (Math.random()) {
          yield* new AnotherError({ message: "bad" });
          return yield* new TestError({ message: "bad" });
        }

        return 42;
      })();

      const [error, value] = await result.unwrapAsTuple();

      expect(error).toBeInstanceOf(AnotherError);
      expect(value).toBeNull();
    });

    it("should instance method unwrapAsTuple", async () => {
      const result = await Result.gen(async function* () {
        if (Math.random()) {
          yield* new AnotherError({ message: "bad" });
          return yield* new TestError({ message: "bad" });
        }

        return 42;
      })();

      const [error, value] = await pipe(result, Result.unwrapAsTuple);

      expect(error).toBeInstanceOf(AnotherError);
      expect(value).toBeNull();
    });
  });

  describe("TaggedError and error handling", () => {
    it("should create tagged errors", () => {
      const error = new TestError({ message: "test" });
      expect(error._tag).toBe("TestError");
      expect(error.message).toBe("test");
    });

    it("should catch specific error tags", async () => {
      const result = await pipe(
        err(new TestError({ message: "test" })),
        Result.catchTag("TestError", (e: TestError) => ok(e.message.toUpperCase())),
      );
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe("TEST");
    });

    it("should handle multiple error tags", async () => {
      const result = await pipe(
        err(Math.random() > 0 ? new TestError({ message: "test" }) : new AnotherError({ message: "another" })),
        Result.catchTags({
          TestError: (e) => ok(e.message.toUpperCase()),
          AnotherError: (e) => ok(e.message.toLowerCase()),
        }),
      );
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe("TEST");
    });

    it("should greedy narrow types with isError", async () => {
      const result = await (Math.random()
        ? err(new TestError({ message: "test" }))
        : Math.random()
          ? err(new AnotherError({ message: "another" }))
          : ok("yes"));

      if (isError(result)) {
        expect(result.isError).toBe(true);
      }
    });

    it("should narrow specific types with isError", async () => {
      const result = await (Math.random()
        ? err(new TestError({ message: "test" }))
        : Math.random()
          ? err(new AnotherError({ message: "another" }))
          : ok("yes"));

      if (isError(result, "TestError")) {
        expect(result.error.message).toBe("test");
      }
    });
  });

  describe("Generator functionality", () => {
    it("should handle generator success", async () => {
      const gen = Result.gen(async function* () {
        const a = yield* ok(1);
        const b = yield* ok(2);
        return a + b;
      });

      const result = await gen();
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(3);
    });

    it("should handle errors", async () => {
      const gen = Result.gen(async function* () {
        yield* ok(1);
        yield* err("error");
        return 42; // Should not reach here
      });

      const result = await gen();
      expect(result.isError).toBe(true);
      if (result.isError) expect(result.error).toBe("error");
    });

    it("should handle tagged errors", async () => {
      const gen = Result.gen(async function* () {
        yield* ok(1);
        yield* new TestError({ message: "error" });
        return 42; // Should not reach here
      });

      const result = await gen();
      expect(result.isError).toBe(true);
      if (result.isError) expect(result.error.message).toBe("error");
    });
  });

  describe("Utility functions", () => {
    it("should handle try with success", async () => {
      const result = await Result.try(() => 42);
      expect(result.isOk).toBe(true);
      if (result.isOk) expect(result.value).toBe(42);
    });

    it("should handle try with error", async () => {
      const result = await Result.try(() => {
        throw new Error("test");
      });
      expect(result.isError).toBe(true);
      if (result.isError) {
        expect(result.error.message).toBe("An unknown exception occurred");
        expect(result.error).toBeInstanceOf(UnknownException);
        expect(result.error.cause).toBeInstanceOf(Error);
      }
    });

    it("should throw with Result.die", async () => {
      const result = pipe(
        err(new TestError({ message: "test" })),
        Result.catchTag("TestError", (e) => Result.die(e)),
      );

      await expect(result).rejects.toThrow();
    });

    it("should handle try with custom error handling", async () => {
      const result = await Result.try({
        try: () => {
          throw new Error("test");
        },
        catch: (e: unknown) => "caught: " + (e as Error).message,
      });
      expect(result.isError).toBe(true);
      if (result.isError) expect(result.error).toBe("caught: test");
    });

    it("should handle all with success", async () => {
      const results = await Result.all([ok(1), ok(2), ok(3)]);
      expect(results.isOk).toBe(true);
      if (results.isOk) expect(results.value).toEqual([1, 2, 3]);
    });

    it("should handle all with error", async () => {
      const results = await Result.all([ok(1), err("error"), ok(3)]);
      expect(results.isError).toBe(true);
      if (results.isError) expect(results.error).toBe("error");
    });
  });
});
