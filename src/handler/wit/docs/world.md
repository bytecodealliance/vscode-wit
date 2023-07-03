# World

WIT packages can contain `world` definitions at the top-level in addition to `interface` definitions.

A world is a complete description of both imports and exports of a component. A world can be thought of as an equivalent of a `component` type in the component model.

For example this world:

```wit
package local:demo

world my-world {
  import host: interface {
    log: func(param: string)
  }

  export run: func()
}
```

can be thought of as this component type:

```wasm
(type $my-world (component
  (import "host" (instance
    (export "log" (func (param "param" string)))
  ))
  (export "run" (func))
))
```

Worlds describe a concrete component and are the basis of bindings generation.

A guest language will use a `world` to determine what functions are imported, what they're named, and what functions are exported, in addition to their names.

Worlds can contain any number of imports and exports, and can be either a function or an interface.

```wit
package local:demo

world command {
  import wasi:filesystem/filesystem
  import wasi:random/random
  import wasi:clocks/monotonic-clock
  // ...

  export main: func(args: list<string>)
}
```

More information about the `wasi:random/random` syntax is available below in the description of `use`.

An imported or exported interface corresponds to an imported or exported instance in the component model.

Functions are equivalent to bare component functions.

Additionally interfaces can be defined inline with an explicit kebab-name that avoids the need to have an out-of-line definition.

```wit
package local:demo

interface out-of-line {
  the-function: func()
}

world your-world {
  import out-of-line
  // ... is roughly equivalent to ...
  import out-of-line: interface {
    the-function: func()
  }
}
```

The kebab name of the `import` or `export` is the name of the corresponding item in the final component.

In the component model imports to a component either use an ID or a kebab-name, and in WIT this is reflected in the syntax:

```wit
package local:demo

interface my-interface {
  // ..
}

world command {
  // generates an import of the ID `local:demo/my-interface`
  import my-interface

  // generates an import of the ID `wasi:filesystem/types`
  import wasi:filesystem/types

  // generates an import of the kebab-name `foo`
  import foo: func()

  // generates an import of the kebab-name `bar`
  import bar: interface {
    // ...
  }
}
```

Kebab names cannot overlap and must be unique, even between imports and exports.

IDs, however, can be both imported and exported. The same interface cannot be explicitly imported or exported twice.
