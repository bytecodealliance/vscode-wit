use tower_lsp::{
    async_trait,
    jsonrpc::Result,
    lsp_types::{
        DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams,
        DidSaveTextDocumentParams, InitializeParams, InitializeResult, InitializedParams,
        WillSaveTextDocumentParams, HoverParams, Hover
    },
    Client, LanguageServer,
};

mod handler;
use handler::Handler;

pub struct WitLsp {
    handler: Handler,
}

impl WitLsp {
    #[must_use]
    pub fn new(client: Client) -> Self {
        Self {
            handler: Handler::new(client),
        }
    }
}

#[async_trait]
impl LanguageServer for WitLsp {
    async fn initialize(&self, params: InitializeParams) -> Result<InitializeResult> {
        Ok(self.handler.initialize(&params).await)
    }

    async fn initialized(&self, params: InitializedParams) {
        self.handler.initialized(params).await;
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        self.handler.did_open(params).await;
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        self.handler.did_close(params).await;
    }

    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        self.handler.did_change(params).await;
    }

    async fn did_save(&self, params: DidSaveTextDocumentParams) {
        self.handler.did_save(params).await;
    }

    async fn will_save(&self, params: WillSaveTextDocumentParams) {
        self.handler.will_save(params).await;
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        Ok(Some(self.handler.hover(params).await))
    }

    async fn shutdown(&self) -> Result<()> {
        self.handler.shutdown().await;
        Ok(())
    }
}
