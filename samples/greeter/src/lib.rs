mod bindings {
    //! Generated code for implementing the `greeter` world in `wit/world.wit`.
    wit_bindgen::generate!({
        path: "wit/world.wit",
    });

    use super::GreeterComponent;
    export!(GreeterComponent);
}

use bindings::exports::docs::greeter::multi_greet::Language;

/// Component that implements the `docs:greeter` interfaces.
struct GreeterComponent;

impl bindings::exports::docs::greeter::greet::Guest for GreeterComponent {
    /// Greet someone by name in English.
    fn greet(name: String) -> String {
        format!("Hello, {name}!")
    }
}

impl bindings::exports::docs::greeter::multi_greet::Guest for GreeterComponent {
    /// Greet someone in a specific language.
    fn greet_in(name: String, lang: Language) -> String {
        match lang {
            Language::English => format!("Hello, {name}!"),
            Language::Spanish => format!("¡Hola, {name}!"),
            Language::French => format!("Bonjour, {name}!"),
            Language::German => format!("Hallo, {name}!"),
            Language::Japanese => format!("こんにちは、{name}！"),
        }
    }
}
