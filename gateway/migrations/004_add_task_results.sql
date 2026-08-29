-- 004_add_task_results.sql
-- Add summary and result columns to agent_tasks table

ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS result JSONB DEFAULT '{}';

-- Index for better searching if needed later
CREATE INDEX IF NOT EXISTS idx_agent_tasks_summary ON agent_tasks USING gin(to_tsvector('english', summary)) WHERE summary IS NOT NULL;
