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

    let answer = generate_answer(&req.question, &context_text, &context_chunks);

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

fn generate_answer(
    question: &str,
    context_texts: &[String],
    context_chunks: &[ContextChunk],
) -> String {
    if context_texts.is_empty() {
        return format!(
            "抱歉，我在当前项目的知识库中没有找到与\"{}\"相关的内容。请先上传相关文档到该项目。",
            question
        );
    }

    let has_relevant = context_chunks
        .iter()
        .any(|c| c.score > 0.1);

    if !has_relevant {
        return format!(
            "根据当前项目已上传的文档，我没有找到与\"{}\"高度相关的内容。以下是一些可能相关的信息：\n\n{}",
            question,
            context_texts
                .iter()
                .take(2)
                .map(|t| format!("- {}\n", t))
                .collect::<Vec<_>>()
                .join("")
        );
    }

    let source_docs: Vec<String> = context_chunks
        .iter()
        .map(|c| c.document_name.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    let relevant_chunks: Vec<&ContextChunk> = context_chunks
        .iter()
        .filter(|c| c.score > 0.15)
        .collect();

    if relevant_chunks.is_empty() {
        return format!(
            "关于\"{}\"，我在当前项目的以下文档中找到了一些相关信息：\n\n来源: {}\n\n{}",
            question,
            source_docs.join(", "),
            context_chunks
                .iter()
                .take(3)
                .map(|c| format!("[来自 {}]: {}\n\n", c.document_name, c.content))
                .collect::<Vec<_>>()
                .join("")
        );
    }

    let main_answer = relevant_chunks
        .iter()
        .take(2)
        .map(|c| c.content.clone())
        .collect::<Vec<_>>()
        .join("\n\n");

    let mut answer = format!("关于\"{}\"，根据当前项目知识库中的信息：\n\n{}\n\n", question, main_answer);

    if relevant_chunks.len() > 2 {
        answer.push_str("\n更多相关信息：\n");
        for chunk in relevant_chunks.iter().skip(2).take(2) {
            let snippet = chunk.content.chars().take(100).collect::<String>();
            answer.push_str(&format!("- [{}] {}{}\n", 
                chunk.document_name,
                snippet,
                if chunk.content.len() > 100 { "..." } else { "" }
            ));
        }
    }

    answer.push_str(&format!("\n参考来源: {}", source_docs.join(", ")));

    answer
}
