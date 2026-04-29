use crate::core::error::{AppError, Result};
use crate::models::document::Document;
use chrono::Utc;
use std::path::PathBuf;
use uuid::Uuid;

pub struct FileService {
    upload_dir: PathBuf,
    max_file_size: u64,
    allowed_extensions: Vec<String>,
}

impl FileService {
    pub fn new(upload_dir: PathBuf, max_file_size: u64, allowed_extensions: Vec<String>) -> Self {
        Self {
            upload_dir,
            max_file_size,
            allowed_extensions,
        }
    }

    pub fn validate_file(&self, filename: &str, size: u64) -> Result<()> {
        if size > self.max_file_size {
            return Err(AppError::FileUploadError(format!(
                "文件大小超过限制: 最大 {} MB",
                self.max_file_size / (1024 * 1024)
            )));
        }

        let extension = filename
            .split('.')
            .last()
            .unwrap_or("")
            .to_lowercase();

        if !self.allowed_extensions.contains(&extension) {
            return Err(AppError::FileUploadError(format!(
                "不支持的文件格式: {}. 支持的格式: {:?}",
                extension, self.allowed_extensions
            )));
        }

        Ok(())
    }

    pub fn generate_filename(&self, original_name: &str) -> (String, String) {
        let id = Uuid::new_v4();
        let extension = original_name
            .split('.')
            .last()
            .unwrap_or("")
            .to_lowercase();
        let storage_name = if extension.is_empty() {
            id.to_string()
        } else {
            format!("{}.{}", id, extension)
        };
        (storage_name, id.to_string())
    }

    pub fn get_file_path(&self, storage_name: &str) -> PathBuf {
        self.upload_dir.join(storage_name)
    }

    pub fn create_document(
        &self,
        original_name: String,
        storage_name: String,
        file_size: u64,
        content_type: String,
    ) -> Document {
        let now = Utc::now();
        let id = Uuid::new_v4();

        Document {
            id,
            filename: storage_name.clone(),
            original_name,
            file_path: self.get_file_path(&storage_name).to_string_lossy().to_string(),
            file_size,
            content_type,
            created_at: now,
        }
    }

    pub fn delete_file(&self, storage_name: &str) -> Result<()> {
        let path = self.get_file_path(storage_name);
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        Ok(())
    }
}
