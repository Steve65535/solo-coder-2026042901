use std::collections::HashSet;
use std::path::Path;
use crate::core::error::{AppError, Result};

pub struct TextProcessor {
    stop_words: HashSet<String>,
}

impl Default for TextProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl TextProcessor {
    pub fn new() -> Self {
        let stop_words = [
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "up", "about", "into", "through", "during",
            "before", "after", "above", "below", "between", "under", "again",
            "further", "then", "once", "here", "there", "when", "where", "why",
            "how", "all", "each", "few", "more", "most", "other", "some", "such",
            "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
            "s", "t", "just", "don", "now", "is", "are", "was", "were", "be",
            "been", "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "must", "shall", "can",
            "need", "dare", "ought", "used", "这", "那", "的", "是", "在", "了",
            "和", "与", "或", "但", "而", "也", "都", "就", "才", "已", "很",
            "太", "更", "最", "还", "又", "再", "也", "不", "没", "无", "非",
            "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百",
            "千", "万", "亿", "个", "只", "件", "条", "种", "类", "些", "每",
            "各", "某", "此", "彼", "之", "其", "以", "为", "因", "由", "于",
            "从", "自", "向", "往", "到", "至", "及", "跟", "同", "比", "像",
            "如", "似", "若", "如", "等", "等等", "之类", "等等", "等等等",
        ]
        .iter()
        .map(|&s| s.to_string())
        .collect();

        Self { stop_words }
    }

    pub fn read_file_content(&self, path: &Path) -> Result<String> {
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "txt" | "md" => self.read_text_file(path),
            "pdf" => self.read_pdf_file(path),
            "docx" | "doc" => self.read_docx_file(path),
            _ => Err(AppError::FileUploadError(format!(
                "不支持的文件格式: {}",
                extension
            ))),
        }
    }

    fn read_text_file(&self, path: &Path) -> Result<String> {
        let content = std::fs::read_to_string(path)?;
        Ok(content)
    }

    fn read_pdf_file(&self, _path: &Path) -> Result<String> {
        Err(AppError::ParseError(
            "PDF解析需要额外的依赖库，当前使用简化模式，请先将PDF转换为txt".to_string(),
        ))
    }

    fn read_docx_file(&self, _path: &Path) -> Result<String> {
        Err(AppError::ParseError(
            "DOCX解析需要额外的依赖库，当前使用简化模式，请先将DOCX转换为txt".to_string(),
        ))
    }

    pub fn split_into_chunks(
        &self,
        content: &str,
        chunk_size: usize,
        overlap: usize,
    ) -> Vec<String> {
        let mut chunks = Vec::new();
        let clean_content = self.clean_text(content);
        
        let chars: Vec<char> = clean_content.chars().collect();
        let mut start = 0;

        while start < chars.len() {
            let end = std::cmp::min(start + chunk_size, chars.len());
            
            let mut actual_end = end;
            if end < chars.len() {
                for i in (start..end).rev() {
                    if chars[i] == '.' || chars[i] == '。' || chars[i] == '\n' || chars[i] == '!' || chars[i] == '！' || chars[i] == '?' || chars[i] == '？' {
                        actual_end = i + 1;
                        break;
                    }
                }
            }

            let chunk: String = chars[start..actual_end].iter().collect();
            if !chunk.trim().is_empty() {
                chunks.push(chunk.trim().to_string());
            }

            start = if actual_end > overlap {
                actual_end - overlap
            } else {
                actual_end
            };

            if start == actual_end {
                start = actual_end;
            }
        }

        chunks
    }

    pub fn clean_text(&self, text: &str) -> String {
        let text = text.replace('\r', " ");
        let text = regex::Regex::new(r"\n{3,}")
            .unwrap()
            .replace_all(&text, "\n\n");
        let text = regex::Regex::new(r" {2,}")
            .unwrap()
            .replace_all(&text, " ");
        text.trim().to_string()
    }

    pub fn tokenize(&self, text: &str) -> Vec<String> {
        let re = regex::Regex::new(r"\p{L}+|\p{N}+").unwrap();
        re.find_iter(text)
            .map(|m| m.as_str().to_lowercase())
            .filter(|t| !self.stop_words.contains(t) && t.len() > 1)
            .collect()
    }

    pub fn compute_tf(&self, text: &str) -> std::collections::HashMap<String, f32> {
        let tokens = self.tokenize(text);
        let total_tokens = tokens.len() as f32;
        
        let mut tf = std::collections::HashMap::new();
        for token in tokens {
            *tf.entry(token).or_insert(0.0) += 1.0;
        }

        if total_tokens > 0.0 {
            for count in tf.values_mut() {
                *count /= total_tokens;
            }
        }

        tf
    }
}
