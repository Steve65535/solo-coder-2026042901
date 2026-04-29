use crate::services::llm_service::{create_llm_service, LlmService};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::models::{Project, Session, Document, ChatMessage, Chunk};
use crate::core::config::Config;

pub struct AppState {
    pub config: Config,
    pub projects: RwLock<std::collections::HashMap<uuid::Uuid, Project>>,
    pub sessions: RwLock<std::collections::HashMap<uuid::Uuid, Session>>,
    pub documents: RwLock<std::collections::HashMap<uuid::Uuid, Document>>,
    pub chunks: RwLock<std::collections::HashMap<uuid::Uuid, Chunk>>,
    pub chat_history: RwLock<std::collections::HashMap<uuid::Uuid, Vec<ChatMessage>>>,
    pub llm_service: Box<dyn LlmService>,
}

impl AppState {
    pub async fn new() -> Arc<Self> {
        let config = Config::new();
        
        std::fs::create_dir_all(&config.upload_dir).ok();

        let llm_service = create_llm_service(config.llm.clone());

        let state = Arc::new(Self {
            config,
            projects: RwLock::new(std::collections::HashMap::new()),
            sessions: RwLock::new(std::collections::HashMap::new()),
            documents: RwLock::new(std::collections::HashMap::new()),
            chunks: RwLock::new(std::collections::HashMap::new()),
            chat_history: RwLock::new(std::collections::HashMap::new()),
            llm_service,
        });

        let default_project = Project {
            id: uuid::Uuid::new_v4(),
            name: "默认项目".to_string(),
            description: Some("系统自动创建的默认项目".to_string()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let mut projects = state.projects.write().await;
        projects.insert(default_project.id, default_project);
        drop(projects);

        state
    }
}
