pub const PACKAGE_DESCRIPTION: &str = "WIT packages are the basis of sharing types and definitions in an ecosystem of
  components. Authors can import types from other WIT packages when generating a
  component, publish a WIT package representing a host embedding, or collaborate
  on a WIT definition of a shared set of APIs between platforms.";

pub const WORLD_DESCRIPTION: &str = "WIT documents can contain a `world` definition at the top-level in addition to
`interface` definitions. A world is a complete description of
both imports and exports of a component. A world can be thought of as an
equivalent of a `component` type in the component model. For example this
world:

```wit
world my-world {
  import host: interface {
    log: func(param: string)
  }

  export run: func()
}
```


Worlds describe a concrete component and are the basis of bindings generation. A
guest language will use a `world` to determine what functions are imported, what
they're named, and what functions are exported, in addition to their names.

Worlds can contain any number of imports and exports, and can be either a
function or an interface.

```wit
world command {
  import fs: wasi-fs.fs
  import random: wasi-random.random
  import clock: wasi-clock.clock
  // ...

  export main: func(args: list<string>)
}
```

An imported or exported interface corresponds to an imported or exported
instance in the component model. Functions are equivalent to bare component
functions.

Additionally interfaces can be defined \"inline\" as a form of sugar for defining
it at the top-level

```wit
world your-world {
  import out-of-line2: interface {
    the-function: func()
  }
}
```";

pub const INTERFACE_DESCRIPTION: &str = "The concept of an \"interface\" is central in WIT as a collection of functions
and types. An interface can be thought of as an instance in the WebAssembly
Component Model, for example a unit of functionality imported from the host or
implemented by a component for consumption on a host. All functions and types
belong to an interface.

An example of an interface is:

```wit
interface host {
  log: func(msg: string)
}

```

represents an interface called `host` which provides one function, `log`, which
takes a single `string` argument.

An `interface` can contain `use` statements, `type` definitions,
and function definitions. For example:

```wit
interface wasi-fs {
  use pkg.types.{errno}

  record stat {
    ino: u64,
    size: u64,
    // ...
  }

  stat-file: func(path: string) -> result<stat, errno>
}
```";

pub const TYPE_DESCRIPTION: &str = "Types in WIT files can only be defined in `interface`s at this
time. The types supported in WIT is the same set of types supported in the
component model itself:

```wit
interface foo {
  // \"package of named fields\"
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
  type t5 = result<_, errno>            // no \"ok\" type
  type t6 = result<string>              // no \"err\" type
  type t7 = result<char, errno>         // both types specified
  type t8 = result                      // no \"ok\" or \"err\" type
  type t9 = list<string>
  type t10 = t9
}
```

The `record`, `variant`, `enum`, `union`, and `flags` types must all have names
associated with them. The `list`, `option`, `result`, `tuple`, and primitive
types do not need a name and can be mentioned in any context. This restriction
is in place to assist with code generation in all languages to leverage
language-builtin types where possible while accommodating types that need to be
defined within each language as well.";


pub const RECORD_DESCRIPTION: &str = "A `record` statement declares a new named structure with named fields. Records
are similar to a `struct` in many languages. Instances of a `record` always have
their fields defined.

```wit
record pair {
    x: u32,
    y: u32,
}

record person {
    name: string,
    age: u32,
    has-lego-action-figure: bool,
}
```";

pub const FUNC_DESCRIPTION: &str = "Functions are defined in an [`interface`][interfaces] or are listed as an
`import` or `export` from a [`world`][worlds]. Parameters to a function must all
be named and have unique names:

```wit
interface foo {
  a1: func()
  a2: func(x: u32)
  a3: func(y: u64, z: float32)
}
```

Functions can return at most one unnamed type:

```wit
interface foo {
  a1: func() -> u32
  a2: func() -> string
}
```

And functions can also return multiple types by naming them:

```wit
interface foo {
  a: func() -> (a: u32, b: float32)
}
```

Note that returning multiple values from a function is not equivalent to
returning a tuple of values from a function. These options are represented
distinctly in the component binary format.";


pub const USE_DESCRIPTION: &str = "A `use` statement enables importing type or resource definitions from other
wit documents. The structure of a use statement is:

```wit
use self.interface.{a, list, of, names}
use pkg.document.some-type
use my-dependency.document.other-type
```";