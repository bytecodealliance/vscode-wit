use wit_parser::ast::lex::Token;

pub const PACKAGE: &str = include_str!("package.md");
pub const WORLD: &str = include_str!("world.md");
pub const INTERFACE: &str = include_str!("interface.md");
pub const TYPE: &str = include_str!("type.md");
pub const RECORD: &str = include_str!("record.md");
pub const FUNC: &str = include_str!("func.md");
pub const USE: &str = include_str!("use.md");

pub fn for_token(token: &Token) -> &'static str {
    use Token::*;
    match token {
        Package => PACKAGE,
        World => WORLD,
        Interface => INTERFACE,
        Type => TYPE,
        Record => RECORD,
        Func => FUNC,
        Use => USE,
        _ => token.describe(),
    }
}
