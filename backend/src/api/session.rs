use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::core::app_state::AppState;
use crate::core::error::{AppError, Result};
use crate::models::session::{CreateSessionRequest, Session, SessionListResponse};

pub async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<Session>> {
    {
        let projects = state.projects.read().await;
        if !projects.contains_key(&req.project_id) {
            return Err(AppError::ProjectNotFound(format!("项目 {} 不存在", req.project_id)));
        }
    }

    let session_id = Uuid::new_v4();
    let now = Utc::now();
    
    let session = Session {
        id: session_id,
        project_id: req.project_id,
        title: req.title.unwrap_or_else(|| format!("对话 {}", session_id.to_string().split('-').next().unwrap_or(""))),
        created_at: now,
        updated_at: now,
    };

    let mut sessions = state.sessions.write().await;
    sessions.insert(session_id, session.clone());
    
    let mut history = state.chat_history.write().await;
    history.insert(session_id, Vec::new());

    Ok(Json(session))
}

pub async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Session>> {
    let sessions = state.sessions.read().await;
    
    sessions
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or_else(|| AppError::SessionNotFound(format!("会话 {} 不存在", id)))
}

pub async fn list_sessions(
    State(state): State<Arc<AppState>>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<SessionListResponse>> {
    {
        let projects = state.projects.read().await;
        if !projects.contains_key(&project_id) {
            return Err(AppError::ProjectNotFound(format!("项目 {} 不存在", project_id)));
        }
    }

    let sessions = state.sessions.read().await;
    
    let mut session_list: Vec<Session> = sessions
        .values()
        .filter(|s| s.project_id == project_id)
        .cloned()
        .collect();
    session_list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    let total = session_list.len();

    Ok(Json(SessionListResponse {
        sessions: session_list,
        total,
    }))
}

pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<()> {
    let mut sessions = state.sessions.write().await;
    
    if sessions.remove(&id).is_none() {
        return Err(AppError::SessionNotFound(format!("会话 {} 不存在", id)));
    }

    let mut history = state.chat_history.write().await;
    history.remove(&id);

    Ok(())
}
