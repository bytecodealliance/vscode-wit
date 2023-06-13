# Interface

The concept of an "interface" is central in WIT as a collection of [functions]
and [types]. An interface can be thought of as an instance in the WebAssembly
Component Model, for example a unit of functionality imported from the host or
implemented by a component for consumption on a host. All functions and types
belong to an interface.

An example of an interface is:

```wit
package local:demo

interface host {
  log: func(msg: string)
}
```

represents an interface called `host` which provides one function, `log`, which
takes a single `string` argument. If this were imported into a component then it
would correspond to:

```wasm
(component
  (import (interface "local:demo/host") (instance $host
    (export "log" (func (param "msg" string)))
  ))
  ;; ...
)
```

An `interface` can contain `use` statements, `type` definitions,
and `func` definitions. For example:

```wit
package wasi:filesystem

interface types {
  use wasi:clocks.wall-clock.{datetime}

  record stat {
    ino: u64,
    size: u64,
    mtime: datetime,
    // ...
  }

  stat-file: func(path: string) -> result<stat>
}
```

More information about `use` and `type` are described below, but this is an example of a collection of items within an `interface`.

All items defined in an `interface`, including `use` items, are considered as exports from the interface.

This means that types can further be used from the interface by
other interfaces. An interface has a single namespace which means that none of the defined names can collide.

A WIT package can contain any number of interfaces listed at the top-level and in any order.

The WIT validator will ensure that all references between
interfaces are well-formed and acyclic.
