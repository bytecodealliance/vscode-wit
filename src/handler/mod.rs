use std::{
    fmt::Display,
    path::Path
};

use tower_lsp::{
    lsp_types::{
        DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams,
        DidSaveTextDocumentParams, Hover, HoverParams, InitializeParams,
        InitializeResult, InitializedParams, MessageType,
        SemanticTokens, SemanticTokensParams, SemanticTokensResult, ServerInfo, Url,
        WillSaveTextDocumentParams,
    },
    Client,
};

mod capabilities;
mod linter;
mod wit;

use linter::Linter;
use wit::File;

pub struct Handler {
    client: Client,
}

impl Handler {
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    pub async fn initialize(&self, params: &InitializeParams) -> InitializeResult {
        let _ = params;
        InitializeResult {
            capabilities: capabilities::server_capabilities(),
            server_info: Some(ServerInfo {
                name: env!("CARGO_PKG_NAME").to_owned(),
                version: Some(env!("CARGO_PKG_VERSION").to_owned()),
            }),
        }
    }

    pub async fn initialized(&self, params: InitializedParams) {
        let _ = params;
        self.client
            .log_message(MessageType::LOG, "Wit LSP initialized")
            .await;
    }

    pub async fn did_open(&self, params: DidOpenTextDocumentParams) {
        self.client
            .log_message(
                MessageType::LOG,
                format!("Opened {}", params.text_document.uri),
            )
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn did_close(&self, params: DidCloseTextDocumentParams) {
        self.client
            .log_message(
                MessageType::LOG,
                format!("Closed {}", params.text_document.uri),
            )
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn did_change(&self, params: DidChangeTextDocumentParams) {
        self.client
            .log_message(
                MessageType::LOG,
                format!("Changed {}", params.text_document.uri),
            )
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn did_save(&self, params: DidSaveTextDocumentParams) {
        self.client
            .log_message(
                MessageType::LOG,
                format!("Saved {}", params.text_document.uri),
            )
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn will_save(&self, params: WillSaveTextDocumentParams) {
        self.client
            .log_message(
                MessageType::LOG,
                format!("Will save {}", params.text_document.uri),
            )
            .await;

        self.lint(params.text_document.uri).await;
    }

    pub async fn hover(&self, params: HoverParams) -> Option<Hover> {
        let uri = params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;


        if let Ok(wit) = self.read_file(uri).await {
            wit.hover_at(position)
        } else {
            None
        }
    }

    pub async fn semantic_tokens_full(&self, params: SemanticTokensParams) -> SemanticTokensResult {
        if let Ok(wit) = self.read_file(params.text_document.uri).await {
            return SemanticTokensResult::Tokens(wit.semantic_tokens());
        }

        SemanticTokensResult::Tokens(SemanticTokens {
            result_id: None,
            data: Vec::new(),
        })
    }

    async fn lint(&self, url: Url) {
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

    pub async fn read_file(&self, uri: Url) -> std::io::Result<File> {
        let path = Path::new(uri.path());
        let text = tokio::fs::read_to_string(path).await?;
        Ok(File::new(text))
    }
}




