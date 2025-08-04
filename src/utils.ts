/**
 * Copied from Effect (https://github.com/Effect-TS/effect).
 * Original author: Effectful Technologies Inc
 * Original license: MIT
 * (Unmodified)
 */

/**
 * Pipes the value of an expression into a pipeline of functions.
 *
 * **Details**
 *
 * The `pipe` function is a utility that allows us to compose functions in a
 * readable and sequential manner. It takes the output of one function and
 * passes it as the input to the next function in the pipeline. This enables us
 * to build complex transformations by chaining multiple functions together.
 *
 * ```ts skip-type-checking
 * import { pipe } from "effect"
 *
 * const result = pipe(input, func1, func2, ..., funcN)
 * ```
 *
 * In this syntax, `input` is the initial value, and `func1`, `func2`, ...,
 * `funcN` are the functions to be applied in sequence. The result of each
 * function becomes the input for the next function, and the final result is
 * returned.
 *
 * Here's an illustration of how `pipe` works:
 *
 * ```
 * ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌────────┐
 * │ input │───►│ func1 │───►│ func2 │───►│  ...  │───►│ funcN │───►│ result │
 * └───────┘    └───────┘    └───────┘    └───────┘    └───────┘    └────────┘
 * ```
 *
 * It's important to note that functions passed to `pipe` must have a **single
 * argument** because they are only called with a single argument.
 *
 * **When to Use**
 *
 * This is useful in combination with data-last functions as a simulation of
 * methods:
 *
 * ```ts skip-type-checking
 * as.map(f).filter(g)
 * ```
 *
 * becomes:
 *
 * ```ts skip-type-checking
 * import { pipe, Array } from "effect"
 *
 * pipe(as, Array.map(f), Array.filter(g))
 * ```
 *
 * **Example** (Chaining Arithmetic Operations)
 *
 * ```ts
 * import { pipe } from "effect"
 *
 * // Define simple arithmetic operations
 * const increment = (x: number) => x + 1
 * const double = (x: number) => x * 2
 * const subtractTen = (x: number) => x - 10
 *
 * // Sequentially apply these operations using `pipe`
 * const result = pipe(5, increment, double, subtractTen)
 *
 * console.log(result)
 * // Output: 2
 * ```
 *
 * @since 2.0.0
 */
export function pipe<A>(a: A): A;
export function pipe<A, B = never>(a: A, ab: (a: A) => B): B;
export function pipe<A, B = never, C = never>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B = never, C = never, D = never>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D): D;
export function pipe<A, B = never, C = never, D = never, E = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
): E;
export function pipe<A, B = never, C = never, D = never, E = never, F = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
): F;
export function pipe<A, B = never, C = never, D = never, E = never, F = never, G = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
): G;
export function pipe<A, B = never, C = never, D = never, E = never, F = never, G = never, H = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
): H;
export function pipe<A, B = never, C = never, D = never, E = never, F = never, G = never, H = never, I = never>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
): I;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
): J;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
): K;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
): L;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
): M;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
): N;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
): O;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
): P;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
  Q = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
  pq: (p: P) => Q,
): Q;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
  Q = never,
  R = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
  pq: (p: P) => Q,
  qr: (q: Q) => R,
): R;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
  Q = never,
  R = never,
  S = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
  pq: (p: P) => Q,
  qr: (q: Q) => R,
  rs: (r: R) => S,
): S;
export function pipe<
  A,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
  K = never,
  L = never,
  M = never,
  N = never,
  O = never,
  P = never,
  Q = never,
  R = never,
  S = never,
  T = never,
>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
  jk: (j: J) => K,
  kl: (k: K) => L,
  lm: (l: L) => M,
  mn: (m: M) => N,
  no: (n: N) => O,
  op: (o: O) => P,
  pq: (p: P) => Q,
  qr: (q: Q) => R,
  rs: (r: R) => S,
  st: (s: S) => T,
): T;
export function pipe(
  a: unknown,
  ab?: Function,
  bc?: Function,
  cd?: Function,
  de?: Function,
  ef?: Function,
  fg?: Function,
  gh?: Function,
  hi?: Function,
): unknown {
  switch (arguments.length) {
    case 1:
      return a;
    case 2:
      return ab!(a);
    case 3:
      return bc!(ab!(a));
    case 4:
      return cd!(bc!(ab!(a)));
    case 5:
      return de!(cd!(bc!(ab!(a))));
    case 6:
      return ef!(de!(cd!(bc!(ab!(a)))));
    case 7:
      return fg!(ef!(de!(cd!(bc!(ab!(a))))));
    case 8:
      return gh!(fg!(ef!(de!(cd!(bc!(ab!(a)))))));
    case 9:
      return hi!(gh!(fg!(ef!(de!(cd!(bc!(ab!(a))))))));
    default: {
      let ret = arguments[0];
      for (let i = 1; i < arguments.length; i++) {
        ret = arguments[i](ret);
      }
      return ret;
    }
  }
}

/**
 * Performs left-to-right function composition. The first argument may have any arity, the remaining arguments must be unary.
 *
 * See also [`pipe`](#pipe).
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { flow } from "effect/Function"
 *
 * const len = (s: string): number => s.length
 * const double = (n: number): number => n * 2
 *
 * const f = flow(len, double)
 *
 * assert.strictEqual(f('aaa'), 6)
 * ```
 *
 * @since 2.0.0
 */
export function flow<A extends ReadonlyArray<unknown>, B = never>(ab: (...a: A) => B): (...a: A) => B;
export function flow<A extends ReadonlyArray<unknown>, B = never, C = never>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
): (...a: A) => C;
export function flow<A extends ReadonlyArray<unknown>, B = never, C = never, D = never>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
): (...a: A) => D;
export function flow<A extends ReadonlyArray<unknown>, B = never, C = never, D = never, E = never>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
): (...a: A) => E;
export function flow<A extends ReadonlyArray<unknown>, B = never, C = never, D = never, E = never, F = never>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
): (...a: A) => F;
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
): (...a: A) => G;
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
): (...a: A) => H;
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
): (...a: A) => I;
export function flow<
  A extends ReadonlyArray<unknown>,
  B = never,
  C = never,
  D = never,
  E = never,
  F = never,
  G = never,
  H = never,
  I = never,
  J = never,
>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
  ij: (i: I) => J,
): (...a: A) => J;
export function flow(
  ab: Function,
  bc?: Function,
  cd?: Function,
  de?: Function,
  ef?: Function,
  fg?: Function,
  gh?: Function,
  hi?: Function,
  ij?: Function,
): unknown {
  switch (arguments.length) {
    case 1:
      return ab;
    case 2:
      return function (this: unknown) {
        return bc!(ab.apply(this, arguments));
      };
    case 3:
      return function (this: unknown) {
        return cd!(bc!(ab.apply(this, arguments)));
      };
    case 4:
      return function (this: unknown) {
        return de!(cd!(bc!(ab.apply(this, arguments))));
      };
    case 5:
      return function (this: unknown) {
        return ef!(de!(cd!(bc!(ab.apply(this, arguments)))));
      };
    case 6:
      return function (this: unknown) {
        return fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments))))));
      };
    case 7:
      return function (this: unknown) {
        return gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments)))))));
      };
    case 8:
      return function (this: unknown) {
        return hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments))))))));
      };
    case 9:
      return function (this: unknown) {
        return ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments)))))))));
      };
  }
  return;
}

export const dual: {
  /**
   * Creates a function that can be used in a data-last (aka `pipe`able) or
   * data-first style.
   *
   * The first parameter to `dual` is either the arity of the uncurried function
   * or a predicate that determines if the function is being used in a data-first
   * or data-last style.
   *
   * Using the arity is the most common use case, but there are some cases where
   * you may want to use a predicate. For example, if you have a function that
   * takes an optional argument, you can use a predicate to determine if the
   * function is being used in a data-first or data-last style.
   *
   * You can pass either the arity of the uncurried function or a predicate
   * which determines if the function is being used in a data-first or
   * data-last style.
   *
   * **Example** (Using arity to determine data-first or data-last style)
   *
   * ```ts
   * import { dual, pipe } from "effect/Function"
   *
   * const sum = dual<
   *   (that: number) => (self: number) => number,
   *   (self: number, that: number) => number
   * >(2, (self, that) => self + that)
   *
   * console.log(sum(2, 3)) // 5
   * console.log(pipe(2, sum(3))) // 5
   * ```
   *
   * **Example** (Using call signatures to define the overloads)
   *
   * ```ts
   * import { dual, pipe } from "effect/Function"
   *
   * const sum: {
   *   (that: number): (self: number) => number
   *   (self: number, that: number): number
   * } = dual(2, (self: number, that: number): number => self + that)
   *
   * console.log(sum(2, 3)) // 5
   * console.log(pipe(2, sum(3))) // 5
   * ```
   *
   * **Example** (Using a predicate to determine data-first or data-last style)
   *
   * ```ts
   * import { dual, pipe } from "effect/Function"
   *
   * const sum = dual<
   *   (that: number) => (self: number) => number,
   *   (self: number, that: number) => number
   * >(
   *   (args) => args.length === 2,
   *   (self, that) => self + that
   * )
   *
   * console.log(sum(2, 3)) // 5
   * console.log(pipe(2, sum(3))) // 5
   * ```
   *
   * @since 2.0.0
   */
  <DataLast extends (...args: Array<any>) => any, DataFirst extends (...args: Array<any>) => any>(
    arity: Parameters<DataFirst>["length"],
    body: DataFirst,
  ): DataLast & DataFirst;
  /**
   * Creates a function that can be used in a data-last (aka `pipe`able) or
   * data-first style.
   *
   * The first parameter to `dual` is either the arity of the uncurried function
   * or a predicate that determines if the function is being used in a data-first
   * or data-last style.
   *
   * Using the arity is the most common use case, but there are some cases where
   * you may want to use a predicate. For example, if you have a function that
   * takes an optional argument, you can use a predicate to determine if the
   * function is being used in a data-first or data-last style.
   *
   * You can pass either the arity of the uncurried function or a predicate
   * which determines if the function is being used in a data-first or
   * data-last style.
   *
   * **Example** (Using arity to determine data-first or data-last style)
   *
   * ```ts
   * import { dual, pipe } from "effect/Function"
   *
   * const sum = dual<
   *   (that: number) => (self: number) => number,
   *   (self: number, that: number) => number
   * >(2, (self, that) => self + that)
   *
   * console.log(sum(2, 3)) // 5
   * console.log(pipe(2, sum(3))) // 5
   * ```
   *
   * **Example** (Using call signatures to define the overloads)
   *
   * ```ts
   * import { dual, pipe } from "effect/Function"
   *
   * const sum: {
   *   (that: number): (self: number) => number
   *   (self: number, that: number): number
   * } = dual(2, (self: number, that: number): number => self + that)
   *
   * console.log(sum(2, 3)) // 5
   * console.log(pipe(2, sum(3))) // 5
   * ```
   *
   * **Example** (Using a predicate to determine data-first or data-last style)
   *
   * ```ts
   * import { dual, pipe } from "effect/Function"
   *
   * const sum = dual<
   *   (that: number) => (self: number) => number,
   *   (self: number, that: number) => number
   * >(
   *   (args) => args.length === 2,
   *   (self, that) => self + that
   * )
   *
   * console.log(sum(2, 3)) // 5
   * console.log(pipe(2, sum(3))) // 5
   * ```
   *
   * @since 2.0.0
   */
  <DataLast extends (...args: Array<any>) => any, DataFirst extends (...args: Array<any>) => any>(
    isDataFirst: (args: IArguments) => boolean,
    body: DataFirst,
  ): DataLast & DataFirst;
} = function (arity, body) {
  if (typeof arity === "function") {
    return function () {
      if (arity(arguments)) {
        // @ts-expect-error
        return body.apply(this, arguments);
      }
      return ((self: any) => body(self, ...arguments)) as any;
    };
  }

  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`);

    case 2:
      return function (a, b) {
        if (arguments.length >= 2) {
          return body(a, b);
        }
        return function (self: any) {
          return body(self, a);
        };
      };

    case 3:
      return function (a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c);
        }
        return function (self: any) {
          return body(self, a, b);
        };
      };

    case 4:
      return function (a, b, c, d) {
        if (arguments.length >= 4) {
          return body(a, b, c, d);
        }
        return function (self: any) {
          return body(self, a, b, c);
        };
      };

    case 5:
      return function (a, b, c, d, e) {
        if (arguments.length >= 5) {
          return body(a, b, c, d, e);
        }
        return function (self: any) {
          return body(self, a, b, c, d);
        };
      };

    default:
      return function () {
        if (arguments.length >= arity) {
          // @ts-expect-error
          return body.apply(this, arguments);
        }
        const args = arguments;
        return function (self: any) {
          return body(self, ...args);
        };
      };
  }
};

/* -------------------------------------------------- */
/*  Predicate and Refinement types                   */
/* -------------------------------------------------- */

export interface Predicate<in A> {
  (a: A): boolean;
}

export interface Refinement<in A, out B extends A> {
  (a: A): a is B;
}

/**
 * Determines if two types are equal, allowing to specify the return types.
 *
 * @since 3.15.0
 * @category models
 */
export type EqualsWith<A, B, Y, N> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? Y : N;
