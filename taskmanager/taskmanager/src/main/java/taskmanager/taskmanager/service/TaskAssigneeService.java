package taskmanager.taskmanager.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import taskmanager.taskmanager.dto.TaskResponse;
import taskmanager.taskmanager.model.Task;
import taskmanager.taskmanager.model.TaskAssignee;
import taskmanager.taskmanager.repository.TaskAssigneeRepository;
import taskmanager.taskmanager.repository.TaskRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class TaskAssigneeService {

    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;

    public TaskAssigneeService(TaskRepository taskRepository, TaskAssigneeRepository taskAssigneeRepository) {
        this.taskRepository = taskRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
    }

    /**
     * Get all tasks for a specific assignee (from both tasks and task_assignees tables)
     */
    public List<TaskResponse> getTasksForAssignee(Integer assigneeId) {
        List<TaskResponse> result = new ArrayList<>();

        // 1. Get tasks from tasks table where is_assignee = 1 (never reassigned)
        List<Task> parentTasks = taskRepository.findByAssigneeIdAndIsAssignee(assigneeId, 1);
        for (Task task : parentTasks) {
            TaskResponse response = new TaskResponse();
            response.setId(task.getId());
            response.setTaskId(task.getId());
            response.setTaskName(task.getTaskName());
            response.setDescription(task.getDescription());
            response.setAssigneeId(task.getAssigneeId());
            response.setEmpName(task.getEmpName());
            System.out.println("DEBUG: Parent task ID " + task.getId() + ", EmpName from task: " + task.getEmpName());
            response.setDeadline(task.getDeadline());
            response.setStatus(task.getStatus());
            response.setAttachment(task.getAttachment());
            response.setSource("tasks");
            response.setIsAssignee(1);
            result.add(response);
        }

        // 2. Get tasks from task_assignees table where is_assignee = 1
        List<TaskAssignee> assignedTasks = taskAssigneeRepository.findByAssigneeIdAndIsAssignee(assigneeId, 1);
        for (TaskAssignee ta : assignedTasks) {
            // Get parent task details
            Optional<Task> parentTaskOpt = taskRepository.findById(ta.getTaskId());
            if (parentTaskOpt.isPresent()) {
                Task parentTask = parentTaskOpt.get();
                TaskResponse response = new TaskResponse();
                response.setId(ta.getId());
                response.setTaskId(ta.getTaskId());
                response.setTaskName(parentTask.getTaskName());
                response.setDescription(parentTask.getDescription());
                response.setAssigneeId(ta.getAssigneeId());
                response.setEmpName(ta.getAssigneeName()); // Use assigneeName from task_assignees
                System.out.println("DEBUG: Assigned task ID " + ta.getId() + ", assigneeName from ta: " + ta.getAssigneeName());
                response.setDeadline(parentTask.getDeadline());
                response.setStatus(ta.getStatus()); // Status from task_assignees
                response.setAttachment(parentTask.getAttachment());
                response.setSource("task_assignees");
                response.setIsAssignee(ta.getIsAssignee());
                result.add(response);
            }
        }

        return result;
    }

    /**
     * Handle task reassignment
     */
    @Transactional
    public TaskAssignee reassignTask(Long taskId, Integer newAssigneeId, String empName) {
        // Check if task exists in tasks table
        Task parentTask = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        // Check if reassigning back to the original assignee (in tasks table)
        boolean isReassignToOriginal = parentTask.getAssigneeId().equals(newAssigneeId);

        // Check if this is the first assignment or reassignment
        Optional<TaskAssignee> currentAssigneeOpt = taskAssigneeRepository.findByTaskIdAndIsAssignee(taskId, 1);

        if (isReassignToOriginal) {
            // Reassigning back to original assignee in tasks table
            if (currentAssigneeOpt.isPresent()) {
                // Deactivate current assignee in task_assignees
                taskAssigneeRepository.deactivateCurrentAssignee(taskId);
            }
            
            // Reactivate the original assignee in tasks table
            parentTask.setIsAssignee(1);
            taskRepository.save(parentTask);
            
            // Return null to indicate no new task_assignee record created
            return null;
        }

        // Normal reassignment flow (not back to original)
        if (currentAssigneeOpt.isPresent()) {
            // This is a reassignment - deactivate current assignee in task_assignees
            taskAssigneeRepository.deactivateCurrentAssignee(taskId);
        } else {
            // This is the first assignment - deactivate in tasks table
            parentTask.setIsAssignee(0);
            taskRepository.save(parentTask);
        }

        // Create new assignment in task_assignees
        TaskAssignee newAssignment = new TaskAssignee();
        newAssignment.setTaskId(taskId);
        newAssignment.setAssigneeId(newAssigneeId);
        newAssignment.setAssigneeName(empName); // Store the assignee name
        newAssignment.setStatus("PENDING");
        newAssignment.setIsAssignee(1);
        newAssignment.setAssignedAt(LocalDateTime.now());

        return taskAssigneeRepository.save(newAssignment);
    }

    /**
     * Update task status - handles both scenarios
     */
    @Transactional
    public void updateTaskStatus(Long taskId, Integer assigneeId, String newStatus) {
        // Check if task is in task_assignees (has been reassigned)
        Optional<TaskAssignee> taskAssigneeOpt = taskAssigneeRepository.findByTaskIdAndIsAssignee(taskId, 1);

        if (taskAssigneeOpt.isPresent()) {
            // Update status in task_assignees
            TaskAssignee taskAssignee = taskAssigneeOpt.get();
            taskAssignee.setStatus(newStatus);
            taskAssigneeRepository.save(taskAssignee);
        } else {
            // Update status in tasks table (never reassigned)
            Task task = taskRepository.findById(taskId)
                    .orElseThrow(() -> new RuntimeException("Task not found"));
            task.setStatus(newStatus);
            taskRepository.save(task);
        }
    }

    /**
     * Check if a task has been reassigned
     */
    public boolean isTaskReassigned(Long taskId) {
        return taskAssigneeRepository.findByTaskIdAndIsAssignee(taskId, 1).isPresent();
    }

    /**
     * Get current assignee ID for a task
     */
    public Integer getCurrentAssigneeId(Long taskId) {
        Optional<TaskAssignee> taskAssigneeOpt = taskAssigneeRepository.findByTaskIdAndIsAssignee(taskId, 1);
        if (taskAssigneeOpt.isPresent()) {
            return taskAssigneeOpt.get().getAssigneeId();
        }
        
        // Fallback to tasks table
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        return task.getAssigneeId();
    }
}
