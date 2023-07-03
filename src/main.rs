#![warn(clippy::pedantic)]
#![warn(clippy::nursery)]

use tower_lsp::{LspService, Server};
use wit_lsp::WitLsp;

async fn start() {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let (service, socket) = LspService::new(WitLsp::new);
    let server = Server::new(stdin, stdout, socket);
    server.serve(service).await;
}

#[tokio::main]
async fn main() {
    start().await;
}
