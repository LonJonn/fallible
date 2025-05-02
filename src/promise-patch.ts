/* -------------------------------------------------- */
/*  Monkey-patch Promise                              */
/* -------------------------------------------------- */

import { Result, type ResultLike } from ".";

import type { Err } from ".";

declare global {
  interface Promise<T> {
    [Symbol.asyncIterator](): T extends ResultLike<any, any>
      ? AsyncGenerator<Err<Result.InferErr<T>>, Result.InferOk<T>, unknown>
      : never;
  }
}

function DANGEROUSLY_PATCH_PROMISE() {
  if (typeof Promise.prototype[Symbol.asyncIterator] !== "function") {
    Object.defineProperty(Promise.prototype, Symbol.asyncIterator, {
      writable: false,
      enumerable: false,
      configurable: false,
      value: async function* (this: Promise<ResultLike<any, any>>) {
        const out = await this;

        if (out.isError) {
          yield out;
          return;
        }

        return out.value;
      },
    });
  }
}

export const FALLIBLE_PROMISE_PATCH = { DANGEROUSLY_PATCH_PROMISE };
