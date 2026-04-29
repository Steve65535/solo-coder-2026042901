use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("文件上传错误: {0}")]
    FileUploadError(String),

    #[error("文件不存在: {0}")]
    FileNotFound(String),

    #[error("会话不存在: {0}")]
    SessionNotFound(String),

    #[error("项目不存在: {0}")]
    ProjectNotFound(String),

    #[error("RAG检索错误: {0}")]
    RagError(String),

    #[error("向量计算错误: {0}")]
    VectorError(String),

    #[error("解析错误: {0}")]
    ParseError(String),

    #[error("IO错误: {0}")]
    IoError(#[from] std::io::Error),

    #[error("内部错误: {0}")]
    InternalError(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::FileNotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::SessionNotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::ProjectNotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::FileUploadError(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::ParseError(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };

        let body = Json(ErrorResponse {
            error: status.canonical_reason().unwrap_or("Error").to_string(),
            message,
        });

        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
