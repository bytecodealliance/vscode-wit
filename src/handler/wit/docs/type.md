# Type

Types in WIT files can only be defined in `interface`s at this
time. The types supported in WIT is the same set of types supported in the
component model itself:

```wit
interface foo {
  // package of named fields
  record r {
    a: u32,
    b: string,
  }

  // values of this type will be one of the specified cases
  variant human {
    baby,
    child(u32), // optional type payload
    adult,
  }

  // similar to `variant`, but no type payloads
  enum errno {
    too-big,
    too-small,
    too-fast,
    too-slow,
  }

  // similar to `variant`, but doesn't require naming cases and all variants
  // have a type payload -- note that this is not a C union, it still has a
  // discriminant
  union input {
    u64,
    string,
  }

  // a bitflags type
  flags permissions {
    read,
    write,
    exec,
  }

  // type aliases are allowed to primitive types and additionally here are some
  // examples of other types
  type t1 = u32
  type t2 = tuple<u32, u64>
  type t3 = string
  type t4 = option<u32>
  type t5 = result<_, errno>            // no "ok" type
  type t6 = result<string>              // no "err" type
  type t7 = result<char, errno>         // both types specified
  type t8 = result                      // no "ok" or "err" type
  type t9 = list<string>
  type t10 = t9
}
```

The `record`, `variant`, `enum`, `union`, and `flags` types must all have names
associated with them. The `list`, `option`, `result`, `tuple`, and primitive
types do not need a name and can be mentioned in any context. This restriction
is in place to assist with code generation in all languages to leverage
language-builtin types where possible while accommodating types that need to be
defined within each language as well.
