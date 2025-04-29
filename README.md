# **fallible**

> **A tiny, generator‑powered Result pattern implementation for TypeScript**

`fallible` brings the ergonomics of Rust‑style `Result` and Kotlin `Either` into modern TypeScript **without adding runtime weight**:

- ✅ *Promise‑like* — `await` or `.then()` a `Result` directly
- ✅ *Generator‑powered* control‑flow via `Result.gen`
- ✅ *First‑class type‑safety* for success **and** error channels
- ✅ *Data‑first / data‑last* helpers (`pipe`, `flow`, `dual`)
- ✅ *No dependencies*, <1 KB gzipped

---

## 📦 Installation

```bash
npm install fallible
# or
pnpm add fallible
```

---

## 🚀 Quick start

> **Note:** Type annotations below are included for clarity, but inferred automatically.

### Creating Results

```ts
import { Result, ok, pipe } from "fallible";

declare const queryDb: <T>(query: string) => Result<T, DatabaseError>;

// Create yieldable errors
class BannedAccountError extends Result.TaggedError("BannedAccountError")<{ reason: string }> {}

// Define your Result function
const getUser = Result.gen(async function* (id: string) {
  // `yield*` will unwrap Ok values and pass Err values through, tracking them at the type level
  const user = yield* queryDb<User>(`SELECT * FROM users WHERE id = ${id}`);

  if (user.banned) {
    // TaggedErrors are directly yieldable
    return yield* new BannedAccountError({ reason: user.banReason });
  }

  return user;
});

// Will have the following type:
declare const getUser: (id: string) => Result<User, DatabaseError | BannedAccountError>;
```

```ts
// Result's are Promise-like so you can just unwrap them with `await`
const user: Ok<User> | Err<DatabaseError> | Err<BannedAccountError> = await getUser("1");

if (user.isError) {
  user.error; // -> DatabaseError | BannedAccountError
} else {
  user.value; // -> User
}

// --- Or use the `isError` helper

if (isError(user, "BannedAccountError")) {
  // user is now narrowed to Err<BannedAccountError>
  console.warn(user.error.reason);
}

// --- Or use the `unwrapOr` helper

const user: User | null = await getUser("1").unwrapOr(null);

// --- Or use the Result modifier APIs

// Result<string | null, never>
const userNameResult: Result<string | null, never> = pipe(
  getUser("1"),
  Result.andThen((user) => user.name),
  Result.catchTags({
    DatabaseError: () => ok(null),
    BannedAccountError: (e) => ok(`Banned User (${e.reason})`),
  }),
);

// --- Then concurrently run multiple Results (Short-circuits on first error)

const combined: Result<[User, string | null], DatabaseError | BannedAccountError> = Result.all([
  getUser("1"),
  userNameResult,
]);
```

---

## 🧩 API overview

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

### Result.gen — sequential async pipelines

```ts
const fetchJson = Result.gen(function* (url: string) {
  const res = yield* Result.try(() => fetch(url)); // Err<UnknownException> on network failure
  if (!res.ok) return err(new HttpError(res.status)); // early‑return an error
  const body = yield* Result.try(() => res.json()); // still type‑safe ✅
  return body satisfies unknown; // Compiler knows `body` type!
});

const data = await fetchJson("/api/things").unwrapOr({});
```

### Pattern‑matching with tagged errors

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

### Composing many results

```ts
const res = Result.all([ok(1), ok(2), err("bang")]);

await res; // → Err<"bang"> (short‑circuits on first error)
```

### Type‑safe guards

```ts
if (Result.isError(res, "Invalid")) {
  // res is now Err<Invalid>, fully narrowed ✨
}
```

---

## 🔌 Interop & Utility helpers

- **`try`** – wrap any promise‑returning function, catching thrown exceptions
- **`all`** – run many `Result`s in parallel, stop at first failure
- **`pipe` / `flow`** – ergonomic FP‑style composition helpers

---

## 📚 Full API reference

See the inline JSDoc & source – the entire implementation fits in <300 LOC.

---

## 👩🏻‍💻 Contributing

PRs are welcome! Open an issue to discuss bugs or ideas.

```bash
git clone https://github.com/lonjonn/fallible
pnpm install
pnpm test
```

---

## 🙏 Acknowledgments

This project draws heavy inspiration:

- [Effect](https://github.com/Effect-TS/effect) - A powerful TypeScript framework for building type-safe, scalable applications.

  - `Result.gen` inspired by Effect's `Effect.gen`
  - Modifier APIs like `andThen`, `catchTags`, etc. are inspired by Effect -`pipe`, `flow`, and `dual` utilities are copied directly from Effect's source code (MIT Licensed)

- [neverthrow](https://github.com/supermacro/neverthrow) - A type-safe error handling solution for TypeScript that helped shape the API design of this library.

  - Result class inspired by neverthrow's `ResultAsync` class

---

##  🪪 License

MIT © 2025 Leon Salsiccia
