use crate::core::error::{AppError, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub api_key: Option<String>,
    pub model: String,
    pub base_url: Option<String>,
    pub max_tokens: u32,
    pub temperature: f32,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            api_key: std::env::var("LLM_API_KEY").ok(),
            model: std::env::var("LLM_MODEL").unwrap_or_else(|_| "gpt-3.5-turbo".to_string()),
            base_url: std::env::var("LLM_BASE_URL").ok(),
            max_tokens: 1024,
            temperature: 0.7,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<Choice>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Choice {
    pub message: ChatMessage,
}

#[async_trait]
pub trait LlmService: Send + Sync {
    async fn chat(&self, messages: Vec<ChatMessage>) -> Result<String>;
    
    async fn generate_answer(
        &self,
        question: &str,
        context: Option<&[String]>,
        has_knowledge: bool,
    ) -> Result<String>;
}

pub struct OpenAiLlmService {
    client: reqwest::Client,
    config: LlmConfig,
}

impl OpenAiLlmService {
    pub fn new(config: LlmConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_default();
        
        Self { client, config }
    }
    
    fn get_base_url(&self) -> String {
        self.config.base_url.clone()
            .unwrap_or_else(|| "https://api.openai.com/v1".to_string())
    }
}

#[async_trait]
impl LlmService for OpenAiLlmService {
    async fn chat(&self, messages: Vec<ChatMessage>) -> Result<String> {
        let api_key = self.config.api_key.as_ref()
            .ok_or_else(|| AppError::InternalError("LLM API key not configured".to_string()))?;
        
        let base_url = self.get_base_url();
        let url = format!("{}/chat/completions", base_url);
        
        let request = ChatCompletionRequest {
            model: self.config.model.clone(),
            messages,
            max_tokens: Some(self.config.max_tokens),
            temperature: Some(self.config.temperature),
        };
        
        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::InternalError(format!("LLM request failed: {}", e)))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::InternalError(format!(
                "LLM API error ({}): {}",
                status, error_text
            )));
        }
        
        let completion: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to parse LLM response: {}", e)))?;
        
        completion.choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| AppError::InternalError("No response from LLM".to_string()))
    }
    
    async fn generate_answer(
        &self,
        question: &str,
        context: Option<&[String]>,
        has_knowledge: bool,
    ) -> Result<String> {
        let mut messages = Vec::new();
        
        let system_prompt = if has_knowledge && context.is_some_and(|c| !c.is_empty()) {
            r#"你是一个专业的问答助手。请根据用户提供的上下文信息回答问题。
如果上下文包含相关信息，请基于上下文回答。
如果上下文中没有相关信息，请诚实地说明你无法根据提供的知识库回答该问题。
请使用中文回答。"#.to_string()
        } else {
            r#"你是一个专业的问答助手。
注意：用户的问题在当前项目的知识库中没有找到相关内容。
请基于你的一般知识尝试回答问题，并在回答开头明确说明"在知识库中无对应内容"。
请使用中文回答。"#.to_string()
        };
        
        messages.push(ChatMessage {
            role: "system".to_string(),
            content: system_prompt,
        });
        
        if let Some(context) = context {
            if !context.is_empty() {
                let context_text = context.join("\n\n");
                messages.push(ChatMessage {
                    role: "user".to_string(),
                    content: format!("以下是相关上下文信息：\n\n{}\n\n请根据以上上下文回答这个问题：{}", context_text, question),
                });
            } else {
                messages.push(ChatMessage {
                    role: "user".to_string(),
                    content: question.to_string(),
                });
            }
        } else {
            messages.push(ChatMessage {
                role: "user".to_string(),
                content: question.to_string(),
            });
        }
        
        self.chat(messages).await
    }
}

pub struct MockLlmService;

#[async_trait]
impl LlmService for MockLlmService {
    async fn chat(&self, _messages: Vec<ChatMessage>) -> Result<String> {
        Ok("这是一个模拟的LLM响应。请配置LLM API key以启用真实的LLM服务。".to_string())
    }
    
    async fn generate_answer(
        &self,
        question: &str,
        context: Option<&[String]>,
        has_knowledge: bool,
    ) -> Result<String> {
        if !has_knowledge || context.is_none() || context.unwrap().is_empty() {
            Ok(format!(
                "在知识库中无对应内容。\n\n关于\"{}\"，这是一个模拟的回答。\n\n请配置以下环境变量以启用真实的LLM服务：\n- LLM_API_KEY: 你的API密钥\n- LLM_MODEL: 模型名称（默认: gpt-3.5-turbo）\n- LLM_BASE_URL: API基础URL（可选，用于兼容OpenAI API的其他服务）",
                question
            ))
        } else {
            let context_text = context.unwrap().join("\n\n");
            Ok(format!(
                "关于\"{}\"，根据知识库中的信息：\n\n{}\n\n（这是一个模拟的回答，配置LLM API后将生成真实回答）",
                question, context_text
            ))
        }
    }
}

pub fn create_llm_service(config: LlmConfig) -> Box<dyn LlmService> {
    if config.api_key.is_some() {
        Box::new(OpenAiLlmService::new(config))
    } else {
        Box::new(MockLlmService)
    }
}
