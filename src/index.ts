import { dual } from "./utils";
export { flow, pipe } from "./utils";

/*
 * fallible – A tiny, generator‑powered Result implementation for TypeScript
 */

/* -------------------------------------------------- */
/*  Result core                                       */
/* -------------------------------------------------- */

type DistributeOk<A> = A extends Ok<infer U> ? (U extends unknown ? Ok<U> : never) : never;
type DistributeErr<E> = E extends Err<infer U> ? (U extends unknown ? Err<U> : never) : never;

type ResultLikePrimitive<A = never, E = never> = Ok<A> | Err<E>;
type ResultLikePromise<A = never, E = never> = PromiseLike<Ok<A> | Err<E>>;

export type ResultLike<A, E> = Result<A, E> | ResultLikePromise<A, E> | ResultLikePrimitive<A, E>;

type InferResult<R extends ResultLike<any, any>> =
  R extends Result<infer A, infer E>
    ? [A, E]
    : R extends Promise<infer P>
      ? P extends Ok<infer A>
        ? [A, never]
        : P extends Err<infer E>
          ? [never, E]
          : P extends Ok<infer A> | Err<infer E>
            ? [A, E]
            : never
      : R extends Ok<infer A>
        ? [A, never]
        : R extends Err<infer E>
          ? [never, E]
          : R extends Ok<infer A> | Err<infer E>
            ? [A, E]
            : never;

export interface Ok<A> {
  readonly isOk: true;
  readonly isError: false;
  readonly value: A;
  [Symbol.asyncIterator](): AsyncGenerator<never, A, unknown>;
}

export interface Err<E> {
  readonly isOk: false;
  readonly isError: true;
  readonly error: E;
  [Symbol.asyncIterator](): AsyncGenerator<Err<E>, never, unknown>;
}

const _ok = <A>(value: A): Ok<A> => ({
  isOk: true as const,
  isError: false as const,
  value,
  async *[Symbol.asyncIterator]() {
    yield undefined as never;
    return value;
  },
});

const _err = <E>(error: E): Err<E> => ({
  isOk: false as const,
  isError: true as const,
  error,
  async *[Symbol.asyncIterator]() {
    yield this;
    return undefined as never;
  },
});

export const ok = <A>(value: A): Result<A, never> => new Result(_ok(value));
export const err = <E>(error: E): Result<never, E> => new Result(_err(error));
const die = (value: unknown): Result<never, never> => {
  throw value;
};

export namespace Result {
  /* Extracts the Ok channel of a Result */
  export type InferOk<R extends ResultLike<any, any>> = InferResult<R>[0];

  /* Extracts the Err channel of a Result */
  export type InferErr<R extends ResultLike<any, any>> = InferResult<R>[1];

  /* Extracts the tags of an error type */
  export type TagsOf<E> =
    E extends Result<unknown, infer U>
      ? TagsOf<U>
      : E extends Err<infer U>
        ? TagsOf<U>
        : E extends { _tag: infer T }
          ? T extends string
            ? T
            : never
          : never;
}

export class Result<A = never, E = never> implements PromiseLike<Ok<A> | Err<E>> {
  private _promise: PromiseLike<Ok<A> | Err<E>>;

  constructor(result: ResultLike<A, E>) {
    const _promise = result instanceof Result ? result._promise : Promise.resolve(result);

    // We remove our async iterator when unwrapping the Result via await so that we just
    // get back a basic, plain object which is serializable and works with complex features
    // such as NextJS's "use cache" compiler.
    this._promise = _promise.then((r) => {
      delete (r as any)[Symbol.asyncIterator];
      return r;
    });
  }

  static of<R extends ResultLike<any, any>>(result: R): Result<Result.InferOk<R>, Result.InferErr<R>> {
    return new Result(result);
  }

  then<TResult1 = Ok<A> | Err<E>, TResult2 = never>(
    onfulfilled?:
      | ((value: DistributeOk<Ok<A>> | DistributeErr<Err<E>>) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    // @ts-expect-error - Override with distributed types above
    return this._promise.then(onfulfilled, onrejected);
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Err<E>, A> {
    const result = await this._promise;

    if (result.isError) {
      return yield _err(result.error);
    }

    return result.value;
  }

  /* -------------------------------------------------- */
  /*  Static methods                                   */
  /* -------------------------------------------------- */

  static ok = ok;
  static err = err;
  static die = die;

  static gen = gen;
  static TaggedError = TaggedError;
  static isError = isError;
  static try = try_;
  static all = all;

  /* -------------------------------------------------- */
  /*  Serialization                                     */
  /* -------------------------------------------------- */

  asSerializable(): Result<A, E> {
    return new Result(this.then((r) => JSON.parse(JSON.stringify(r))));
  }

  static asSerializable = <R extends ResultLike<any, any>>(self: R): Result<Result.InferOk<R>, Result.InferErr<R>> => {
    return new Result(self).asSerializable();
  };

  /* -------------------------------------------------- */
  /*  Manipulation helpers (dual‑powered)               */
  /* -------------------------------------------------- */

  // ---- unwrap -----------------------------------------------------------------------------

  unwrapSafe = (async () => {
    const result = await this;

    if (result.isError) {
      throw new Error("Cannot call `.unwrapSafe()` on a Result with `E != never`.");
    }

    return result.value;
  }) as [E] extends [never] ? () => Promise<A> : never;

  static unwrap = <A>(self: Result<A, never>) => {
    return self.unwrapSafe();
  };

  // ---- unwrapOr --------------------------------------------------------------------------
  async unwrapOr<A2>(fallback: A2): Promise<A | A2> {
    return this.then((r) => (r.isOk ? r.value : fallback));
  }

  static unwrapOr = dual<
    <A2>(fallback: A2) => <A, E>(self: Result<A, E>) => Promise<A | A2>,
    <A2, A, E>(self: Result<A, E>, fallback: A2) => Promise<A | A2>
  >(2, (self, fallback) => self.unwrapOr(fallback));

  // ---- unwrapAsTuple ---------------------------------------------------------------------
  async unwrapAsTuple(): Promise<[E, null] | [null, A]> {
    return this.then((r) => (r.isOk ? [null, r.value] : [r.error, null]));
  }

  static unwrapAsTuple = <A, E>(self: Result<A, E>): Promise<[E, null] | [null, A]> => {
    return self.unwrapAsTuple();
  };

  // ---- map -------------------------------------------------------------------------------
  map<A2>(cb: (value: A) => A2): Result<A2, E> {
    return new Result(this.then((r) => (r.isOk ? _ok(cb(r.value)) : _err(r.error))));
  }

  static map = dual<
    <A2, A>(cb: (value: A) => A2) => <E>(self: Result<A, E>) => Result<A2, E>,
    <A2, A, E>(self: Result<A, E>, cb: (value: A) => A2) => Result<A2, E>
  >(2, (self, cb) => self.map(cb));

  // ---- mapError --------------------------------------------------------------------------
  mapError<E2>(cb: (e: E) => E2): Result<A, E2> {
    return new Result(this.then(async (r) => (r.isError ? _err(await cb(r.error)) : r)));
  }

  static mapError = dual<
    <E2, E>(cb: (e: E) => E2) => <A>(self: Result<A, E>) => Result<A, E2>,
    <E2, A, E>(self: Result<A, E>, cb: (e: E) => E2) => Result<A, E2>
  >(2, (self, cb) => self.mapError(cb));

  // ---- flatMap / andThen -----------------------------------------------------------------
  flatMap<A2 = never, E2 = never>(cb: (a: A) => Result<A2, E2> | A2): Result<A2, E | E2> {
    return new Result(
      this.then(async (r) => {
        if (r.isError) return _err(r.error);
        const out = cb(r.value);
        return out instanceof Result ? await out : _ok(out);
      }),
    );
  }

  static flatMap = dual<
    <A, A2 = never, E2 = never>(cb: (a: A) => Result<A2, E2> | A2) => <E>(self: Result<A, E>) => Result<A2, E | E2>,
    <A, E, A2 = never, E2 = never>(self: Result<A, E>, cb: (a: A) => Result<A2, E2> | A2) => Result<A2, E | E2>
  >(2, (self, cb) => self.flatMap(cb));

  andThen<A2 = never, E2 = never>(cb: (a: A) => Result<A2, E2> | A2): Result<A2, E | E2> {
    return this.flatMap(cb);
  }

  static andThen = this.flatMap;

  // ---- tap -------------------------------------------------------------------------------
  tap<E2 = never>(cb: (a: A) => Result<never, E2> | void): Result<A, E | E2> {
    return new Result(
      this.then(async (r) => {
        if (r.isError) return r;
        const out = await cb(r.value);
        return out && out.isError ? _err(out.error) : r;
      }),
    );
  }

  static tap = dual<
    <A, E2 = never>(cb: (a: A) => Result<never, E2> | void) => <E>(self: Result<A, E>) => Result<A, E | E2>,
    <A, E, E2 = never>(self: Result<A, E>, cb: (a: A) => Result<never, E2> | void) => Result<A, E | E2>
  >(2, (self, cb) => self.tap(cb));

  // ---- tapError --------------------------------------------------------------------------
  tapError<E2 = never>(cb: (e: E) => Result<unknown, E2> | void): Result<A, E | E2> {
    return new Result(
      this.then(async (r) => {
        if (r.isOk) return r;
        const out = await cb(r.error);
        return out && out.isError ? _err(out.error) : r;
      }),
    );
  }

  static tapError = dual<
    <E, E2 = never>(cb: (e: E) => Result<unknown, E2> | void) => <A>(self: Result<A, E>) => Result<A, E | E2>,
    <A, E, E2 = never>(self: Result<A, E>, cb: (e: E) => Result<unknown, E2> | void) => Result<A, E | E2>
  >(2, (self, cb) => self.tapError(cb));

  // ---- tapErrorTag -----------------------------------------------------------------------
  tapErrorTag<const Tag extends Result.TagsOf<E>, E2 = never>(
    tag: Tag,
    cb: (err: Extract<E, { _tag: Tag }>) => Result<unknown, E2> | void,
  ): Result<A, E | E2> {
    return new Result(
      this.then(async (r) => {
        if (r.isOk) return r;
        if ((r.error as any)._tag !== tag) return r;
        const out = await cb(r.error as any);
        return out && out.isError ? _err(out.error) : r;
      }),
    );
  }

  static tapErrorTag = dual<
    <const Tag extends Result.TagsOf<E>, E, E2 = never>(
      tag: Tag,
      cb: (err: Extract<E, { _tag: Tag }>) => Result<unknown, E2> | void,
    ) => <A>(self: Result<A, E>) => Result<A, E | E2>,
    <const Tag extends Result.TagsOf<E>, A, E, E2 = never>(
      self: Result<A, E>,
      tag: Tag,
      cb: (err: Extract<E, { _tag: Tag }>) => Result<unknown, E2> | void,
    ) => Result<A, E | E2>
  >(3, (self, tag, cb) => self.tapErrorTag(tag, cb));

  // ---- orElse ----------------------------------------------------------------------------
  orElse<A2, E2>(cb: (e: E) => Result<A2, E2>): Result<A | A2, E2> {
    return new Result(this.then(async (r) => (r.isOk ? r : await cb(r.error))));
  }

  static orElse = dual<
    <A2, E2, E>(cb: (e: E) => Result<A2, E2>) => <A>(self: Result<A, E>) => Result<A | A2, E2>,
    <A2, E2, A, E>(self: Result<A, E>, cb: (e: E) => Result<A2, E2>) => Result<A | A2, E2>
  >(2, (self, cb) => self.orElse(cb));

  // ---- catchTag --------------------------------------------------------------------------
  catchTag<const Tag extends Result.TagsOf<E>, A2, E2>(
    tag: Tag,
    cb: (e: Extract<E, { _tag: Tag }>) => Result<A2, E2>,
  ): Result<A | A2, Exclude<E, { _tag: Tag }> | E2> {
    return new Result(
      this.then(async (r) => {
        if (r.isOk) return r;
        if ((r.error as any)._tag !== tag) return r as any;
        return await cb(r.error as any);
      }),
    );
  }

  static catchTag = dual<
    <E, const Tag extends Result.TagsOf<E>, A2, E2>(
      tag: Tag,
      cb: (e: Extract<E, { _tag: Tag }>) => Result<A2, E2>,
    ) => <A>(self: Result<A, E>) => Result<A | A2, Exclude<E, { _tag: Tag }> | E2>,
    <E, const Tag extends Result.TagsOf<E>, A2, E2, A>(
      self: Result<A, E>,
      tag: Tag,
      cb: (e: Extract<E, { _tag: Tag }>) => Result<A2, E2>,
    ) => Result<A | A2, Exclude<E, { _tag: Tag }> | E2>
  >(3, (self, tag, cb) => self.catchTag(tag, cb));

  // ---- catchTags -------------------------------------------------------------------------
  catchTags<
    Cases extends {
      [K in Result.TagsOf<E>]+?: (error: Extract<E, { _tag: K }>) => Result<any, any>;
    } & (unknown extends E ? {} : { [K in Exclude<keyof Cases, Result.TagsOf<E>>]: never }),
  >(
    cases: Cases,
  ): Result<
    | A
    | {
        [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Result<infer A, any> ? A : never;
      }[keyof Cases],
    | Exclude<E, { _tag: keyof Cases }>
    | {
        [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Result<any, infer E> ? E : never;
      }[keyof Cases]
  > {
    return new Result(
      this.then(async (r) => {
        if (r.isOk) return r;
        const cb =
          typeof r.error === "object" && r.error && "_tag" in r.error && typeof r.error._tag === "string"
            ? cases[r.error._tag as keyof typeof cases]
            : null;
        if (!cb) return r as any;
        return await cb(r.error as any);
      }),
    );
  }

  static catchTags = dual<
    <
      Cases extends {
        [K in Result.TagsOf<E>]+?: (error: Extract<E, { _tag: K }>) => Result<any, any>;
      } & (unknown extends E
        ? {}
        : {
            [K in Exclude<keyof Cases, Result.TagsOf<E>>]: never;
          }),
      A,
      E,
    >(
      cases: Cases,
    ) => (self: Result<A, E>) => Result<
      | A
      | {
          [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Result<infer A, any> ? A : never;
        }[keyof Cases],
      | Exclude<E, { _tag: keyof Cases }>
      | {
          [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Result<any, infer E> ? E : never;
        }[keyof Cases]
    >,
    <
      Cases extends {
        [K in Result.TagsOf<E>]+?: (error: Extract<E, { _tag: K }>) => Result<any, any>;
      } & (unknown extends E
        ? {}
        : {
            [K in Exclude<keyof Cases, Result.TagsOf<E>>]: never;
          }),
      A,
      E,
    >(
      self: Result<A, E>,
      cases: Cases,
    ) => Result<
      | A
      | {
          [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Result<infer A, any> ? A : never;
        }[keyof Cases],
      | Exclude<E, { _tag: keyof Cases }>
      | {
          [K in keyof Cases]: Cases[K] extends (...args: Array<any>) => Result<any, infer E> ? E : never;
        }[keyof Cases]
    >
  >(2, (self, cases) => self.catchTags(cases));
}

/* -------------------------------------------------- */
/*  Result.gen                                        */
/* -------------------------------------------------- */

type GeneratorYield<G> = G extends AsyncGenerator<infer Y, any, any> ? Y : never;

type GeneratorReturn<G> = G extends AsyncGenerator<any, infer R, any> ? R : never;

function runAsync_<G extends AsyncGenerator<any, any, any>>(
  iterator: G,
): Result<GeneratorReturn<G>, Result.InferErr<GeneratorYield<G>>> {
  return new Result(
    (async () => {
      while (true) {
        const step = await iterator.next();
        if (step.done) return _ok(step.value) as any;
        const yielded = step.value as any;
        if ("isError" in yielded && yielded.isError === true) {
          return yielded as any;
        }
      }
    })(),
  );
}

function gen<G extends AsyncGenerator<any, any, any>>(
  fn: () => G,
): Result<GeneratorReturn<G>, Result.InferErr<GeneratorYield<G>>> {
  const iterator = fn();
  return runAsync_(iterator);
}

gen.serializable = function <G extends AsyncGenerator<any, any, any>>(fn: () => G) {
  return this(fn).asSerializable();
};

/* -------------------------------------------------- */
/*  Errors Helpers                                    */
/* -------------------------------------------------- */

class YieldableError extends Error {
  async *[Symbol.asyncIterator](): AsyncGenerator<Err<this>, never, unknown> {
    yield _err(this);
    return undefined as never;
  }
}

export function TaggedError<Tag extends string>(
  tag: Tag,
): new <Payload extends {} = {}>(
  args: keyof Payload extends never
    ? void
    : { readonly [P in keyof Payload as P extends "_tag" ? never : P]: Payload[P] },
) => YieldableError & { readonly _tag: Tag } & Readonly<Payload> {
  const Base = {
    Error: class extends YieldableError {
      readonly _tag = tag;

      constructor(payload: any) {
        super(payload?.message, payload?.cause ? { cause: payload.cause } : undefined);
        Object.setPrototypeOf(this, new.target.prototype);
        Object.assign(this, payload);
      }

      toJSON() {
        const { toJSON, ...properties } = this;
        return { _tag: this._tag, ...JSON.parse(JSON.stringify(properties)) };
      }
    } as any,
  };
  Base.Error.prototype.name = tag;
  return Base.Error;
}

export class UnknownException extends TaggedError("UnknownException")<{
  cause: unknown;
  message?: string | undefined;
}> {
  constructor(error: { cause: unknown; message?: string }) {
    super(error);
    this.message = error.message || "An unknown exception occurred";
  }

  toJSON() {
    return { _tag: this._tag, message: this.message, cause: this.cause };
  }
}

export function isError<Result extends ResultLike<unknown, unknown>>(
  value: Result,
): value is Extract<Result, Err<unknown>>;
export function isError<
  Result extends ResultLike<unknown, unknown>,
  const Tag extends Result.TagsOf<Result.InferErr<Result>>,
>(value: Result, tag: Tag): value is Extract<Result, Err<{ _tag: Tag }>>;
export function isError(value: any, tag?: string): boolean {
  if (value && value.isError === true) {
    if (tag === undefined) return true;
    const errVal = value.error;
    return errVal && typeof errVal === "object" && errVal._tag === tag;
  }
  return false;
}

/* -------------------------------------------------- */
/*  Utility                                           */
/* -------------------------------------------------- */

function try_<A, E>(tryFn: () => A, catchFn: (e: unknown) => E): Result<Awaited<A>, E>;
function try_<A>(tryFn: () => A): Result<Awaited<A>, UnknownException>;
function try_<A, E>(tryFn: () => A, catchFn?: (e: unknown) => E) {
  const handleError = catchFn || ((e: unknown) => new UnknownException({ cause: e }));

  try {
    return new Result(
      Promise.resolve(tryFn()).then(
        (r) => _ok(r),
        (e) => _err(handleError(e)),
      ),
    );
  } catch (e) {
    return new Result(Promise.resolve(_err(handleError(e))));
  }
}

function all<const R extends readonly Result<any, any>[]>(
  results: R,
): Result<
  { [K in keyof R]: R[K] extends Result<infer A, any> ? A : never },
  { [K in number]: R[K] extends Result<any, infer E> ? E : never }[number]
> {
  return new Result(
    Promise.all(results).then((results) => {
      const values: any[] = [];
      for (const res of results) {
        if (res.isError) return res;
        values.push(res.value);
      }
      return _ok(values as any);
    }),
  );
}

/* -------------------------------------------------- */
/*  Utility                                           */
/* -------------------------------------------------- */

// /** Utility type to serialize a value to a JSON-serializable object */
// type SerializeJSON<T> = T extends (...args: any[]) => any
//   ? never
//   : T extends object
//     ? {
//         [P in keyof T as SerializeJSON<T[P]> extends never ? never : P]: SerializeJSON<T[P]>;
//       }
//     : T extends undefined | null | string | number | boolean
//       ? T
//       : never;
