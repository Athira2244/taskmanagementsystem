package taskmanager.taskmanager.controller;

import org.springframework.web.bind.annotation.*;

import taskmanager.taskmanager.dto.TaskRequest;
import taskmanager.taskmanager.dto.TaskResponse;
import taskmanager.taskmanager.model.Employee;
import taskmanager.taskmanager.model.Task;
import taskmanager.taskmanager.repository.TaskRepository;
import taskmanager.taskmanager.service.TaskAssigneeService;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "http://localhost:3000")
public class TaskController {

    private final TaskRepository taskRepository;
    private final TaskAssigneeService taskAssigneeService;

    public TaskController(TaskRepository taskRepository, TaskAssigneeService taskAssigneeService) {
        this.taskRepository = taskRepository;
        this.taskAssigneeService = taskAssigneeService;
    }

    // CREATE TASK
    @PostMapping
    public Task createTask(@RequestBody TaskRequest request) {

        Task task = new Task();
        task.setTaskName(request.getTaskName());
        task.setDescription(request.getDescription());
        task.setDeadline(request.getDeadline());
        task.setStatus("PENDING");
        task.setAssigneeId(request.getAssigneeId());
        task.setEmpName(request.getEmpName());       // EmpName
        task.setCreatedBy(request.getCreatedBy());
        task.setCreatedByName(request.getCreatedByName());

        // Employee employee = new Employee();
        // employee.setEmployeeId(request.getAssigneeId());
        // task.setAssignee(employee);

// System.out.println("DEBUG EmpName = [" + request.getEmpName() + "]");
// System.out.println("DEBUG AssigneeId = [" + request.getAssigneeId() + "]");
        System.out.println("DEBUG CreatedBy received: " + request.getCreatedBy());

        return taskRepository.save(task);
    }

    // GET ALL TASKS (old endpoint - kept for compatibility)
    @GetMapping
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    // GET TASKS FOR ASSIGNEE - combines tasks and task_assignees
    @GetMapping("/assignee/{assigneeId}")
    public List<TaskResponse> getTasksForAssignee(@PathVariable Integer assigneeId) {
        return taskAssigneeService.getTasksForAssignee(assigneeId);
    }

    // UPDATE TASK STATUS - handles both scenarios (parent task or reassigned)
    @PutMapping("/{id}/status")
    public Map<String, String> updateTaskStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        String newStatus = body.get("status");
        Integer assigneeId = body.get("assigneeId") != null ? 
            Integer.parseInt(body.get("assigneeId")) : null;

        // Use service to handle status update logic
        taskAssigneeService.updateTaskStatus(id, assigneeId, newStatus);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Status updated successfully");
        response.put("status", newStatus);
        return response;
    }

 @Transactional
@PutMapping("/{id}")
public Map<String, String> updateTask(
        @PathVariable Long id,
        @RequestBody TaskRequest request) {

    Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));

    // Get the CURRENT assignee (could be in tasks or task_assignees)
    Integer currentAssigneeId;
    boolean taskHasBeenReassigned = taskAssigneeService.isTaskReassigned(id);
    
    if (taskHasBeenReassigned) {
        // Get current assignee from task_assignees table
        currentAssigneeId = taskAssigneeService.getCurrentAssigneeId(id);
    } else {
        // Get current assignee from tasks table
        currentAssigneeId = task.getAssigneeId();
    }

    // Check if assignee is being changed
    boolean assigneeChanged = request.getAssigneeId() != null && 
                              !request.getAssigneeId().equals(currentAssigneeId);

    if (assigneeChanged) {
        // Handle reassignment through service - always pass the name
        taskAssigneeService.reassignTask(id, request.getAssigneeId(), request.getEmpName());
    }

    // Update other fields in parent task
    if (request.getTaskName() != null)
        task.setTaskName(request.getTaskName());

    if (request.getDescription() != null)
        task.setDescription(request.getDescription());

    if (request.getDeadline() != null)
        task.setDeadline(request.getDeadline());

    // If assignee ID is provided but not changed (or if it's the first assignment)
    if (request.getAssigneeId() != null)
        task.setAssigneeId(request.getAssigneeId());

    // Update empName in tasks table if it's a parent task assignment
    if (request.getEmpName() != null)
        task.setEmpName(request.getEmpName());

    if (request.getStatus() != null)
        task.setStatus(request.getStatus());

    taskRepository.save(task);

    Map<String, String> response = new HashMap<>();
    response.put("message", assigneeChanged ? "Task reassigned successfully" : "Task updated successfully");
    return response;
}

}
