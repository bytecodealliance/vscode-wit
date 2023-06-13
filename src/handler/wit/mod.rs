use std::sync::atomic::{AtomicU32, Ordering};

use logos::{Lexer, Logos};
use ropey::Rope;
use tower_lsp::lsp_types::{Position, Range, SemanticTokens, SemanticToken, Hover};

use token::Token;

use self::token::SemanticTokensBuilder;

mod docs;
pub(crate) mod token;

pub struct File {
    text: String,
}

impl File {
    pub fn new(text: String) -> Self {
        Self { text }
    }

    pub fn tokens(&self) -> Lexer<'_, Token<'_>> {
        Token::lexer(&self.text)
    }

    pub fn position_at(&self, offset: usize) -> Result<Position, ropey::Error> {
        let rope = Rope::from(self.text.as_str());
        let line = rope.try_char_to_line(offset)?;
        let first_char_of_line = rope.try_line_to_char(line)?;
        let column = offset - first_char_of_line;
        Ok(Position::new(line as u32, column as u32))
    }

    pub fn range_at(&self, start: usize, end: usize) -> Result<Range, ropey::Error> {
        let start = self.position_at(start)?;
        let end = self.position_at(end)?;
        Ok(Range::new(start, end))
    }

    pub fn semantic_tokens(&self) -> SemanticTokens {
        let id = TOKEN_RESULT_COUNTER.fetch_add(1, Ordering::SeqCst).to_string();
        let mut builder = SemanticTokensBuilder::new(id);

        let Ok(mut tokenizer) = wit_parser::ast::lex::Tokenizer::new(&self.text, 0) else {
            return builder.build()
        };

        let Ok(ast) = wit_parser::ast::Ast::parse(&mut tokenizer) else {
            return builder.build()
        };

        ast

        for (token, span) in self.tokens().spanned() {
            let Ok(token) = token else {
                continue
            };
            let Ok(range) = self.range_at(span.start, span.end) else {
                continue
            };
            for semantic_token in token.semantic_tokens(range) {
                builder.push(range, semantic_token.token_type, semantic_token.token_modifiers_bitset);
            }
        }

        builder.build()
    }

    pub fn token_at(&self, position: Position) -> Option<Result<Token, ()>> {
        self.tokens()
            .spanned()
            .find(|(_, span)| {
                let start = self.position_at(span.start).unwrap();
                let end = self.position_at(span.end).unwrap();
                start <= position && position < end
            })
            .map(|(token, _)| token)
    }

    pub fn hover_at(&self, position: Position) -> Option<Hover> {
        self.token_at(position)
            .and_then(|token| token.ok())
            .map(|token| token.hover())
    }
}

static TOKEN_RESULT_COUNTER: AtomicU32 = AtomicU32::new(1);

