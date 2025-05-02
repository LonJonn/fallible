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

type ResultLike<A = never, E = never> = DistributeOk<Ok<A>> | DistributeErr<Err<E>>;
type ResultLikeIso<A = never, E = never> = ResultLike<A, E> | Promise<ResultLike<A, E>>;

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

export const ok = <A>(value: A): Result<A, never> => new Result(Promise.resolve(_ok(value)));
export const err = <E>(error: E): Result<never, E> => new Result(Promise.resolve(_err(error)));
const die = (value: unknown): Result<never, never> => {
  throw value;
};

export namespace Result {
  /* Extracts the Ok channel of a Result */
  export type InferOk<Y> = Y extends Result<infer A, any> ? A : Y extends Ok<infer A> ? A : never;

  /* Extracts the Err channel of a Result */
  export type InferErr<Y> = Y extends Result<any, infer E> ? E : Y extends Err<infer E> ? E : never;

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

  constructor(res: PromiseLike<Ok<A> | Err<E>>) {
    // We remove our async iterator when unwrapping the Result via await so that we just
    // get back a basic, plain object which is serializable and works with complex features
    // such as NextJS's "use cache" compiler.
    this._promise = res.then((r) => {
      delete (r as any)[Symbol.asyncIterator];
      return r;
    });
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
  /*  Serialization                                     */
  /* -------------------------------------------------- */

  static asSerializable<A, E>(self: Result<A, E>) {
    return new Result(Promise.resolve(self).then((r) => JSON.parse(JSON.stringify(r))));
  }

  asSerializable = Result.asSerializable.bind(null, this) as () => Result<A, E>;

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
  /*  Manipulation helpers (dual‑powered)               */
  /* -------------------------------------------------- */

  // ---- unwrap -----------------------------------------------------------------------------
  static unwrap = <A>(self: Result<A, never> | ResultLikeIso<A, never>): Promise<A> =>
    Promise.resolve(self).then((r) => {
      if (r.isError) {
        throw new Error("Cannot unwrap an Err value");
      }
      return r.value;
    });

  unwrap = Result.unwrap.bind(null, this as any) as [E] extends [never] ? () => Promise<A> : never;

  // ---- unwrapOr --------------------------------------------------------------------------
  static unwrapOr = dual<
    <A2>(fallback: A2) => <A = never, E = never>(self: Result<A, E> | ResultLikeIso<A, E>) => Promise<A | A2>,
    <A2, A = never, E = never>(self: Result<A, E> | ResultLikeIso<A, E>, fallback: A2) => Promise<A | A2>
  >(2, (self, fallback) => Promise.resolve(self).then((r) => (r.isOk ? r.value : fallback)));

  unwrapOr = Result.unwrapOr.bind(null, this) as <A2>(fallback: A2) => Promise<A | A2>;

  // ---- unwrapAsTuple ---------------------------------------------------------------------
  static unwrapAsTuple = <R extends Result<any, any> | ResultLikeIso<any, any>>(
    self: R,
  ): Promise<[Result.InferErr<R>, null] | [null, Result.InferOk<R>]> =>
    Promise.resolve(self).then((r) => (r.isOk ? [null, r.value] : [r.error, null]));

  unwrapAsTuple = Result.unwrapAsTuple.bind(null, this) as () => Promise<
    [Result.InferErr<this>, null] | [null, Result.InferOk<this>]
  >;

  // ---- map -------------------------------------------------------------------------------
  static map = dual<
    <A2, A = never>(cb: (value: A) => A2) => <E = never>(self: Result<A, E> | ResultLikeIso<A, E>) => Result<A2, E>,
    <A2, A = never, E = never>(self: Result<A, E> | ResultLikeIso<A, E>, cb: (value: A) => A2) => Result<A2, E>
  >(2, (self, cb) => new Result(Promise.resolve(self).then((r) => (r.isOk ? _ok(cb(r.value)) : r))));

  map = Result.map.bind(null, this) as <A2>(cb: (value: A) => A2) => Result<A2, E>;

  // ---- mapError --------------------------------------------------------------------------
  static mapError = dual<
    <E2, E = never>(cb: (e: E) => E2) => <A = never>(self: Result<A, E> | ResultLikeIso<A, E>) => Result<A, E2>,
    <E2, A = never, E = never>(self: Result<A, E> | ResultLikeIso<A, E>, cb: (e: E) => E2) => Result<A, E2>
  >(2, (self, cb) => new Result(Promise.resolve(self).then((r) => (r.isError ? _err(cb(r.error)) : r))));

  mapError = Result.mapError.bind(null, this) as <E2>(cb: (e: E) => E2) => Result<A, E2>;

  // ---- flatMap / andThen -----------------------------------------------------------------
  static flatMap = dual<
    <A = never, A2 = never, E2 = never>(
      cb: (a: A) => Result<A2, E2> | A2,
    ) => <E = never>(self: Result<A, E> | ResultLikeIso<A, E>) => Result<A2, E | E2>,
    <A = never, E = never, A2 = never, E2 = never>(
      self: Result<A, E> | ResultLikeIso<A, E>,
      cb: (a: A) => Result<A2, E2> | A2,
    ) => Result<A2, E | E2>
  >(
    2,
    (self, cb) =>
      new Result(
        Promise.resolve(self).then(async (r) => {
          if (r.isError) return _err(r.error);
          const out = cb(r.value);
          return out instanceof Result ? out : _ok(out);
        }),
      ),
  );

  flatMap = Result.flatMap.bind(null, this) as <A2 = never, E2 = never>(
    cb: (a: A) => Result<A2, E2> | A2,
  ) => Result<A2, E | E2>;

  static andThen = this.flatMap;

  andThen = Result.andThen.bind(null, this) as <A2 = never, E2 = never>(
    cb: (a: A) => Result<A2, E2> | A2,
  ) => Result<A2, E | E2>;

  // ---- tap -------------------------------------------------------------------------------
  static tap = dual<
    <A = never, E2 = never>(
      cb: (a: A) => Result<never, E2> | void,
    ) => <E = never>(self: Result<A, E> | ResultLikeIso<A, E>) => Result<A, E | E2>,
    <A = never, E = never, E2 = never>(
      self: Result<A, E> | ResultLikeIso<A, E>,
      cb: (a: A) => Result<never, E2> | void,
    ) => Result<A, E | E2>
  >(
    2,
    (self, cb) =>
      new Result(
        Promise.resolve(self).then(async (r) => {
          if (r.isError) return self;
          const out = await cb(r.value);
          return out && out.isError ? _err(out.error) : self;
        }),
      ),
  );

  tap = Result.tap.bind(null, this) as <E2 = never>(cb: (a: A) => Result<never, E2> | void) => Result<A, E | E2>;

  // ---- tapError --------------------------------------------------------------------------
  static tapError = dual<
    <E2, E = never>(
      cb: (e: E) => Result<unknown, E2> | void,
    ) => <A = never>(self: Result<A, E> | ResultLikeIso<A, E>) => Result<A, E | E2>,
    <A = never, E = never, E2 = never>(
      self: Result<A, E> | ResultLikeIso<A, E>,
      cb: (e: E) => Result<unknown, E2> | void,
    ) => Result<A, E | E2>
  >(
    2,
    (self, cb) =>
      new Result(
        Promise.resolve(self).then(async (r) => {
          if (r.isOk) return r;
          const out = await cb(r.error);
          return out && out.isError ? _err(out.error) : self;
        }),
      ),
  );

  tapError = Result.tapError.bind(null, this) as <E2 = never>(
    cb: (e: E) => Result<never, E2> | void,
  ) => Result<A, E | E2>;

  // ---- tapErrorTag -----------------------------------------------------------------------
  static tapErrorTag = dual<
    <const Tag extends Result.TagsOf<E>, E = never, E2 = never>(
      tag: Tag,
      cb: (err: Extract<E, { _tag: Tag }>) => Result<unknown, E2> | void,
    ) => <A = never>(self: Result<A, E> | ResultLikeIso<A, E>) => Result<A, E | E2>,
    <const Tag extends Result.TagsOf<E>, A = never, E = never, E2 = never>(
      self: Result<A, E> | ResultLikeIso<A, E>,
      tag: Tag,
      cb: (err: Extract<E, { _tag: Tag }>) => Result<unknown, E2> | void,
    ) => Result<A, E | E2>
  >(
    3,
    (self, tag, cb) =>
      new Result(
        Promise.resolve(self).then(async (r) => {
          if (r.isOk) return r;
          if ((r.error as any)._tag !== tag) return r;
          const out = await cb(r.error as any);
          return out && out.isError ? _err(out.error) : r;
        }),
      ),
  );

  // @ts-expect-error - These types are correct
  tapErrorTag = Result.tapErrorTag.bind(null, this) as <const Tag extends Result.TagsOf<E>, E2 = never>(
    tag: Tag,
    cb: (err: Extract<E, { _tag: Tag }>) => Result<unknown, E2> | void,
  ) => Result<A, E | E2>;

  // ---- orElse ----------------------------------------------------------------------------
  static orElse = dual<
    <A2, E2, E = never>(
      cb: (e: E) => Result<A2, E2>,
    ) => <A = never>(self: Result<A, E> | ResultLikeIso<A, E>) => Result<A | A2, E2>,
    <A2, E2, A = never, E = never>(
      self: Result<A, E> | ResultLikeIso<A, E>,
      cb: (e: E) => Result<A2, E2>,
    ) => Result<A | A2, E2>
  >(2, (self, cb) => new Result(Promise.resolve(self).then(async (r) => (r.isOk ? r : await cb(r.error)))));

  orElse = Result.orElse.bind(null, this) as <A2, E2>(cb: (e: E) => Result<A2, E2>) => Result<A | A2, E2>;

  // ---- catchTag --------------------------------------------------------------------------
  static catchTag = dual<
    <E, const Tag extends Result.TagsOf<E>, A2, E2>(
      tag: Tag,
      cb: (e: Extract<E, { _tag: Tag }>) => Result<A2, E2>,
    ) => <A = never>(self: Result<A, E> | Err<E>) => Result<A | A2, Exclude<E, { _tag: Tag }> | E2>,
    <E, const Tag extends Result.TagsOf<E>, A2, E2, A = never>(
      self: Result<A, E> | Err<E>,
      tag: Tag,
      cb: (e: Extract<E, { _tag: Tag }>) => Result<A2, E2>,
    ) => Result<A | A2, Exclude<E, { _tag: Tag }> | E2>
  >(
    3,
    (self, tag, cb) =>
      new Result(
        Promise.resolve(self).then(async (r) => {
          if (r.isOk) return r;
          if ((r.error as any)._tag !== tag) return r as any;
          return await cb(r.error as any);
        }),
      ),
  );

  // @ts-expect-error - These types are correct
  catchTag = Result.catchTag.bind(null, this) as <const Tag extends Result.TagsOf<E>, A2, E2>(
    tag: Tag,
    cb: (e: Extract<E, { _tag: Tag }>) => Result<A2, E2>,
  ) => Result<A | A2, Exclude<E, { _tag: Tag }> | E2>;

  // ---- catchTags -------------------------------------------------------------------------
  static catchTags = dual<
    <
      Cases extends {
        [K in Result.TagsOf<E>]+?: (error: Extract<E, { _tag: K }>) => Result<any, any>;
      } & (unknown extends E
        ? {}
        : {
            [K in Exclude<keyof Cases, Result.TagsOf<E>>]: never;
          }),
      A = never,
      E = never,
    >(
      cases: Cases,
    ) => (self: Result<A, E> | ResultLikeIso<A, E>) => Result<
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
      A = never,
      E = never,
    >(
      self: Result<A, E> | ResultLikeIso<A, E>,
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
  >(
    2,
    (self, cases) =>
      new Result(
        Promise.resolve(self).then(async (r) => {
          if (r.isOk) return r;
          const cb =
            typeof r.error === "object" && r.error && "_tag" in r.error && typeof r.error._tag === "string"
              ? cases[r.error._tag as keyof typeof cases]
              : null;
          if (!cb) return r as any;
          return await cb(r.error as any);
        }),
      ),
  );

  catchTags = Result.catchTags.bind(null, this) as <
    Cases extends {
      [K in Result.TagsOf<E>]+?: (error: Extract<E, { _tag: K }>) => Result<any, any>;
    } & (unknown extends E ? {} : { [K in Exclude<keyof Cases, Result.TagsOf<E>>]: never }),
  >(
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
  >;
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

function gen<Args extends any[], G extends AsyncGenerator<any, any, any>>(
  fn: (...args: Args) => G,
): (...args: Args) => Result<GeneratorReturn<G>, Result.InferErr<GeneratorYield<G>>> {
  return (...args: Args) => {
    const iterator = fn(...args);
    return runAsync_(iterator);
  };
}

gen.serializable = function <Args extends any[], G extends AsyncGenerator<any, any, any>>(fn: (...args: Args) => G) {
  return (...args: Args) => this(fn)(...args).asSerializable();
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
  class Base extends YieldableError {
    readonly _tag = tag;
    private readonly _payload: any;

    constructor(payload: any) {
      super(tag);
      Object.setPrototypeOf(this, new.target.prototype);
      Object.assign(this, payload);
      this._payload = payload;
    }

    toJSON() {
      return { _tag: this._tag, ...JSON.parse(JSON.stringify(this._payload)) };
    }
  }
  (Base.prototype as any).name = tag;
  return Base as any;
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

function try_<A, E>(options: { try: () => A; catch: (e: unknown) => E }): Result<Awaited<A>, E>;
function try_<A>(cb: () => A): Result<Awaited<A>, UnknownException>;
function try_<A, E>(arg: (() => A) | { try: () => A; catch: (e: unknown) => E }) {
  const tryable = typeof arg === "function" ? arg : arg.try;
  const catchable = typeof arg === "function" ? (e: unknown) => new UnknownException({ cause: e }) : arg.catch;

  try {
    return new Result(
      Promise.resolve(tryable()).then(
        (r) => _ok(r),
        (e) => _err(catchable(e)),
      ),
    );
  } catch (e) {
    return new Result(Promise.resolve(_err(catchable(e))));
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
