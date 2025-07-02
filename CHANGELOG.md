# Changelog

## [0.3.9](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.8...wit-idl-v0.3.9) (2025-07-02)


### Bug Fixes

* release ci failing to complete ([ca5b27b](https://github.com/bytecodealliance/vscode-wit/commit/ca5b27bc8f602b763f27225b8402c273a9ec1084))

## [0.3.8](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.7...wit-idl-v0.3.8) (2025-06-30)


### Features

* implement sized list syntax support (list&lt;type, size&gt;) ([ae26b28](https://github.com/bytecodealliance/vscode-wit/commit/ae26b28f5df856d4a1b0087033ed5f5403402d53)), closes [#57](https://github.com/bytecodealliance/vscode-wit/issues/57)

## [0.3.7](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.6...wit-idl-v0.3.7) (2025-06-25)


### Features

* add code generation ([cc7dd88](https://github.com/bytecodealliance/vscode-wit/commit/cc7dd88198ed22b8cf1010be0d9e3221bfbed229))
* add keybindings for syntax checking commands ([55f1b46](https://github.com/bytecodealliance/vscode-wit/commit/55f1b469c69783ae5567a1a4eee205aabc353c22))


### Bug Fixes

* missing world error failing to parse ([dbf1fd3](https://github.com/bytecodealliance/vscode-wit/commit/dbf1fd35c3812fc3da2da554c84625a4120276c6))

## [0.3.6](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.5...wit-idl-v0.3.6) (2025-06-15)


### Bug Fixes

* automate worker + wasm resource detection ([20dda9c](https://github.com/bytecodealliance/vscode-wit/commit/20dda9c797454850d5b6586592ea7c935460ae1b))

## [0.3.5](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.4...wit-idl-v0.3.5) (2025-06-14)


### Features

* basic syntax checking ([57d8f5a](https://github.com/bytecodealliance/vscode-wit/commit/57d8f5a78a9869060e5ace869eb751bb7debaa4e))


### Bug Fixes

* update devDependencies to use exact versions ([abee70b](https://github.com/bytecodealliance/vscode-wit/commit/abee70b05fae6015fc7993596ef69dc96387ab54)), closes [#50](https://github.com/bytecodealliance/vscode-wit/issues/50)

## [0.3.4](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.3...wit-idl-v0.3.4) (2025-05-29)


### Features

* add support for feature gates ([8624eb4](https://github.com/bytecodealliance/vscode-wit/commit/8624eb4af5f291bd6952a210966ff3f4865c52c5)), closes [#34](https://github.com/bytecodealliance/vscode-wit/issues/34)

## [0.3.3](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.2...wit-idl-v0.3.3) (2025-05-17)


### Bug Fixes

* sync vscode types and engine ([482fd7d](https://github.com/bytecodealliance/vscode-wit/commit/482fd7d6b4a33ba8440560c4a9644c784fcd2ca6))

## [0.3.2](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.1...wit-idl-v0.3.2) (2025-05-12)


### Bug Fixes

* comments on type aliases are now recognized as comments ([80c21d1](https://github.com/bytecodealliance/vscode-wit/commit/80c21d19ee4004bbcccf68c71ed13ceba6c4e7f6))
* separate rules for `result` keyword with and without &lt;&gt; ([cf87929](https://github.com/bytecodealliance/vscode-wit/commit/cf8792998880407f31399418a964bfe43454c54f))

## [0.3.1](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.3.0...wit-idl-v0.3.1) (2023-09-05)


### Bug Fixes

* missing resource methods ([#31](https://github.com/bytecodealliance/vscode-wit/issues/31)) ([36d0ceb](https://github.com/bytecodealliance/vscode-wit/commit/36d0ceb7a565b3b7e48b696c6322ffb88ea6e3c0))

## [0.3.0](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.2.3...wit-idl-v0.3.0) (2023-09-04)


### ⚠ BREAKING CHANGES

* The `union` type has been removed from the WIT grammar.

### Bug Fixes

* remove union typedef ([#28](https://github.com/bytecodealliance/vscode-wit/issues/28)) ([8b97b47](https://github.com/bytecodealliance/vscode-wit/commit/8b97b47b98a9fcf018cc5a879c0f30b44866d911))

## [0.2.3](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.2.2...wit-idl-v0.2.3) (2023-09-03)


### Features

* add basic markdown highlighting in doc-comments ([e64075b](https://github.com/bytecodealliance/vscode-wit/commit/e64075b4c76041e3262f690b1e8f918bc69b74b6))
* add simple auto-complete for keywords and built-in types ([7bb2014](https://github.com/bytecodealliance/vscode-wit/commit/7bb2014f3d08b3d5a7084008163b2580d758366f))
* automatically continue doc-comments (`///`, `/**`) on next line ([b037f85](https://github.com/bytecodealliance/vscode-wit/commit/b037f853533db8323dd988f98afe0951440b7bf6))
* configure wordPattern to improve word highlighting and autocomplete suggestions ([7e887c6](https://github.com/bytecodealliance/vscode-wit/commit/7e887c6e50ff76576abc4d7ef45cc61e626124fc))


### Bug Fixes

* target newer VSCode to enable extension activation ([5c80b4a](https://github.com/bytecodealliance/vscode-wit/commit/5c80b4ad730f79100ced29970e963d034ff09dc6))

## [0.2.2](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.2.1...wit-idl-v0.2.2) (2023-09-03)


### Features

* add toplevel use keyword to wit grammar ([#26](https://github.com/bytecodealliance/vscode-wit/issues/26)) ([8990d18](https://github.com/bytecodealliance/vscode-wit/commit/8990d1836f2eb9e03de2fad0cb1d7acd1e7e61cb))

## [0.2.1](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.2.0...wit-idl-v0.2.1) (2023-09-02)


### Bug Fixes

* remove commitlint config file from extension package ([#23](https://github.com/bytecodealliance/vscode-wit/issues/23)) ([b75af2d](https://github.com/bytecodealliance/vscode-wit/commit/b75af2d050344f545f6c7dc848a6cd8a01160517))

## [0.2.0](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.1.2...wit-idl-v0.2.0) (2023-07-08)


### ⚠ BREAKING CHANGES

* The `default`, `self`, `pkg` keywords have been removed from the grammar.

### Features

* add package keyword to wit grammar ([#19](https://github.com/bytecodealliance/vscode-wit/issues/19)) ([8c9acc7](https://github.com/bytecodealliance/vscode-wit/commit/8c9acc7cb65b2dec1f15f2de8557c2e2f21e347c))

## [0.1.2](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.1.1...wit-idl-v0.1.2) (2023-07-03)


### Features

* add include keyword to wit grammar ([#17](https://github.com/bytecodealliance/vscode-wit/issues/17)) ([dcc5a30](https://github.com/bytecodealliance/vscode-wit/commit/dcc5a30d300146eac0ee5fac8287a4d30ce6106f))

## [0.1.1](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.1.0...wit-idl-v0.1.1) (2023-04-15)


### Bug Fixes

* lookbehind assertion with malformed regex ([#11](https://github.com/bytecodealliance/vscode-wit/issues/11)) ([8787a0a](https://github.com/bytecodealliance/vscode-wit/commit/8787a0a9c283249448f07a7ee97d2a9e7365e4ac))
* move repository fields to top-level object ([#13](https://github.com/bytecodealliance/vscode-wit/issues/13)) ([74f1ffc](https://github.com/bytecodealliance/vscode-wit/commit/74f1ffcf9ed0bd700066e51721bff042a1589c93))

## [0.1.0](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.0.3...wit-idl-v0.1.0) (2023-04-14)


### Miscellaneous Chores

* release 0.1.0 ([e50fec0](https://github.com/bytecodealliance/vscode-wit/commit/e50fec096a700b25b98570381eb77f2be9962ab2))

## [0.0.3](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.0.2...wit-idl-v0.0.3) (2023-04-12)


### Bug Fixes

* ensure kebab case for identifiers ([#5](https://github.com/bytecodealliance/vscode-wit/issues/5)) ([7ec3057](https://github.com/bytecodealliance/vscode-wit/commit/7ec30578ba6257669a40fa757688a82eebcef992))

## [0.0.2](https://github.com/bytecodealliance/vscode-wit/compare/wit-idl-v0.0.1...wit-idl-v0.0.2) (2023-04-10)


### Features

* add wit idl support for vscode ([b24abb8](https://github.com/bytecodealliance/vscode-wit/commit/b24abb873864a3d1fae838f101b7e3a06183e6a2))
