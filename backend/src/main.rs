use axum::{
    routing::{delete, get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod core;
mod models;
mod services;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "smart_qa_backend=debug,tower_http=debug,axum::rejection=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = core::app_state::AppState::new().await;

    let cors = CorsLayer::new()
        .allow_methods(Any)
        .allow_origin(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(api::health::health_check))
        .route("/api/sessions", post(api::session::create_session))
        .route("/api/sessions/:id", get(api::session::get_session))
        .route("/api/sessions", get(api::session::list_sessions))
        .route("/api/sessions/:id", delete(api::session::delete_session))
        .route("/api/files/upload", post(api::file::upload_file))
        .route("/api/files", get(api::file::list_files))
        .route("/api/files/:id", delete(api::file::delete_file))
        .route("/api/qa/ask", post(api::qa::ask_question))
        .route("/api/qa/history/:session_id", get(api::qa::get_history))
        .with_state(state)
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    tracing::info!("server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
