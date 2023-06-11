# Interface

The concept of an "interface" is central in WIT as a collection of functions
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
```
