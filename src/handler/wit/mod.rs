use std::sync::atomic::{AtomicU32, Ordering};

use anyhow::Result;
use ropey::Rope;
use tower_lsp::lsp_types::{
    Hover, HoverContents, MarkedString, Position, Range, SemanticToken, SemanticTokenType,
    SemanticTokens,
};
use wit_parser::ast::lex::{Span, Token, Tokenizer};

pub(crate) mod docs;
pub(crate) mod token;

pub struct File {
    rope: Rope,
}

impl File {
    pub fn new(text: impl AsRef<str>) -> Self {
        Self {
            rope: Rope::from_str(text.as_ref()),
        }
    }

    pub fn text(&self) -> String {
        self.rope.to_string()
    }

    pub fn position_at(&self, offset: u32) -> Result<Position> {
        let line = self.rope.try_char_to_line(offset.try_into()?)? as u32;
        let first_char_of_line = self.rope.try_line_to_char(line.try_into()?)?;
        let column = offset - first_char_of_line as u32;
        Ok(Position::new(line, column))
    }

    pub fn range_at(&self, span: &Span) -> Result<Range> {
        let start = self.position_at(span.start)?;
        let end = self.position_at(span.end)?;
        Ok(Range::new(start, end))
    }

    pub fn hover_at(&self, position: Position) -> Result<Hover> {
        let text = self.text();
        let mut lexer = Tokenizer::new(&text, 0)?;
        let mut hover = Vec::new();
        while let Some((span, token)) = lexer.next()? {
            let range = self.range_at(&span)?;
            if !range_contains(range, position) {
                continue;
            }
            hover.push(MarkedString::String(docs::for_token(&token).to_string()))
        }
        Ok(Hover {
            contents: HoverContents::Array(hover),
            range: None,
        })
    }

    pub fn semantic_tokens(&self) -> SemanticTokens {
        let id = TOKEN_RESULT_COUNTER
            .fetch_add(1, Ordering::SeqCst)
            .to_string();
        let mut builder = SemanticTokensBuilder::new(id);

        let text = self.text();
        let Ok(mut lexer) = Tokenizer::new(&text, 0) else {
            return builder.build()
        };

        while let Ok(Some((span, token))) = lexer.next() {
            let Ok(range) = self.range_at(&span) else { continue };
            builder.push_token(&range, &token);
        }

        builder.build()
    }
}

fn range_contains(range: Range, position: Position) -> bool {
    range.start.line == position.line
        && range.start.character <= position.character
        && range.end.character >= position.character
}

static TOKEN_RESULT_COUNTER: AtomicU32 = AtomicU32::new(1);

pub struct SemanticTokensBuilder {
    id: String,
    prev_line: u32,
    prev_char: u32,
    data: Vec<SemanticToken>,
}

impl SemanticTokensBuilder {
    pub fn new(id: String) -> Self {
        SemanticTokensBuilder {
            id,
            prev_line: 0,
            prev_char: 0,
            data: Default::default(),
        }
    }

    pub fn push(&mut self, range: &Range, token: &SemanticTokenType) {
        let mut delta_line = range.start.line;
        let mut delta_start = range.start.character;

        if !self.data.is_empty() {
            delta_line -= self.prev_line;
            if delta_line == 0 {
                delta_start -= self.prev_char;
            }
        }

        let token = SemanticToken {
            delta_line,
            delta_start,
            length: range.end.character - range.start.character,
            token_type: token::type_index(token),
            token_modifiers_bitset: 0,
        };

        self.data.push(token);

        self.prev_line = range.start.line;
        self.prev_char = range.start.character;
    }

    pub fn push_token(&mut self, range: &Range, token: &Token) {
        match token {
            Token::Whitespace => {}
            Token::Comment => {
                self.push(range, &SemanticTokenType::COMMENT);
            }
            Token::Equals
            | Token::Comma
            | Token::Colon
            | Token::Period
            | Token::Semicolon
            | Token::LeftParen
            | Token::RightParen
            | Token::LeftBrace
            | Token::RightBrace
            | Token::LessThan
            | Token::GreaterThan
            | Token::RArrow
            | Token::Star
            | Token::At
            | Token::Slash
            | Token::Plus
            | Token::Minus => {
                self.push(range, &SemanticTokenType::OPERATOR);
            }

            Token::Include
            | Token::Package
            | Token::Interface
            | Token::Import
            | Token::Export
            | Token::World
            | Token::Use
            | Token::Type
            | Token::Func
            | Token::Resource
            | Token::Record
            | Token::Flags
            | Token::Variant
            | Token::Enum
            | Token::Union => {
                self.push(range, &SemanticTokenType::KEYWORD);
            }

            Token::With | Token::As | Token::From_ | Token::Static | Token::Shared => {
                self.push(range, &SemanticTokenType::MODIFIER);
            }

            Token::U8
            | Token::U16
            | Token::U32
            | Token::U64
            | Token::S8
            | Token::S16
            | Token::S32
            | Token::S64
            | Token::Float32
            | Token::Float64
            | Token::Char
            | Token::Bool
            | Token::String_
            | Token::Option_
            | Token::Result_
            | Token::Future
            | Token::Stream
            | Token::List
            | Token::Tuple => {
                self.push(range, &SemanticTokenType::TYPE);
            }

            Token::Underscore | Token::Id | Token::ExplicitId => {
                self.push(range, &SemanticTokenType::VARIABLE);
            }

            Token::Integer => {
                self.push(range, &SemanticTokenType::NUMBER);
            }
        };
    }

    pub fn build(self) -> SemanticTokens {
        SemanticTokens {
            result_id: Some(self.id),
            data: self.data,
        }
    }
}
