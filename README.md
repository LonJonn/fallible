# **fallible**

> **A tiny, generator‑powered Result pattern implementation for TypeScript**

`fallible` brings the ergonomics of Rust‑style `Result` and Kotlin `Either` into modern TypeScript **without adding runtime weight**:

- ✅ *Promise‑like* — `await` or `.then()` a `Result` directly
- ✅ *Generator‑powered* control‑flow via `Result.gen`
- ✅ *First‑class type‑safety* for success **and** error channels
- ✅ *Data‑first / data‑last* helpers (`pipe`, `flow`, `dual`)
- ✅ *No dependencies*, <1 KB gzipped

---

## 📦 Installation

```bash
npm install fallible
# or
pnpm add fallible
```

> The package ships with fully‑typed ESM & CJS builds plus `.d.ts` typings.

---

## 🚀 Quick start

```ts
import { ok, err, Result, pipe } from "fallible";

// Create values
const hello = ok("Hello 🌏");
const boom = err(new Error("💥"));

// Consume with `await`  (Result is Promise‑like)
console.log(await hello); // Ok { value: "Hello 🌏" }

// Or branch explicitly
pipe(
  hello,
  Result.map((s) => s.toUpperCase()),
  Result.unwrapOr("fallback"), // → "HELLO 🌏"
);
```

---

## 🧩 API overview

|  Category           | Helpers                                                    | Description                                            |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| **Core**            | `Ok`, `Err`, `Result`                                      | Tagged union representing success / failure            |
| **Constructors**    | `ok`, `err`                                                | Wrap a raw value or error                              |
| **Promise helpers** | `.then`, `unwrapOr`                                        | `Result` is `PromiseLike` – interoperable with `await` |
| **Transform**       | `map`, `mapError`, `flatMap / andThen`                     | Data‑first & data‑last signatures (powered by `dual`)  |
| **Side‑effects**    | `tap`, `tapError`, `tapErrorTag`                           | Effectful inspection without transforming              |
| **Recovery**        | `orElse`, `catchTag`, `catchTags`                          | Pattern‑match & recover from errors                    |
| **Generators**      | `Result.gen`                                               | Write synchronous‑looking async pipelines              |
| **Utilities**       | `try`, `all`, `isError`, `TaggedError`, `UnknownException` |

### Result.gen — sequential async pipelines

```ts
const fetchJson = Result.gen(function* (url: string) {
  const res = yield* Result.try(() => fetch(url)); // Err<UnknownException> on network failure
  if (!res.ok) return err(new HttpError(res.status)); // early‑return an error
  const body = yield* Result.try(() => res.json()); // still type‑safe ✅
  return body satisfies unknown; // Compiler knows `body` type!
});

const data = await fetchJson("/api/things").unwrapOr({});
```

### Pattern‑matching with tagged errors

```ts
class NotFound extends TaggedError("NotFound")<{}> {}
class Invalid extends TaggedError("Invalid")<{ field: string }> {}

const result: Result<User, NotFound | Invalid> = Result.gen(...)

const user: Result<User | { message: string }, never> = pipe(
  result,
  Result.catchTags({
    Invalid: (e) => ok({ message: `${e.payload.field} is invalid` }),
    NotFound: () => ok({ message: "Nothing here" }),
  }),
);
```

### Composing many results

```ts
const res = Result.all([ok(1), ok(2), err("bang")]);

await res; // → Err<"bang"> (short‑circuits on first error)
```

### Type‑safe guards

```ts
if (Result.isError(res, "Invalid")) {
  // res is now Err<Invalid>, fully narrowed ✨
}
```

---

## 🔌 Interop & Utility helpers

- **`try`** – wrap any promise‑returning function, catching thrown exceptions
- **`all`** – run many `Result`s in parallel, stop at first failure
- **`pipe` / `flow`** – ergonomic FP‑style composition helpers

---

## 📚 Full API reference

See the inline JSDoc & source – the entire implementation fits in <300 LOC.

---

## 👩🏻‍💻 Contributing

PRs are welcome! Open an issue to discuss bugs or ideas.

```bash
git clone https://github.com/lonjonn/fallible
pnpm install
pnpm test
```

---

## 🪪 License

MIT © 2025 Leon Salsiccia
