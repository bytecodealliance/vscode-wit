# Package

All WIT packages are assigned an "ID". IDs look like `foo:bar@1.0.0` and have
three components:

* A namespace, for example `foo` in `foo:bar`. This namespace is intended to
  disambiguate between registries, top-level organizations, etc. For example
  WASI interfaces use the `wasi` namespace.

* A package name, for example `clocks` in `wasi:clocks`. A package name groups
  together a set of interfaces and worlds that would otherwise be named with a
  common prefix.

* An optional version, specified as [full semver](https://semver.org/).

Package identifiers are specified at the top of a WIT file via a `package`
declaration:

```wit
package wasi:clocks
```

or

```wit
package wasi:clocks@1.2.0
```

WIT packages can be defined in a collection of files and at least one of them
must specify a `package` identifier. Multiple files can specify a `package` and
they must all agree on what the identifier is.

Package identifiers are used to generate IDs in the component model binary
format for `interface`s and `world`s.
