use crate::core::error::{AppError, Result};

pub struct Vectorizer {
    vector_dim: usize,
}

impl Vectorizer {
    pub fn new(dim: usize) -> Self {
        Self { vector_dim: dim }
    }

    pub fn vectorize(&self, text: &str) -> Result<Vec<f32>> {
        let tokens: Vec<String> = text
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.chars().filter(|c| c.is_alphanumeric()).collect())
            .filter(|s: &String| !s.is_empty())
            .collect();

        if tokens.is_empty() {
            return Ok(vec![0.0; self.vector_dim]);
        }

        let mut vector = vec![0.0; self.vector_dim];
        
        for (i, token) in tokens.iter().enumerate() {
            let hash = self.simple_hash(token);
            let pos = (hash as usize) % self.vector_dim;
            let weight = 1.0 / ((i + 1) as f32).sqrt();
            
            vector[pos] += weight;
            
            let pos2 = ((hash as usize + 17) % self.vector_dim);
            vector[pos2] += weight * 0.5;
        }

        let norm = self.l2_norm(&vector);
        if norm > 0.0 {
            for v in &mut vector {
                *v /= norm;
            }
        }

        Ok(vector)
    }

    fn simple_hash(&self, s: &str) -> u64 {
        let mut hash: u64 = 5381;
        for byte in s.bytes() {
            hash = ((hash << 5) + hash) + byte as u64;
        }
        hash
    }

    fn l2_norm(&self, vec: &[f32]) -> f32 {
        vec.iter().map(|&x| x * x).sum::<f32>().sqrt()
    }

    pub fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> Result<f32> {
        if a.len() != b.len() {
            return Err(AppError::VectorError(format!(
                "向量维度不匹配: {} vs {}",
                a.len(),
                b.len()
            )));
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a = self.l2_norm(a);
        let norm_b = self.l2_norm(b);

        if norm_a == 0.0 || norm_b == 0.0 {
            return Ok(0.0);
        }

        let similarity = dot_product / (norm_a * norm_b);
        Ok(similarity.clamp(-1.0, 1.0))
    }

    pub fn vectorize_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        texts.iter().map(|t| self.vectorize(t)).collect()
    }
}
