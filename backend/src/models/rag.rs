use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievalResult {
    pub chunk_id: Uuid,
    pub document_id: Uuid,
    pub content: String,
    pub semantic_score: f32,
    pub keyword_score: f32,
    pub final_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchQuery {
    pub query_text: String,
    pub query_vector: Vec<f32>,
    pub top_k: usize,
    pub semantic_weight: f32,
    pub keyword_weight: f32,
}
