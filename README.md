# **fallible**

> **A tiny, generator‑powered Result pattern implementation for TypeScript**

The goal of this library is to provide a familiar async/await like API, but with tracked, type-safe error handling.

- ✅ *Promise‑like* — `await` or `.then()` a `Result` directly
- ✅ *Generator‑powered* control‑flow via `Result.gen` and `Result.fn`
- ✅ *First‑class type‑safety* for success **and** error channels
- ✅ *Data‑first / data‑last* helpers (`pipe`, `flow`)
- ✅ *No dependencies*, <1 KB gzipped

---

## 📦 Installation

```bash
pnpm add fallible
```

---

## 🚀 Quick start

### Creating Results

```ts
import { Result } from "fallible";

declare const queryDb: <T>(query: string) => Result<T, DatabaseError>;

// Create yieldable errors
class BannedAccountError extends Result.TaggedError("BannedAccountError")<{ reason: string }> {}

// Define your Result function
const getUser = Result.fn(async function* (id: string) {
  // `yield*` will unwrap Ok values and pass Err values through, tracking them at the type level
  const user = yield* queryDb<User>(`SELECT * FROM users WHERE id = ${id}`);

  if (user.banned) {
    // TaggedErrors are directly yieldable
    return yield* new BannedAccountError({ reason: user.banReason });
  }

  return user;
});

// Will have the following type (Notice the union of errors):
declare const getUser: (id: string) => Result<User, DatabaseError | BannedAccountError>;
```

### Consuming Results

```ts
// Result's are Promise-like so you can just unwrap them with `await`
const user: Ok<User> | Err<DatabaseError> | Err<BannedAccountError> = await getUser("1");

// Type-narrowing on `.isOk` or `.isError`
if (user.isError) {
  return user.error; // -> DatabaseError | BannedAccountError
}

user.value; // -> User
```

#### `Result.isError` helper to handle case by case (Exclude specific tags)

```ts
if (Result.isError(user, "BannedAccountError")) {
  // user is now narrowed to Err<BannedAccountError> and so we have .reason
  console.warn(user.error.reason);
} else {
  user; // -> Ok<User> | Err<DatabaseError>
}
```

#### Modifier APIs

```ts
// Unwrap the Ok channel or return a default value
const user: User | null = await getUser("1").unwrapOr(null);

// Map the Ok channel or provide fallbacks for specific tags in Err channel
const userNameResult: Result<string | null, never> = getUser("1")
  .andThen((user) => user.name)
  .catchTags({
    DatabaseError: () => Result.ok(null),
    BannedAccountError: (e) => Result.ok(`Banned User (${e.reason})`),
  });
```

---

## 🧩 API overview

| Category         | Helpers                                                           | Description                                            |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| **Core**         | `ok`, `err`, `Result.die`, `Result.TaggedError`, `Result.isError` | Tagged union representing success / failure            |
| **Creating**     | `Result.gen`, `Result.fn`, `Result.try`                           | Write synchronous‑looking async pipelines              |
| **Consuming**    | `.unwrap`, `.unwrapOr`, `.unwrapAsTuple`                          | `Result` is `PromiseLike` – interoperable with `await` |
| **Transform**    | `.map`, `.mapError`, `.flatMap`/`.andThen`                        | Data‑first & data‑last signatures (powered by `dual`)  |
| **Side-effects** | `.tap`, `.tapError`, `.tapErrorTag`                               | Effectful inspection without transforming              |
| **Recovery**     | `.orElse`, `.catchTag`, `.catchTags`                              | Pattern‑match & recover from errors                    |
| **Utilities**    | `Result.all`, `Result.of`, `Result.asSerializable`                | Error handling and composition                         |
| **Type helpers** | `Ok`, `Err`, `Result.InferOk`, `Result.InferErr`, `Result.TagsOf` | Type-level utilities for extracting types              |

---

## 🔌 Interop & Utility helpers

- **`try`** – wrap any promise‑returning function, catching thrown exceptions
- **`all`** – run many `Result`s in parallel, stop at first failure
- **`pipe` / `flow`** – ergonomic FP‑style composition helpers

---

## 📚 Full API reference

Inprogress...

See the inline JSDoc, source and tests for the full API.

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

  - `Result.gen`, `Result.fn` inspired by Effect's `Effect.gen`, `Effect.fn`
  - Modifier APIs like `andThen`, `catchTags`, etc. are inspired by Effect
  - `pipe`, `flow`, and `dual` utilities are copied directly from Effect's source code (MIT Licensed)

- [neverthrow](https://github.com/supermacro/neverthrow) - A type-safe error handling solution for TypeScript that helped shape the API design of this library.

  - Result class inspired by neverthrow's `ResultAsync` class

---

##  🪪 License

MIT © 2025 Leon Salsiccia
