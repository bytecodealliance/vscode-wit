mod bindings {
    //! Generated code for implementing the `adder` world in `wit/world.wit`.
    wit_bindgen::generate!({
        path: "wit/world.wit",
    });

    use super::AdderComponent;
    export!(AdderComponent);
}

/// Component that implements the `docs:adder/add` interface.
struct AdderComponent;

impl bindings::exports::docs::adder::add::Guest for AdderComponent {
    /// Add two unsigned 32-bit integers.
    fn add(x: u32, y: u32) -> u32 {
        x + y
    }
}
