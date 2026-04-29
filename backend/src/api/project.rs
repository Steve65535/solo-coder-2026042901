use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::core::app_state::AppState;
use crate::core::error::{AppError, Result};
use crate::models::project::{CreateProjectRequest, Project, ProjectListResponse, UpdateProjectRequest};

pub async fn create_project(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateProjectRequest>,
) -> Json<Project> {
    let project_id = Uuid::new_v4();
    let now = Utc::now();
    
    let project = Project {
        id: project_id,
        name: req.name,
        description: req.description,
        created_at: now,
        updated_at: now,
    };

    let mut projects = state.projects.write().await;
    projects.insert(project_id, project.clone());

    Json(project)
}

pub async fn get_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>> {
    let projects = state.projects.read().await;
    
    projects
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or_else(|| AppError::ProjectNotFound(format!("项目 {} 不存在", id)))
}

pub async fn list_projects(State(state): State<Arc<AppState>>) -> Json<ProjectListResponse> {
    let projects = state.projects.read().await;
    
    let mut project_list: Vec<Project> = projects.values().cloned().collect();
    project_list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    let total = project_list.len();

    Json(ProjectListResponse {
        projects: project_list,
        total,
    })
}

pub async fn update_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateProjectRequest>,
) -> Result<Json<Project>> {
    let mut projects = state.projects.write().await;
    
    let project = projects
        .get_mut(&id)
        .ok_or_else(|| AppError::ProjectNotFound(format!("项目 {} 不存在", id)))?;
    
    if let Some(name) = req.name {
        project.name = name;
    }
    
    if let Some(description) = req.description {
        project.description = Some(description);
    }
    
    project.updated_at = Utc::now();

    Ok(Json(project.clone()))
}

pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<()> {
    {
        let projects = state.projects.read().await;
        if !projects.contains_key(&id) {
            return Err(AppError::ProjectNotFound(format!("项目 {} 不存在", id)));
        }
    }

    {
        let mut projects = state.projects.write().await;
        projects.remove(&id);
    }

    {
        let mut sessions = state.sessions.write().await;
        let sessions_to_remove: Vec<Uuid> = sessions
            .values()
            .filter(|s| s.project_id == id)
            .map(|s| s.id)
            .collect();
        
        for session_id in sessions_to_remove {
            sessions.remove(&session_id);
            
            let mut history = state.chat_history.write().await;
            history.remove(&session_id);
        }
    }

    {
        let mut documents = state.documents.write().await;
        let docs_to_remove: Vec<Uuid> = documents
            .values()
            .filter(|d| d.project_id == id)
            .map(|d| d.id)
            .collect();
        
        for doc_id in docs_to_remove {
            documents.remove(&doc_id);
            
            let mut chunks = state.chunks.write().await;
            let chunks_to_remove: Vec<Uuid> = chunks
                .values()
                .filter(|c| {
                    documents
                        .get(&c.document_id)
                        .map(|d| d.project_id == id)
                        .unwrap_or(false)
                })
                .map(|c| c.id)
                .collect();
            
            for chunk_id in chunks_to_remove {
                chunks.remove(&chunk_id);
            }
        }
    }

    Ok(())
}
