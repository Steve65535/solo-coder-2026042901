use crate::core::error::{AppError, Result};
use crate::models::rag::{HybridSearchQuery, RetrievalResult};
use crate::models::document::Chunk;
use crate::services::text_processor::TextProcessor;
use crate::services::vectorizer::Vectorizer;
use std::collections::{HashMap, HashSet};

pub struct RagEngine {
    vectorizer: Vectorizer,
    text_processor: TextProcessor,
    idf: HashMap<String, f32>,
}

impl RagEngine {
    pub fn new(vector_dim: usize) -> Self {
        Self {
            vectorizer: Vectorizer::new(vector_dim),
            text_processor: TextProcessor::new(),
            idf: HashMap::new(),
        }
    }

    pub fn process_document(&mut self, content: &str) -> Result<Vec<(String, Vec<f32>)>> {
        let chunks = self.text_processor.split_into_chunks(content, 512, 64);
        
        let mut chunk_vectors = Vec::new();
        for chunk in &chunks {
            let vector = self.vectorizer.vectorize(chunk)?;
            chunk_vectors.push((chunk.clone(), vector));
        }

        self.update_idf(&chunks);

        Ok(chunk_vectors)
    }

    fn update_idf(&mut self, chunks: &[String]) {
        let total_docs = chunks.len() as f32;
        
        for chunk in chunks {
            let tokens = self.text_processor.tokenize(chunk);
            let unique_tokens: HashSet<_> = tokens.into_iter().collect();
            
            for token in unique_tokens {
                *self.idf.entry(token).or_insert(0.0) += 1.0;
            }
        }

        for count in self.idf.values_mut() {
            *count = ((total_docs + 1.0) / (*count + 1.0)).ln() + 1.0;
        }
    }

    pub fn hybrid_search(
        &self,
        query: &HybridSearchQuery,
        chunks: &[Chunk],
    ) -> Result<Vec<RetrievalResult>> {
        let semantic_results = self.semantic_search(&query.query_vector, chunks, query.top_k * 2)?;
        let keyword_results = self.keyword_search(&query.query_text, chunks, query.top_k * 2)?;

        let merged = self.merge_results(semantic_results, keyword_results, query.semantic_weight, query.keyword_weight);

        let mut ranked: Vec<_> = merged.into_iter().collect();
        ranked.sort_by(|a, b| b.1.final_score.partial_cmp(&a.1.final_score).unwrap_or(std::cmp::Ordering::Equal));

        let results: Vec<RetrievalResult> = ranked
            .into_iter()
            .take(query.top_k)
            .map(|(_chunk_id, info)| info)
            .collect();

        Ok(results)
    }

    fn semantic_search(
        &self,
        query_vector: &[f32],
        chunks: &[Chunk],
        top_k: usize,
    ) -> Result<HashMap<uuid::Uuid, f32>> {
        let mut scores = Vec::new();

        for chunk in chunks {
            let similarity = self.vectorizer.cosine_similarity(query_vector, &chunk.vector)?;
            scores.push((chunk.id, similarity));
        }

        scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let results: HashMap<_, _> = scores.into_iter().take(top_k).collect();
        Ok(results)
    }

    fn keyword_search(
        &self,
        query_text: &str,
        chunks: &[Chunk],
        top_k: usize,
    ) -> Result<HashMap<uuid::Uuid, f32>> {
        let query_tokens = self.text_processor.tokenize(query_text);
        let query_tf = self.text_processor.compute_tf(query_text);

        let mut scores = Vec::new();

        for chunk in chunks {
            let chunk_tokens = self.text_processor.tokenize(&chunk.content);
            let chunk_tf = self.text_processor.compute_tf(&chunk.content);

            let mut score = 0.0;
            let mut common_terms = 0;

            for token in &query_tokens {
                if let Some(chunk_tf_val) = chunk_tf.get(token) {
                    let idf = self.idf.get(token).copied().unwrap_or(1.0);
                    let query_tf_val = query_tf.get(token).copied().unwrap_or(0.0);
                    
                    score += chunk_tf_val * query_tf_val * idf;
                    common_terms += 1;
                }
            }

            let query_token_set: HashSet<_> = query_tokens.iter().collect();
            let chunk_token_set: HashSet<_> = chunk_tokens.iter().collect();
            let intersection: HashSet<_> = query_token_set.intersection(&chunk_token_set).collect();
            let union: HashSet<_> = query_token_set.union(&chunk_token_set).collect();

            let jaccard = if union.is_empty() {
                0.0
            } else {
                intersection.len() as f32 / union.len() as f32
            };

            let final_score = if common_terms > 0 {
                (score * 0.6) + (jaccard * 0.4)
            } else {
                jaccard
            };

            scores.push((chunk.id, final_score));
        }

        scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let results: HashMap<_, _> = scores.into_iter().take(top_k).collect();
        Ok(results)
    }

    fn merge_results(
        &self,
        semantic: HashMap<uuid::Uuid, f32>,
        keyword: HashMap<uuid::Uuid, f32>,
        semantic_weight: f32,
        keyword_weight: f32,
    ) -> HashMap<uuid::Uuid, RetrievalResult> {
        let all_ids: HashSet<uuid::Uuid> = semantic.keys().chain(keyword.keys()).cloned().collect();

        let mut merged = HashMap::new();

        for id in all_ids {
            let semantic_score = semantic.get(&id).copied().unwrap_or(0.0);
            let keyword_score = keyword.get(&id).copied().unwrap_or(0.0);

            let total_weight = semantic_weight + keyword_weight;
            let final_score = if total_weight > 0.0 {
                (semantic_score * semantic_weight + keyword_score * keyword_weight) / total_weight
            } else {
                (semantic_score + keyword_score) / 2.0
            };

            merged.insert(
                id,
                RetrievalResult {
                    chunk_id: id,
                    document_id: uuid::Uuid::nil(),
                    content: String::new(),
                    semantic_score,
                    keyword_score,
                    final_score,
                },
            );
        }

        merged
    }

    pub fn rerank(
        &self,
        query: &str,
        results: &mut [RetrievalResult],
        chunks: &[Chunk],
    ) -> Result<()> {
        let query_tokens: HashSet<_> = self.text_processor.tokenize(query).into_iter().collect();

        for result in results.iter_mut() {
            let chunk = chunks
                .iter()
                .find(|c| c.id == result.chunk_id)
                .ok_or_else(|| AppError::RagError(format!("Chunk {} not found", result.chunk_id)))?;

            let chunk_tokens: HashSet<_> = self.text_processor.tokenize(&chunk.content).into_iter().collect();
            
            let overlap = query_tokens.intersection(&chunk_tokens).count();
            let coverage = if query_tokens.is_empty() {
                0.0
            } else {
                overlap as f32 / query_tokens.len() as f32
            };

            let query_len = query.len() as f32;
            let chunk_len = chunk.content.len() as f32;
            let length_factor = 1.0 - (query_len - chunk_len).abs() / (query_len + chunk_len).max(1.0);

            let has_exact_match = chunk.content.to_lowercase().contains(&query.to_lowercase());
            let exact_match_bonus = if has_exact_match { 0.3 } else { 0.0 };

            let rerank_score = result.final_score * 0.6 
                + coverage * 0.2 
                + length_factor * 0.1 
                + exact_match_bonus;

            result.final_score = rerank_score;
            result.content = chunk.content.clone();
            result.document_id = chunk.document_id;
        }

        results.sort_by(|a, b| b.final_score.partial_cmp(&a.final_score).unwrap_or(std::cmp::Ordering::Equal));

        Ok(())
    }

    pub fn vectorize(&self, text: &str) -> Result<Vec<f32>> {
        self.vectorizer.vectorize(text)
    }
}
