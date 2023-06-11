# World

WIT documents can contain a `world` definition at the top-level in addition to
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

Additionally interfaces can be defined "inline" as a form of sugar for defining
it at the top-level

```wit
world your-world {
  import out-of-line2: interface {
    the-function: func()
  }
}
```
