# Changelog

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
