import React, { useEffect, useState } from "react";
import TaskModal from "./TaskModal";
import TaskDetails from "./TaskDetails";


function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);



  // const employeeName = "Athira"; // replace with dynamic value later



  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Fetch employees list
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const userId = user?.user_id;

      if (userId) {
        fetch(`https://v1.mypayrollmaster.online/api/v2qa/employees_list?user_id=${userId}`)
          .then(res => res.json())
          .then(json => {
            if (json.success === 1) {
              setEmployees(json.data);
            }
          })
          .catch(err => console.error("Failed to load employees", err));
      }
    }
  }, []);

  const loadTasks = () => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const assigneeId = user?.emp_pkey;

      if (assigneeId) {
        // Use new endpoint that combines tasks and task_assignees
        fetch(`http://localhost:8080/api/tasks/assignee/${assigneeId}`)
          .then(res => res.json())
          .then(data => setTasks(data))
          .catch(err => console.error("Failed to load tasks", err));
      }
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const employeeName = user?.employee_name || "Employee";

  const loggedInUserId = user?.emp_pkey;

  // All tasks are already filtered by the backend
  const assignedTasks = tasks;

  // Helper function to get employee name by ID
  const getEmployeeName = (assigneeId) => {
    if (!assigneeId) return "Unassigned";
    const employee = employees.find(emp => Number(emp.emp_pkey) === Number(assigneeId));
    return employee?.EmpName?.trim() || "Unknown";
  };

  console.log(assignedTasks, 'assigned');

  const pendingCount = assignedTasks.filter(t => t.status === "PENDING").length;
  const progressCount = assignedTasks.filter(t => t.status === "IN_PROGRESS").length;
  const completedCount = assignedTasks.filter(t => t.status === "COMPLETED").length;
  const overdueCount = assignedTasks.filter(task =>
    task.deadline &&
    new Date(task.deadline) < new Date() &&
    task.status !== "COMPLETED"
  ).length;

  return (

    <div className="dashboard">

      {/* Header */}
      <div className="header">
        <div>
          <h2>Welcome, {employeeName} 👋</h2>
          <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
            Here’s an overview of your tasks
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="card-container">
        <div className="card pending">
          <h4>Pending</h4>
          <p>{pendingCount}</p>
        </div>

        <div className="card progress">
          <h4>In Progress</h4>
          <p>{progressCount}</p>
        </div>

        <div className="card completed">
          <h4>Completed</h4>
          <p>{completedCount}</p>
        </div>
        <div className="card overdue">
          <h4>Overdue</h4>
          <p style={{ color: "#c0392b" }}>{overdueCount}</p>
        </div>
      </div>

      {/* Task Section */}
      <div className="section-header">
        <h3>Tasks</h3>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Create Task
        </button>
      </div>

      {showModal && (
        <TaskModal
          onClose={() => setShowModal(false)}
          onTaskCreated={loadTasks}
        />
      )}

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Task</th>
              <th>Description</th>
              <th>Assignee</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {assignedTasks.map(task => {
              const isOverdue =
                task.deadline &&
                new Date(task.deadline) < new Date() &&
                task.status !== "COMPLETED";

              return (
                <tr
                  key={`${task.source}-${task.id}`}
                  onClick={() => setSelectedTask(task)}
                  className={isOverdue ? "overdue-task" : ""}
                  style={{ cursor: "pointer" }}
                >
                  <td>{task.taskId}</td>
                  <td>{task.taskName}</td>
                  <td>{task.description}</td>
                  <td>{task.empName || getEmployeeName(task.assigneeId)}</td>
                  <td>{task.deadline}</td>
                  <td>{task.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {selectedTask && (
          <TaskDetails
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onStatusChange={loadTasks}
          />
        )}

      </div>

    </div>
  );
}

export default Dashboard;
