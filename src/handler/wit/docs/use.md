# WIT Packages and `use`

A WIT package represents a unit of distribution that can be published to a
registry, for example, and used by other WIT packages. WIT packages are a flat
list of interfaces and worlds defined in `*.wit` files. The current thinking
for a convention is that projects will have a `wit` folder where all
`wit/*.wit` files within describe a single package.

The purpose of the `use` statement is to enable sharing types between
interfaces, even if they're defined outside of the current package in a
dependency. The `use` statement can be used both within interfaces and worlds
and at the top-level of a WIT file.

## Interfaces, worlds, and `use`

A `use` statement inside of an `interface` or `world` block can be used to
import types:

```wit
package local:demo

interface types {
  enum errno { /* ... */ }

  type size = u32
}

interface my-host-functions {
  use types.{errno, size}
}
```

The `use` target, `types`, is resolved within the scope of the package to an
interface, in this case defined prior. Afterwards a list of types are provided
as what's going to be imported with the `use` statement. The interface `types`
may textually come either after or before the `use` directive's interface.
Interfaces linked with `use` must be acyclic.

Names imported via `use` can be renamed as they're imported as well:

```wit
package local:demo

interface my-host-functions {
  use types.{errno as my-errno}
}
```

This form of `use` is using a single identifier as the target of what's being
imported, in this case `types`. The name `types` is first looked up within the
scope of the current file, but it will additionally consult the package's
namespace as well. This means that the above syntax still works if the
interfaces are defined in sibling files:

```wit
// types.wit
interface types {
  enum errno { /* ... */ }

  type size = u32
}

// host.wit
package local:demo

interface my-host-functions {
  use types.{errno, size}
}
```

Here the `types` interface is not defined in `host.wit` but lookup will find it as it's defined in the same package, just instead in a different file.

When importing or exporting an `interface` in a `world`
the same syntax is used in `import` and `export` directives:

```wit
// a.wit
package local:demo

world my-world {
  import host

  export another-interface
}

interface host {
  // ...
}

// b.wit
interface another-interface {
  // ...
}
```

When referring to an interface an ID form can additionally be used to refer to
dependencies. For example above it was seen:

```wit
package local:demo

world my-world {
  import wasi:clocks/monotonic-clock
}
```

Here the interface being referred to is the ID `wasi:clocks/monotonic-clock`.
This is the package identified by `wasi:clocks` and the interface
`monotonic-clock` within that package. This same syntax can be used in `use` as
well:

```wit
package local:demo

interface my-interface {
  use wasi:http/types.{request, response}
}
```

## Top-level `use`

If a package being referred to has a version number, then using the above syntax
so far it can get a bit repetitive to be referred to:

```wit
package local:demo

interface my-interface {
  use wasi:http/types@1.0.0.{request, response}
}

world my-world {
  import wasi:http/handler@1.0.0
  export wasi:http/handler@1.0.0
}
```

To reduce repetition and to possibly help avoid naming conflicts the `use`
statement can additionally be used at the top-level of a file to rename
interfaces within the scope of the file itself. For example the above could be
rewritten as:

```wit
package local:demo

use wasi:http/types@1.0.0
use wasi:http/handler@1.0.0

interface my-interface {
  use types.{request, response}
}

world my-world {
  import handler
  export handler
}
```

The meaning of this and the previous world are the same, and `use` is purely a
developer convenience for providing smaller names if necessary.

The interface referred to by a `use` is the name that is defined in the current
file's scope:

```wit
package local:demo

use wasi:http/types   // defines the name `types`
use wasi:http/handler // defines the name `handler`
```

Like with interface-level-`use` the `as` keyword can be used to rename the
inferred name:

```wit
package local:demo

use wasi:http/types as http-types
use wasi:http/handler as http-handler
```

Note that these can all be combined to additionally import packages with
multiple versions and renaming as different identifiers.

```wit
package local:demo

use wasi:http/types@1.0.0 as http-types1
use wasi:http/types@2.0.0 as http-types2

// ...
```

### Transitive imports and worlds

A `use` statement is not implemented by copying type information around but
instead retains that it's a reference to a type defined elsewhere. This
representation is plumbed all the way through to the final component, meaning
that `use`d types have an impact on the structure of the final generated
component.

For example this document:

```wit
package local:demo

interface shared {
  record metadata {
    // ...
  }
}

world my-world {
  import host: interface {
    use shared.{metadata}

    get: func() -> metadata
  }
}
```

would generate this component:

```wasm
(component
  (import (interface "local:demo/shared") (instance $shared
    (type $metadata (record (; ... ;)))
    (export "metadata" (type (eq $metadata)))
  ))
  (alias export $shared "metadata" (type $metadata_from_shared))
  (import "host" (instance $host
    (export $metadata_in_host "metadata" (type (eq $metadata_from_shared)))
    (export "get" (func (result $metadata_in_host)))
  ))
)
```

Here it can be seen that despite the `world` only listing `host` as an import
the component additionally imports a `local:demo/shared` interface. This is due
to the fact that the `use shared.{ ... }` implicitly requires that `shared` is
imported into the component as well.

Note that the name `"local:demo/shared"` here is derived from the name of the
`interface` plus the package ID `local:demo`.

For `export`ed interfaces any transitively `use`d interface is assumed to be an
import unless it's explicitly listed as an export.

> **Note**: It's planned in the future to have "power user syntax" to configure
> this on a more fine-grained basis for exports, for example being able to
> configure that a `use`'d interface is a particular import or a particular
> export.
