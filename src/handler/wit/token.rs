use std::{fmt::Display, str::FromStr};

use logos::*;
use tower_lsp::lsp_types::{SemanticTokenType, SemanticTokenModifier, SemanticToken, Hover, MarkedString, HoverContents, SemanticTokens, Range};

use super::docs;
use wit_parser::PackageName;


#[derive(Debug, Clone, Eq, PartialEq)]
pub struct Package {
    pub name: String,
    pub namespace: String,
    pub version: String,
}

impl FromStr for Package {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut parts = s.split('@');
        let name = parts.next().ok_or(())?.to_owned();
        let version = parts.next().ok_or(())?.to_owned();
        let namespace = parts.next().ok_or(())?.to_owned();
        Ok(Self {
            name,
            namespace,
            version,
        })
    }
}


#[derive(Debug, Clone, Eq, PartialEq, Logos)]
pub enum Token<'a> {
    // Top-Level
    #[regex("package.*")]
    Package(&'a str),
    #[token("world")]
    World,
    #[token("interface")]
    Interface,
    // Statements
    #[token("func")]
    Func,
    #[token("use")]
    Use,
    #[token("as")]
    As,
    #[token("from")]
    From,
    #[token("import")]
    Import,
    #[token("export")]
    Export,
    // Types
    #[token("type")]
    Type,
    #[token("record")]
    Record,
    #[token("variant")]
    Variant,
    #[token("enum")]
    Enum,
    #[token("union")]
    Union,
    #[token("resource")]
    Resource,
    #[token("shared")]
    Shared,
    #[token("flags")]
    Flags,
    // Generics
    #[token("option")]
    Option,
    #[token("list")]
    List,
    #[token("result")]
    Result,
    #[token("future")]
    Future,
    #[token("stream")]
    Stream,
    // Built-In
    #[token("string")]
    String,
    #[token("bool")]
    Bool,
    #[token("char")]
    Char,
    #[token("u8")]
    U8,
    #[token("u16")]
    U16,
    #[token("u32")]
    U32,
    #[token("u64")]
    U64,
    #[token("s8")]
    S8,
    #[token("s16")]
    S16,
    #[token("s32")]
    S32,
    #[token("s64")]
    S64,
    #[token("float32")]
    Float32,
    #[token("float64")]
    Float64,
    // Other
    #[token("->")]
    RightArrow,
    #[token(".")]
    Period,
    #[token(":")]
    Colon,
    #[token("/")]
    Slash,
    #[token(",")]
    Comma,
    #[token("@")]
    At,
    #[token("-")]
    Minus,
    #[token("+")]
    Plus,
    #[token("=")]
    Equals,
    #[token(";")]
    Semicolon,
    #[token("(")]
    LeftParen,
    #[token(")")]
    RightParen,
    #[token("{")]
    LeftBrace,
    #[token("}")]
    RightBrace,
    #[token("<")]
    LessThan,
    #[token(">")]
    GreaterThan,
    #[token("*")]
    Star,
    #[regex("//.*")]
    LineComment(&'a str),
    #[regex("///.*")]
    DocComment(&'a str),
    #[regex("[a-zA-Z_-][a-zA-Z0-9_-]*")]
    Identifier(&'a str),
}

impl Token<'_> {
    pub fn hover(&self) -> Hover {
        use Token::*;
        let hover = match self {
            Package(_) => docs::PACKAGE,
            World => docs::WORLD,
            Interface => docs::INTERFACE,
            Record => docs::RECORD,
            Func => docs::FUNC,
            Use => docs::USE,
            Type => docs::TYPE,
            U8 => "An unsigned 8-bit integer.",
            U16 => "An unsigned 16-bit integer.",
            U32 => "An unsigned 32-bit integer.",
            U64 => "An unsigned 64-bit integer.",
            S8 => "A signed 8-bit integer.",
            S16 => "A signed 16-bit integer.",
            S32 => "A signed 32-bit integer.",
            S64 => "A signed 64-bit integer.",
            Float32 => "A 32-bit floating point number.",
            Float64 => "A 64-bit floating point number.",
            String => "A UTF-8 encoded string.",
            Char => "A single UTF-8 encoded character.",
            Bool => "A boolean value.",
            Option => "A type that may or may not contain a value.",
            List => "A list of values.",
            Result => "A type that may contain a value or an error.",
            Future => "A type that may contain a value in the future.",
            Stream => "A stream of values.",
            RightArrow => "The right arrow operator.",
            Period => "The period operator.",
            Colon => "The colon operator.",
            Slash => "The slash operator.",
            Comma => "The comma operator.",
            At => "The at operator.",
            Minus => "The minus operator.",
            Plus => "The plus operator.",
            Equals => "The equals operator.",
            Semicolon => "The semicolon operator.",
            LeftParen => "The left parenthesis operator.",
            RightParen => "The right parenthesis operator.",
            LeftBrace => "The left brace operator.",
            RightBrace => "The right brace operator.",
            LessThan => "The less than operator.",
            GreaterThan => "The greater than operator.",
            Star => "The star operator.",
            LineComment(text) => text[2..].trim(),
            DocComment(text) => text[3..].trim(),
            As => "The as keyword.",
            From => "The from keyword.",
            Import => "The import keyword.",
            Export => "The export keyword.",
            Variant => "The variant keyword.",
            Enum => "The enum keyword.",
            Union => "The union keyword.",
            Resource => "The resource keyword.",
            Shared => "The shared keyword.",
            Flags => "The flags keyword.",
            Identifier(id) => id
        }.to_string();

        Hover {
            contents: HoverContents::Scalar(MarkedString::String(hover)),
            range: None
        }
    }

    pub fn semantic_tokens(&self, range: Range) -> Vec<SemanticToken> {
        use Token::*;
        match self {
            Package(package) => {
                let mut tokens = Vec::new();



                tokens.push(SemanticToken {
                    delta_line: 0,
                    delta_start: 0,
                    length: package.len() as u32,
                    token_type: token_type_index(SemanticTokenType::NAMESPACE),
                    token_modifiers_bitset: 0
                });
                tokens
            },
            _ => Vec::new()
        }
    }

    // pub fn token_modifiers_bitset(&self) -> u32 {
    //     self.modifiers().into_iter()
    //     .map(|modifier| 1 << MODIFIERS.iter().position(|m| m == &modifier).unwrap_or(0))
    //     .sum()
    // }
}

impl Display for Token<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            use Token::*;
            match self {
                Package(package) => { return package.fmt(f) },
                World => "world",
                Interface => "interface",
                Record => "record",
                Func => "func",
                Use => "use",
                From => "from",
                Import => "import",
                Export => "export",
                Type => "type",
                Variant => "variant",
                Enum => "enum",
                Union => "union",
                Resource => "resource",
                Shared => "shared",
                Flags => "flags",
                Option => "option",
                List => "list",
                Result => "result",
                Future => "future",
                Stream => "stream",
                String => "string",
                Bool => "bool",
                Char => "char",
                U8 => "u8",
                U16 => "u16",
                U32 => "u32",
                U64 => "u64",
                S8 => "s8",
                S16 => "s16",
                S32 => "s32",
                S64 => "s64",
                Float32 => "float32",
                Float64 => "float64",
                RightArrow => "->",
                Period => ".",
                Colon => ":",
                Slash => "/",
                Comma => ",",
                At => "@",
                Minus => "-",
                Plus => "+",
                Equals => "=",
                Semicolon => ";",
                LeftParen => "(",
                RightParen => ")",
                LeftBrace => "{",
                RightBrace => "}",
                LessThan => "<",
                GreaterThan => ">",
                Star => "*",
                As => "as",
                LineComment(text) => text,
                DocComment(text) => text,
                Identifier(id) => id,
            }.fmt(f)
        }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parser() {
        let input = "package bytecodealliance:wit
world hello {
    import wasi:clocks/monotonic-clock
    import wasi:clocks/timezone
    import wasi:filesystem/types
    import wasi:sockets/instance-network
    import wasi:sockets/ip-name-lookup
    import wasi:sockets/network
    import wasi:sockets/tcp-create-socket
    import wasi:sockets/tcp
    import wasi:sockets/udp-create-socket
    import wasi:sockets/udp
    import wasi:random/random
    import wasi:random/insecure
    import wasi:random/insecure-seed
    import wasi:poll/poll
}";

        let tokens = Token::lexer(input).collect::<Vec<_>>();

        print!("{:#?}", tokens);
    }
}

use tower_lsp::lsp_types::SemanticTokensLegend;


pub fn token_type_index(token_type: SemanticTokenType) -> u32 {
    TYPES.iter().position(|t| t == &token_type).unwrap_or(0) as u32
}

pub const TYPES: [SemanticTokenType; 23] = [
    SemanticTokenType::KEYWORD,
    SemanticTokenType::NAMESPACE,
    SemanticTokenType::PROPERTY,
    SemanticTokenType::TYPE,
    SemanticTokenType::VARIABLE,
    SemanticTokenType::OPERATOR,
    SemanticTokenType::COMMENT,
    SemanticTokenType::ENUM,
    SemanticTokenType::INTERFACE,
    SemanticTokenType::STRUCT,
    SemanticTokenType::CLASS,
    SemanticTokenType::TYPE_PARAMETER,
    SemanticTokenType::PARAMETER,
    SemanticTokenType::ENUM_MEMBER,
    SemanticTokenType::EVENT,
    SemanticTokenType::FUNCTION,
    SemanticTokenType::METHOD,
    SemanticTokenType::MACRO,
    SemanticTokenType::MODIFIER,
    SemanticTokenType::STRING,
    SemanticTokenType::NUMBER,
    SemanticTokenType::REGEXP,
    SemanticTokenType::DECORATOR,
];

pub const MODIFIERS: [SemanticTokenModifier; 10] = [
    SemanticTokenModifier::DECLARATION,
    SemanticTokenModifier::DEFINITION,
    SemanticTokenModifier::READONLY,
    SemanticTokenModifier::STATIC,
    SemanticTokenModifier::DEPRECATED,
    SemanticTokenModifier::ABSTRACT,
    SemanticTokenModifier::ASYNC,
    SemanticTokenModifier::MODIFICATION,
    SemanticTokenModifier::DOCUMENTATION,
    SemanticTokenModifier::DEFAULT_LIBRARY,
];

pub fn legend() -> SemanticTokensLegend {
    SemanticTokensLegend {
        token_types: TYPES.to_vec(),
        token_modifiers: MODIFIERS.to_vec(),
    }
}

pub struct SemanticTokensBuilder {
    id: String,
    prev_line: u32,
    prev_char: u32,
    data: Vec<SemanticToken>,
}

impl SemanticTokensBuilder {
    pub fn new(id: String) -> Self {
        SemanticTokensBuilder { id, prev_line: 0, prev_char: 0, data: Default::default() }
    }

    /// Push a new token onto the builder
    pub fn push(&mut self, range: Range, token_index: u32, modifier_bitset: u32) {
        let mut push_line = range.start.line;
        let mut push_char = range.start.character;

        if !self.data.is_empty() {
            push_line -= self.prev_line;
            if push_line == 0 {
                push_char -= self.prev_char;
            }
        }

        // A token cannot be multiline
        let token_len = range.end.character - range.start.character;

        let token = SemanticToken {
            delta_line: push_line,
            delta_start: push_char,
            length: token_len,
            token_type: token_index,
            token_modifiers_bitset: modifier_bitset,
        };

        self.data.push(token);

        self.prev_line = range.start.line;
        self.prev_char = range.start.character;
    }

    pub fn build(self) -> SemanticTokens {
        SemanticTokens { result_id: Some(self.id), data: self.data }
    }
}
