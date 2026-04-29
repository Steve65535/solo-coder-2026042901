use crate::services::llm_service::LlmConfig;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub upload_dir: PathBuf,
    pub vector_dim: usize,
    pub max_file_size: u64,
    pub supported_extensions: Vec<String>,
    pub llm: LlmConfig,
}

impl Config {
    pub fn new() -> Self {
        Self {
            upload_dir: PathBuf::from("../uploads"),
            vector_dim: 128,
            max_file_size: 50 * 1024 * 1024,
            supported_extensions: vec![
                "pdf".to_string(),
                "txt".to_string(),
                "md".to_string(),
                "docx".to_string(),
                "doc".to_string(),
            ],
            llm: LlmConfig::default(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self::new()
    }
}
