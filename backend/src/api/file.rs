use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use axum::extract::Multipart;
use std::sync::Arc;
use uuid::Uuid;

use crate::core::app_state::AppState;
use crate::core::error::{AppError, Result};
use crate::models::document::{Document, DocumentListResponse, Chunk};
use crate::services::rag_engine::RagEngine;
use crate::services::file_service::FileService;
use crate::services::text_processor::TextProcessor;

#[derive(serde::Serialize)]
pub struct UploadResponse {
    pub document: Document,
    pub chunk_count: usize,
}

pub async fn upload_file(
    State(state): State<Arc<AppState>>,
    Path(project_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>> {
    {
        let projects = state.projects.read().await;
        if !projects.contains_key(&project_id) {
            return Err(AppError::ProjectNotFound(format!("项目 {} 不存在", project_id)));
        }
    }

    let file_service = FileService::new(
        state.config.upload_dir.clone(),
        state.config.max_file_size,
        state.config.supported_extensions.clone(),
    );

    let mut filename = None;
    let mut file_bytes = Vec::new();
    let mut content_type = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::FileUploadError(format!("解析上传数据失败: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();
        
        if name == "file" {
            filename = field.file_name().map(|s| s.to_string());
            content_type = field.content_type().map(|s| s.to_string());
            file_bytes = field.bytes().await.map_err(|e| {
                AppError::FileUploadError(format!("读取文件失败: {}", e))
            })?.to_vec();
        }
    }

    let original_name = filename.ok_or_else(|| {
        AppError::FileUploadError("未找到上传的文件".to_string())
    })?;

    file_service.validate_file(&original_name, file_bytes.len() as u64)?;

    let (storage_name, _id) = file_service.generate_filename(&original_name);
    let file_path = file_service.get_file_path(&storage_name);

    tokio::fs::write(&file_path, &file_bytes).await?;

    let content = String::from_utf8_lossy(&file_bytes).to_string();

    let text_processor = TextProcessor::new();
    let chunks = text_processor.split_into_chunks(&content, 512, 64);

    let mut rag_engine = RagEngine::new(state.config.vector_dim);
    let chunk_vectors = rag_engine.process_document(&content)?;

    let document = file_service.create_document(
        project_id,
        original_name.clone(),
        storage_name,
        file_bytes.len() as u64,
        content_type.unwrap_or_else(|| "text/plain".to_string()),
    );

    let doc_id = document.id;
    
    {
        let mut docs = state.documents.write().await;
        docs.insert(doc_id, document.clone());
    }

    {
        let mut chunks_store = state.chunks.write().await;
        for (i, (chunk_text, vector)) in chunk_vectors.iter().enumerate() {
            let chunk = Chunk {
                id: Uuid::new_v4(),
                document_id: doc_id,
                content: chunk_text.clone(),
                chunk_index: i,
                vector: vector.clone(),
            };
            chunks_store.insert(chunk.id, chunk);
        }
    }

    Ok(Json(UploadResponse {
        document,
        chunk_count: chunks.len(),
    }))
}

pub async fn list_files(
    State(state): State<Arc<AppState>>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<DocumentListResponse>> {
    {
        let projects = state.projects.read().await;
        if !projects.contains_key(&project_id) {
            return Err(AppError::ProjectNotFound(format!("项目 {} 不存在", project_id)));
        }
    }

    let docs = state.documents.read().await;
    
    let mut documents: Vec<Document> = docs
        .values()
        .filter(|d| d.project_id == project_id)
        .cloned()
        .collect();
    documents.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    let total = documents.len();

    Ok(Json(DocumentListResponse {
        documents,
        total,
    }))
}

pub async fn delete_file(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let file_service = FileService::new(
        state.config.upload_dir.clone(),
        state.config.max_file_size,
        state.config.supported_extensions.clone(),
    );

    let doc = {
        let docs = state.documents.read().await;
        docs.get(&id).cloned()
    };

    let doc = doc.ok_or_else(|| {
        AppError::FileNotFound(format!("文件 {} 不存在", id))
    })?;

    file_service.delete_file(&doc.filename)?;

    {
        let mut docs = state.documents.write().await;
        docs.remove(&id);
    }

    {
        let mut chunks = state.chunks.write().await;
        let chunks_to_remove: Vec<Uuid> = chunks
            .values()
            .filter(|c| c.document_id == id)
            .map(|c| c.id)
            .collect();
        
        for chunk_id in chunks_to_remove {
            chunks.remove(&chunk_id);
        }
    }

    Ok(StatusCode::NO_CONTENT)
}
