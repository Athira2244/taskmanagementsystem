CREATE TABLE checklist_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_by INT
);

CREATE TABLE checklist_template_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    item_text TEXT,
    FOREIGN KEY (template_id) REFERENCES checklist_templates(id) ON DELETE CASCADE
);

CREATE TABLE task_checklist_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    item_text TEXT,
    is_completed TINYINT(1) DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);
