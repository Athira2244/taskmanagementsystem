-- Add assignee_name column to task_assignees table
ALTER TABLE task_assignees 
ADD COLUMN assignee_name VARCHAR(255) AFTER assignee_id;

-- Optional: Update existing records with assignee names from tasks table
-- This is useful if you already have data in task_assignees
UPDATE task_assignees ta
INNER JOIN tasks t ON ta.task_id = t.task_id
SET ta.assignee_name = t.EmpName
WHERE ta.assignee_name IS NULL;
