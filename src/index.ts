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

type ResultLike<A, E> = Ok<A> | Err<E>;

export class Ok<A> {
  readonly isOk = true as const;
  readonly isError = false as const;
  constructor(readonly value: A) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<never, A, unknown> {
    yield undefined as never;
    return this.value;
  }
}

export class Err<E> {
  readonly isOk = false as const;
  readonly isError = true as const;
  constructor(readonly error: E) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<Err<E>, never, unknown> {
    yield this;
    return undefined as never;
  }
}

const _ok = <A>(value: A): Ok<A> => new Ok(value);
const _err = <E>(error: E): Err<E> => new Err(error);

export const ok = <A>(value: A): Result<A, never> => new Result(Promise.resolve(new Ok(value)));
export const err = <E>(error: E): Result<never, E> => new Result(Promise.resolve(new Err(error)));

export class Result<A = never, E = never> implements PromiseLike<Ok<A> | Err<E>> {
  private _promise: PromiseLike<Ok<A> | Err<E>>;

  constructor(res: PromiseLike<Ok<A> | Err<E>>) {
    this._promise = res;
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
  /*  Instance methods                                 */
  /* -------------------------------------------------- */

  unwrapOr<A2>(fallback: A2): PromiseLike<A | A2> {
    return this.then((out) => (out.isOk ? out.value : fallback));
  }

  /* -------------------------------------------------- */
  /*  Static methods                                   */
  /* -------------------------------------------------- */

  static ok = ok;
  static err = err;

  static gen = gen;
  static TaggedError = TaggedError;
  static isError = isError;
  static try = try_;
  static all = all;

  /* -------------------------------------------------- */
  /*  Manipulation helpers (dual‑powered)               */
  /* -------------------------------------------------- */

  // ---- map -------------------------------------------------------------------------------
  static map = dual<
    <A, A2>(cb: (value: A) => A2) => <E>(self: Result<A, E>) => Result<A2, E>,
    <A, E, A2>(self: Result<A, E>, cb: (value: A) => A2) => Result<A2, E>
  >(2, (self, cb) => new Result(self.then((r) => (r.isOk ? _ok(cb(r.value)) : r))));

  // ---- mapError --------------------------------------------------------------------------
  static mapError = dual<
    <E, E2>(cb: (e: E) => E2) => <A>(self: Result<A, E>) => Result<A, E2>,
    <A, E, E2>(self: Result<A, E>, cb: (e: E) => E2) => Result<A, E2>
  >(2, (self, cb) => new Result(self.then((r) => (r.isError ? _err(cb(r.error)) : r))));

  // ---- flatMap / andThen -----------------------------------------------------------------
  static flatMap = dual<
    <A, A2 = never, E2 = never>(cb: (a: A) => Result<A2, E2> | A2) => <E>(self: Result<A, E>) => Result<A2, E | E2>,
    <A, E, A2 = never, E2 = never>(self: Result<A, E>, cb: (a: A) => Result<A2, E2> | A2) => Result<A2, E | E2>
  >(
    2,
    (self, cb) =>
      new Result(
        self.then(async (r) => {
          if (r.isError) return _err(r.error);
          const out = cb(r.value);
          return out instanceof Result ? out : _ok(out);
        }),
      ),
  );

  static andThen = this.flatMap;

  // ---- tap -------------------------------------------------------------------------------
  static tap = dual<
    <A, E2 = never>(cb: (a: A) => Result<never, E2> | void) => <E>(self: Result<A, E>) => Result<A, E | E2>,
    <A, E, E2 = never>(self: Result<A, E>, cb: (a: A) => Result<never, E2> | void) => Result<A, E | E2>
  >(
    2,
    (self, cb) =>
      new Result(
        self.then(async (r) => {
          if (r.isError) return self;
          const out = await cb(r.value);
          return out && out.isError ? _err(out.error) : self;
        }),
      ),
  );

  // ---- tapError --------------------------------------------------------------------------
  static tapError = dual<
    <E, E2 = never>(cb: (e: E) => Result<unknown, E2> | void) => <A>(self: Result<A, E>) => Result<A, E | E2>,
    <A, E, E2 = never>(self: Result<A, E>, cb: (e: E) => Result<unknown, E2> | void) => Result<A, E | E2>
  >(
    2,
    (self, cb) =>
      new Result(
        self.then(async (r) => {
          if (r.isOk) return r;
          const out = await cb(r.error);
          return out && out.isError ? _err(out.error) : self;
        }),
      ),
  );

  // ---- tapErrorTag -----------------------------------------------------------------------
  static tapErrorTag = dual<
    <E, const Tag extends TagsOf<E>, E2 = never>(
      tag: Tag,
      cb: (err: Extract<E, { _tag: Tag }>) => Result<unknown, E2> | void,
    ) => <A>(self: Result<A, E>) => Result<A, E | E2>,
    <A, E, const Tag extends TagsOf<E>, E2 = never>(
      self: Result<A, E>,
      tag: Tag,
      cb: (err: Extract<E, { _tag: Tag }>) => Result<unknown, E2> | void,
    ) => Result<A, E | E2>
  >(
    3,
    (self, tag, cb) =>
      new Result(
        self.then(async (r) => {
          if (r.isOk) return r;
          if ((r.error as any)._tag !== tag) return r;
          const out = await cb(r.error as any);
          return out && out.isError ? _err(out.error) : r;
        }),
      ),
  );

  // ---- orElse ----------------------------------------------------------------------------
  static orElse = dual<
    <E, A2, E2>(cb: (e: E) => Result<A2, E2>) => <A>(self: Result<A, E>) => Result<A | A2, E2>,
    <A, E, A2, E2>(self: Result<A, E>, cb: (e: E) => Result<A2, E2>) => Result<A | A2, E2>
  >(2, (self, cb) => new Result(self.then(async (r) => (r.isOk ? r : await cb(r.error)))));

  // ---- catchTag --------------------------------------------------------------------------
  static catchTag = dual<
    <E, const Tag extends TagsOf<E>, A2, E2>(
      tag: Tag,
      cb: (e: Extract<E, { _tag: Tag }>) => Result<A2, E2>,
    ) => <A>(self: Result<A, E>) => Result<A | A2, Exclude<E, { _tag: Tag }> | E2>,
    <A, E, const Tag extends TagsOf<E>, A2, E2>(
      self: Result<A, E>,
      tag: Tag,
      cb: (e: Extract<E, { _tag: Tag }>) => Result<A2, E2>,
    ) => Result<A | A2, Exclude<E, { _tag: Tag }> | E2>
  >(
    3,
    (self, tag, cb) =>
      new Result(
        self.then(async (r) => {
          if (r.isOk) return r;
          if ((r.error as any)._tag !== tag) return r as any;
          return await cb(r.error as any);
        }),
      ),
  );

  // ---- catchTags -------------------------------------------------------------------------
  static catchTags = dual<
    <
      A,
      E,
      Cases extends {
        [K in TagsOf<E>]+?: (error: Extract<E, { _tag: K }>) => Result<any, any>;
      } & (unknown extends E
        ? {}
        : {
            [K in Exclude<keyof Cases, TagsOf<E>>]: never;
          }),
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
      A,
      E,
      Cases extends {
        [K in TagsOf<E>]+?: (error: Extract<E, { _tag: K }>) => Result<any, any>;
      } & (unknown extends E
        ? {}
        : {
            [K in Exclude<keyof Cases, TagsOf<E>>]: never;
          }),
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
  >(
    2,
    (self, cases) =>
      new Result(
        self.then(async (r) => {
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
}

/* -------------------------------------------------- */
/*  Result.gen                                        */
/* -------------------------------------------------- */

type GeneratorYield<G> = G extends AsyncGenerator<infer Y, any, any> ? Y : never;

type GeneratorReturn<G> = G extends AsyncGenerator<any, infer R, any> ? R : never;

type ErrorsOf<Y> =
  Y extends Result<any, infer E> ? E : Y extends { readonly isError: true; readonly error: infer E } ? E : never;

function runAsync_<G extends AsyncGenerator<any, any, any>>(
  iterator: G,
): Result<GeneratorReturn<G>, ErrorsOf<GeneratorYield<G>>> {
  return new Result(
    (async () => {
      while (true) {
        const step = await iterator.next();
        if (step.done) return _ok(step.value) as any;
        const yielded = step.value as any;
        if (yielded instanceof Err || (yielded && yielded.isError === true)) {
          return yielded as any;
        }
      }
    })(),
  );
}

function gen<Args extends any[], G extends AsyncGenerator<any, any, any>>(
  fn: (...args: Args) => G,
): (...args: Args) => Result<GeneratorReturn<G>, ErrorsOf<GeneratorYield<G>>> {
  return (...args: Args) => {
    const iterator = fn(...args);
    return runAsync_(iterator);
  };
}

/* -------------------------------------------------- */
/*  Errors Helpers                                    */
/* -------------------------------------------------- */

export function TaggedError<Tag extends string>(tag: Tag) {
  return class<Payload = unknown> extends Error {
    readonly _tag: Tag = tag;
    constructor(readonly payload: Payload) {
      super(tag);
      Object.setPrototypeOf(this, new.target.prototype);
    }
    async *[Symbol.asyncIterator](): AsyncGenerator<Err<this>, never, unknown> {
      yield _err(this);
      return undefined as never;
    }
  };
}

export class UnknownException extends TaggedError("UnknownException")<{
  cause: unknown;
  message?: string | undefined;
}> {
  message: string = this.payload.message || "An unknown exception occurred";
}

type InferErrorValues<T> = T extends Err<infer E> ? E : never;

type TagsOf<E> = E extends { _tag: infer T } ? (T extends string ? T : never) : never;

export function isError<Result extends ResultLike<unknown, unknown>, E extends InferErrorValues<Result>>(
  value: Result,
): value is Result & Err<E>;
export function isError<
  Result extends ResultLike<unknown, unknown>,
  E extends InferErrorValues<Result>,
  const T extends TagsOf<E>,
>(value: Result, tag: T): value is Extract<Result, Err<{ _tag: T }>>;
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
