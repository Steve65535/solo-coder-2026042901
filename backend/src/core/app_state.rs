use std::sync::Arc;
use tokio::sync::RwLock;
use crate::models::{Session, Document, ChatMessage, Chunk};
use crate::core::config::Config;

pub struct AppState {
    pub config: Config,
    pub sessions: RwLock<std::collections::HashMap<uuid::Uuid, Session>>,
    pub documents: RwLock<std::collections::HashMap<uuid::Uuid, Document>>,
    pub chunks: RwLock<std::collections::HashMap<uuid::Uuid, Chunk>>,
    pub chat_history: RwLock<std::collections::HashMap<uuid::Uuid, Vec<ChatMessage>>>,
}

impl AppState {
    pub async fn new() -> Arc<Self> {
        let config = Config::new();
        
        std::fs::create_dir_all(&config.upload_dir).ok();

        Arc::new(Self {
            config,
            sessions: RwLock::new(std::collections::HashMap::new()),
            documents: RwLock::new(std::collections::HashMap::new()),
            chunks: RwLock::new(std::collections::HashMap::new()),
            chat_history: RwLock::new(std::collections::HashMap::new()),
        })
    }
}
