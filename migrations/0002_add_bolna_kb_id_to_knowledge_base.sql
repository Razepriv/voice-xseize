-- Migration: Add bolna_kb_id to knowledge_base
ALTER TABLE knowledge_base ADD COLUMN bolna_kb_id VARCHAR;
