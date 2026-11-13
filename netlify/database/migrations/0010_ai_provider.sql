ALTER TABLE ai_settings ADD COLUMN provider text NOT NULL DEFAULT 'gemini'
 CHECK(provider IN ('gemini','openai','anthropic'));
