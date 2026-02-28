use std::cell::Cell;

mod bindings {
    //! Generated code for implementing the `counter` world in `wit/world.wit`.
    wit_bindgen::generate!({
        path: "wit/world.wit",
    });

    use super::CounterResource;
    export!(CounterResource);
}

use bindings::exports::docs::counter::types::{Guest, GuestCounter};

/// Top-level component export.
struct CounterResource;

impl Guest for CounterResource {
    type Counter = Counter;
}

/// A counter resource that tracks a running total.
pub struct Counter {
    value: Cell<i32>,
}

impl GuestCounter for Counter {
    /// Create a new counter with an initial value.
    fn new(initial: i32) -> Self {
        Counter {
            value: Cell::new(initial),
        }
    }

    /// Increment the counter by a given amount and return the new value.
    fn increment_by(&self, amount: i32) -> i32 {
        let new_val = self.value.get() + amount;
        self.value.set(new_val);
        new_val
    }

    /// Decrement the counter by a given amount and return the new value.
    fn decrement_by(&self, amount: i32) -> i32 {
        let new_val = self.value.get() - amount;
        self.value.set(new_val);
        new_val
    }

    /// Get the current value of the counter.
    fn get_value(&self) -> i32 {
        self.value.get()
    }

    /// Reset the counter to zero and return the old value.
    fn reset(&self) -> i32 {
        let old = self.value.get();
        self.value.set(0);
        old
    }
}
