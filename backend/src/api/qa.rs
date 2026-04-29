use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::core::app_state::AppState;
use crate::core::error::{AppError, Result};
use crate::models::chat::{AskRequest, AskResponse, ChatMessage, ContextChunk, MessageRole};
use crate::models::document::Document;
use crate::models::rag::HybridSearchQuery;
use crate::services::rag_engine::RagEngine;

pub async fn ask_question(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AskRequest>,
) -> Result<Json<AskResponse>> {
    let session_id = req.session_id;

    let (project_id, session_exists) = {
        let sessions = state.sessions.read().await;
        let session = sessions.get(&session_id);
        (session.map(|s| s.project_id), session.is_some())
    };

    if !session_exists {
        return Err(AppError::SessionNotFound(format!("会话 {} 不存在", session_id)));
    }

    let project_id = project_id.unwrap();

    let (project_docs, project_chunks) = {
        let docs_store = state.documents.read().await;
        let chunks_store = state.chunks.read().await;
        
        let project_doc_ids: std::collections::HashSet<Uuid> = docs_store
            .values()
            .filter(|d| d.project_id == project_id)
            .map(|d| d.id)
            .collect();

        let project_docs: std::collections::HashMap<Uuid, Document> = docs_store
            .iter()
            .filter(|(_, d)| d.project_id == project_id)
            .map(|(id, d)| (*id, d.clone()))
            .collect();

        let project_chunks: Vec<_> = chunks_store
            .values()
            .filter(|c| project_doc_ids.contains(&c.document_id))
            .cloned()
            .collect();

        (project_docs, project_chunks)
    };

    let rag_engine = RagEngine::new(state.config.vector_dim);
    let query_vector = rag_engine.vectorize(&req.question)?;

    let search_query = HybridSearchQuery {
        query_text: req.question.clone(),
        query_vector: query_vector.clone(),
        top_k: 5,
        semantic_weight: 0.6,
        keyword_weight: 0.4,
    };

    let mut results = rag_engine.hybrid_search(&search_query, &project_chunks)?;
    rag_engine.rerank(&req.question, &mut results, &project_chunks)?;

    let context_chunks: Vec<ContextChunk> = results
        .iter()
        .map(|r| {
            let doc_name = project_docs
                .get(&r.document_id)
                .map(|d| d.original_name.clone())
                .unwrap_or_else(|| "未知文档".to_string());

            ContextChunk {
                chunk_id: r.chunk_id,
                document_id: r.document_id,
                document_name: doc_name,
                content: r.content.clone(),
                score: r.final_score,
            }
        })
        .collect();

    let context_text: Vec<String> = context_chunks
        .iter()
        .map(|c| format!("[{}]: {}", c.document_name, c.content))
        .collect();

    let has_relevant_knowledge = !context_chunks.is_empty() 
        && context_chunks.iter().any(|c| c.score > 0.1);

    let answer = if has_relevant_knowledge {
        state.llm_service
            .generate_answer(&req.question, Some(&context_text), true)
            .await?
    } else {
        state.llm_service
            .generate_answer(&req.question, if context_text.is_empty() { None } else { Some(&context_text) }, false)
            .await?
    };

    let now = Utc::now();

    let user_message = ChatMessage {
        id: Uuid::new_v4(),
        session_id,
        role: MessageRole::User,
        content: req.question.clone(),
        created_at: now,
        context_chunks: None,
    };

    let assistant_message = ChatMessage {
        id: Uuid::new_v4(),
        session_id,
        role: MessageRole::Assistant,
        content: answer.clone(),
        created_at: now,
        context_chunks: Some(context_chunks.clone()),
    };

    {
        let mut history = state.chat_history.write().await;
        let session_history = history.entry(session_id).or_insert_with(Vec::new);
        session_history.push(user_message);
        session_history.push(assistant_message.clone());
    }

    {
        let mut sessions = state.sessions.write().await;
        if let Some(session) = sessions.get_mut(&session_id) {
            session.updated_at = now;
            
            if session.title.starts_with("对话 ") {
                let first_sentence = req.question
                    .split(|c| c == '。' || c == '？' || c == '!' || c == '.' || c == '?')
                    .next()
                    .unwrap_or(&req.question)
                    .chars()
                    .take(30)
                    .collect::<String>();
                
                if !first_sentence.is_empty() {
                    session.title = first_sentence;
                }
            }
        }
    }

    Ok(Json(AskResponse {
        answer,
        context_chunks,
        message_id: assistant_message.id,
    }))
}

pub async fn get_history(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Vec<ChatMessage>>> {
    {
        let sessions = state.sessions.read().await;
        if !sessions.contains_key(&session_id) {
            return Err(AppError::SessionNotFound(format!("会话 {} 不存在", session_id)));
        }
    }

    let history = state.chat_history.read().await;
    let messages = history
        .get(&session_id)
        .cloned()
        .unwrap_or_default();

    Ok(Json(messages))
}
