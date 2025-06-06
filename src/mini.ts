import { dual, pipe } from "./utils";

type DistributeErr<E> = E extends Err<infer U> ? (U extends unknown ? Err<U> : never) : never;

export type ResultLike<A, E> = Ok<A> | DistributeErr<Err<E>>;

export type Ok<A> = Result.Ok<A>;
export type Err<E> = Result.Err<E>;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Result {
  export interface Ok<A> {
    readonly isOk: true;
    readonly isError: false;
    readonly value: A;
  }

  export interface Err<E> {
    readonly isOk: false;
    readonly isError: true;
    readonly error: E;
  }

  /* Extracts the Ok channel of a Result */
  export type InferOk<R extends ResultLike<any, any>> = R extends Ok<infer A> ? A : never;

  /* Extracts the Err channel of a Result */
  export type InferErr<R extends ResultLike<any, any>> = R extends Err<infer E> ? E : never;

  /* Extracts the tags of an error type */
  export type TagsOf<E> =
    E extends ResultLike<unknown, infer U>
      ? TagsOf<U>
      : E extends Err<infer U>
        ? TagsOf<U>
        : E extends { _tag: infer T }
          ? T extends string
            ? T
            : never
          : never;
}

const ok = <A>(value: A): Ok<A> => ({
  isOk: true as const,
  isError: false as const,
  value,
});

const err = <E, Tag extends string>(error: E | { _tag?: Tag }): Err<E> =>
  ({
    isOk: false as const,
    isError: true as const,
    error,
  }) as Err<E>;

export function TaggedError<Tag extends string>(
  tag: Tag,
): new <Payload extends {} = {}>(
  args: keyof Payload extends never
    ? void
    : { readonly [P in keyof Payload as P extends "_tag" ? never : P]: Payload[P] },
) => { readonly _tag: Tag } & Readonly<Payload> {
  const Base = {
    Error: class {
      readonly _tag = tag;

      constructor(payload: any) {
        Object.setPrototypeOf(this, new.target.prototype);
        Object.assign(this, payload);
      }

      toJSON() {
        const { toJSON, ...properties } = this;
        return JSON.parse(JSON.stringify(properties));
      }
    } as any,
  };
  Base.Error.prototype.name = tag;
  return Base.Error;
}

export function isError<Result extends Ok<any> | Err<any>>(value: Result): value is Extract<Result, Err<any>>;
export function isError<Result extends Ok<any> | Err<any>, const Tag extends Result.TagsOf<Result.InferErr<Result>>>(
  value: Result,
  tag: Tag,
): value is Extract<Result, Err<{ _tag: NoInfer<Tag> }>>;
export function isError(value: any, tag?: string): boolean {
  if (value && value.isError === true) {
    if (tag === undefined) return true;
    const errVal = value.error;
    return errVal && typeof errVal === "object" && errVal._tag === tag;
  }
  return false;
}

export function matchError<
  R extends Err<{ _tag: string }>,
  Cases extends {
    [K in Result.TagsOf<Result.InferErr<R>>]?: (error: Extract<Result.InferErr<R>, { _tag: K }>) => any;
  },
>(
  result: R,
  cases: Cases,
):
  | {
      [K in keyof Cases]: Cases[K] extends (...args: any[]) => infer U ? U : never;
    }[keyof Cases]
  | Exclude<R, Err<{ _tag: keyof Cases }>> {
  const err = result.error;

  if (err && typeof err === "object" && "_tag" in err && typeof err._tag === "string" && err._tag in cases) {
    return (cases as any)[err._tag](err);
  }

  return result as any;
}

function all<const R extends readonly (ResultLike<any, any> | Promise<ResultLike<any, any>>)[]>(
  results: R,
): R[number] extends Promise<any>
  ? Promise<
      | Ok<{ [K in keyof R]: Awaited<R[K]> extends ResultLike<infer A, any> ? A : never }>
      | {
          [K in number]: Awaited<R[K]> extends ResultLike<any, infer E> ? DistributeErr<Err<E>> : never;
        }[number]
    >
  :
      | Ok<{ [K in keyof R]: R[K] extends ResultLike<infer A, any> ? A : never }>
      | {
          [K in number]: R[K] extends ResultLike<any, infer E> ? DistributeErr<Err<E>> : never;
        }[number] {
  // Check if any of the results are promises
  if (results.some((r: any) => r instanceof Promise)) {
    return Promise.all(results).then((resolvedResults) => all(resolvedResults)) as any;
  }

  const values: any[] = [];

  for (const res of results as unknown as readonly ResultLike<any, any>[]) {
    if (res.isError) return res as any;
    values.push(res.value);
  }

  return ok(values as any) as any;
}

type MaybePromise<T> = T | Promise<T>;

const _mapFirst = <
  R extends MaybePromise<ResultLike<any, any>>,
  A2,
  A = Result.InferOk<Awaited<R>>,
  E = Result.InferErr<Awaited<R>>,
>(
  self: R,
  cb: (value: A) => A2,
): R extends Promise<any> ? Promise<ResultLike<A2, E>> : ResultLike<A2, E> => {
  if (self instanceof Promise) {
    return self.then((self) => _mapFirst(self, cb)) as any;
  }

  return (self.isOk ? ok(cb(self.value)) : self) as any;
};

const _mapLast = <
  R extends MaybePromise<ResultLike<any, any>>,
  A2,
  A = Result.InferOk<Awaited<R>>,
  E = Result.InferErr<Awaited<R>>,
>(
  cb: (value: A) => A2,
): ((self: R) => R extends Promise<any> ? Promise<ResultLike<A2, E>> : ResultLike<A2, E>) => {
  return (self) => {
    if (self instanceof Promise) {
      return self.then((self) => pipe(self, _mapLast(cb))) as any;
    }

    return (self.isOk ? ok(cb(self.value)) : self) as any;
  };
};

// @ts-expect-error
const map = dual<typeof _mapLast, typeof _mapFirst>(2, (self: any, cb: any) => {
  return _mapFirst(self, cb);
});

export const Result = {
  ok,
  err,
  TaggedError,
  isError,
  matchError,
  all,
  map,
};
