use std::sync::atomic::{AtomicU32, Ordering};

use ropey::Rope;
use tower_lsp::lsp_types::{
    Hover, HoverContents, MarkedString, Position, Range, SemanticToken, SemanticTokenType,
    SemanticTokens,
};
use wit_parser::ast::lex::{Span, Token, Tokenizer};

use crate::handler::wit::token::token_type_index;

mod docs;
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

    pub fn position_at(&self, offset: u32) -> ropey::Result<Position> {
        let line = self.rope.try_char_to_line(offset as usize)? as u32;
        let first_char_of_line = self.rope.try_line_to_char(line as usize)?;
        let column = offset - first_char_of_line as u32;
        Ok(Position::new(line, column))
    }

    pub fn range_at(&self, span: &Span) -> ropey::Result<Range> {
        let start = self.position_at(span.start)?;
        let end = self.position_at(span.end)?;
        Ok(Range::new(start, end))
    }

    pub fn hover_at(&self, position: Position) -> Option<Hover> {
        let mut hover = Vec::new();

        let text = self.text();
        let Ok(mut lexer) = Tokenizer::new(&text, 0) else {
            return None
        };

        while let Ok(Some((span, token))) = lexer.next() {
            let Ok(range) = self.range_at(&span) else { continue };

            if range.start.line == position.line
                && range.start.character <= position.character
                && range.end.character >= position.character
            {
                hover.push(MarkedString::String(docs::for_token(&token).to_string()))
            }
        }

        Some(Hover {
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

    /// Push a new token onto the builder
    pub fn push(&mut self, range: &Range, token: &SemanticTokenType) {
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
            token_type: token_type_index(token),
            token_modifiers_bitset: 0,
        };

        self.data.push(token);

        self.prev_line = range.start.line;
        self.prev_char = range.start.character;
    }

    pub fn push_token(&mut self, range: &Range, token: &Token) {
        use Token::*;
        match token {
            Whitespace => {}
            Comment => self.push(range, &SemanticTokenType::COMMENT),
            Equals | Comma | Colon | Period | Semicolon | LeftParen | RightParen | LeftBrace
            | RightBrace | LessThan | GreaterThan | RArrow | Star | At | Slash | Plus | Minus => {
                self.push(range, &SemanticTokenType::OPERATOR)
            }
            Package | As | From_ | Static | Interface | Import | Export | World | Use | Type
            | Func | Resource | Record | Shared | Flags | Variant | Enum | Union => {
                self.push(range, &SemanticTokenType::KEYWORD)
            }
            U8 | U16 | U32 | U64 | S8 | S16 | S32 | S64 | Float32 | Float64 | Char | Bool
            | String_ | Option_ | Result_ | Future | Stream | List | Tuple => {
                self.push(range, &SemanticTokenType::TYPE)
            }
            Underscore | Id | ExplicitId => self.push(range, &SemanticTokenType::VARIABLE),
            Integer => self.push(range, &SemanticTokenType::NUMBER),
        }
    }

    pub fn build(self) -> SemanticTokens {
        SemanticTokens {
            result_id: Some(self.id),
            data: self.data,
        }
    }
}
