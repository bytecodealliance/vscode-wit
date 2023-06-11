use std::{path::Path, fmt::Display};

use tower_lsp::{
    lsp_types::{
        InitializeParams, InitializeResult, InitializedParams,
        MessageType, ServerCapabilities, ServerInfo, TextDocumentSyncCapability,
        TextDocumentSyncKind, Url, DidOpenTextDocumentParams, DidCloseTextDocumentParams, DidChangeTextDocumentParams, DidSaveTextDocumentParams, WillSaveTextDocumentParams,
    },
    Client,
};

mod linter;
use linter::Linter;

pub struct Handler {
    client: Client,
}

impl Handler {
    pub fn new(client: Client) -> Self {
        Self {
            client,
        }
    }

    pub async fn initialize(&self, params: &InitializeParams) -> InitializeResult {
        let _ = params;
        InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                ..Default::default()
            },
            server_info: Some(ServerInfo {
                name: env!("CARGO_PKG_NAME").to_owned(),
                version: Some(env!("CARGO_PKG_VERSION").to_owned()),
            }),
        }
    }

    pub async fn initialized(&self, params: InitializedParams) {
        let _ = params;
        self.client.log_message(MessageType::LOG, "Wit LSP initialized").await;
    }

    pub async fn did_open(&self, params: DidOpenTextDocumentParams) {
        self.client
            .log_message(MessageType::LOG, format!("Opened {}", params.text_document.uri))
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn did_close(&self, params: DidCloseTextDocumentParams) {
        self.client
            .log_message(MessageType::LOG, format!("Closed {}", params.text_document.uri))
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn did_change(&self, params: DidChangeTextDocumentParams) {
        self.client
            .log_message(MessageType::LOG, format!("Changed {}", params.text_document.uri))
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn did_save(&self, params: DidSaveTextDocumentParams) {
        self.client
            .log_message(MessageType::LOG, format!("Saved {}", params.text_document.uri))
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn will_save(&self, params: WillSaveTextDocumentParams) {
        self.client.log_message(MessageType::LOG, format!("Will save {}", params.text_document.uri)).await;

        self.lint(params.text_document.uri).await;
    }

    async fn lint(
        &self,
        url: Url,
    ) {
        self.client
            .publish_diagnostics(url.clone(), Vec::new(), None)
            .await;
        let path = Path::new(url.path());

        let mut linter = Linter::new(path);

        let Ok(output) = linter.run().await else {
            return;
        };

        for (uri, diag) in output {
            self.client.publish_diagnostics(uri, diag, None).await;
        }
    }

    pub async fn shutdown(&self) {
        self.log("Shutting down").await;
    }

    pub async fn log(&self, text: impl Display) {
        self.client.log_message(MessageType::LOG, text).await;
    }
}