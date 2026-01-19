-- Disable safe update mode temporarily
SET SQL_SAFE_UPDATES = 0;

-- Fix existing NULL or empty comments in emp_task_time table
UPDATE emp_task_time 
SET comment = 'No comment' 
WHERE comment IS NULL OR comment = '';

-- Add assignee_name column to task_assignees table
ALTER TABLE task_assignees 
ADD COLUMN IF NOT EXISTS assignee_name VARCHAR(255) AFTER assignee_id;

-- Optional: Update existing records with assignee names from tasks table
UPDATE task_assignees ta
INNER JOIN tasks t ON ta.task_id = t.task_id
SET ta.assignee_name = t.EmpName
WHERE ta.assignee_name IS NULL;

-- Re-enable safe update mode
SET SQL_SAFE_UPDATES = 1;
