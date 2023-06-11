# Function

Functions are defined in an `interface` or are listed as an
`import` or `export` from a `world`. Parameters to a function must all
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
distinctly in the component binary format.
