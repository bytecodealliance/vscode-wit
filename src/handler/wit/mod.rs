use tower_lsp::lsp_types::Position;

pub mod docs;

pub struct WitFile {
    text: String,
}

pub struct WitToken {
    text: String,
    position: Position,
}

impl WitToken {
    pub fn new(text: String, position: Position) -> Self {
        Self { text, position }
    }

    pub fn text(&self) -> &str {
        &self.text
    }

    pub fn position(&self) -> &Position {
        &self.position
    }

    pub fn documentation(&self) -> String {
        match self.text.as_str() {
            "package" => docs::PACKAGE,
            "world" => docs::WORLD,
            "interface" => docs::INTERFACE,
            "type" => docs::DESCRIPTION,
            "record" => docs::RECORD,
            "func" => docs::FUNC,
            "use" => docs::USE,
            "import" => "An import statement imports a function.",
            "export" => "An export statement exports a function.",
            "{" | "}" => "A block is a collection of statements.",
            "(" | ")" => "A group is a collection of expressions.",
            ":" => "A type annotation specifies the type of a field.",
            "." => "A field access expression accesses a field of a record.",
            "<" | ">" => "A type parameter is a specialized a generic type.",
            _ => "An identifier",
        }
        .to_string()
    }
}

impl WitFile {
    pub fn new(text: String) -> Self {
        Self { text }
    }

    pub fn lines(&self) -> impl Iterator<Item = &str> {
        self.text.lines()
    }

    pub fn line_at(&self, line: u32) -> Option<&str> {
        self.lines().nth(line as usize)
    }

    // buggy for now (doesn't handle whitespace correctly)
    pub(crate) fn token_at(&self, position: Position) -> Option<WitToken> {
        let mut character = 0;

        for word in self.line_at(position.line)?.split_whitespace() {
            character += word.len();
            if character >= position.character as usize {
                return Some(WitToken::new(word.to_owned(), position));
            }
        }

        None
    }
}
