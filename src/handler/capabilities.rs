use tower_lsp::lsp_types::{
    SemanticTokensFullOptions,
    SemanticTokensOptions, SemanticTokensServerCapabilities, ServerCapabilities,
    TextDocumentSyncCapability, TextDocumentSyncKind, HoverProviderCapability, HoverOptions, WorkDoneProgressOptions,
};

use super::wit;

pub fn server_capabilities() -> ServerCapabilities {
    ServerCapabilities {
        text_document_sync: Some(TextDocumentSyncCapability::Kind(TextDocumentSyncKind::FULL)),
        hover_provider: Some(HoverProviderCapability::Options(HoverOptions {
            work_done_progress_options: WorkDoneProgressOptions {
                work_done_progress: Some(false),
            }
        })),
        semantic_tokens_provider: Some(SemanticTokensServerCapabilities::SemanticTokensOptions(
            SemanticTokensOptions {
                work_done_progress_options: Default::default(),
                legend: wit::token::legend(),
                full: Some(SemanticTokensFullOptions::Delta {
                    delta: Some(false),
                }),
                range: None,
            },
        )),
        ..ServerCapabilities::default()
    }
}