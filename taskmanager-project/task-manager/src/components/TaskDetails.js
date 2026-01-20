


import React, { useEffect, useState } from "react";

function TaskDetails({ task, onClose, onStatusChange }) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [newEntry, setNewEntry] = useState(null);
  const [status, setStatus] = useState(task.status);
  const [employees, setEmployees] = useState([]);


  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser?.user_id) return;

    fetch(
      `https://v1.mypayrollmaster.online/api/v2qa/employees_list?user_id=${storedUser.user_id}`
    )
      .then(res => res.json())
      .then(json => {
        if (json.success === 1) {
          setEmployees(json.data);
        } else {
          setEmployees([]);
        }
      })
      .catch(err => {
        console.error("Failed to load employees", err);
        setEmployees([]);
      });
  }, []);

  // Ensure current user is in the list
  const user = JSON.parse(localStorage.getItem("user"));
  const allEmployees = React.useMemo(() => {
    if (!user || !user.emp_pkey) return employees;
    const exists = employees.find(e => Number(e.emp_pkey) === Number(user.emp_pkey));
    if (!exists) {
      return [...employees, {
        emp_pkey: user.emp_pkey,
        EmpName: user.employee_name || "Myself"
      }];
    }
    return employees;
  }, [employees]);

  // Helper function to get employee name by ID
  const getEmployeeName = (assigneeId) => {
    if (!assigneeId) return "Unassigned";
    const employee = employees.find(emp => Number(emp.emp_pkey) === Number(assigneeId));
    return employee?.EmpName?.trim() || "Unknown";
  };

  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState({
    taskName: task.taskName,
    description: task.description,
    assigneeId: task.assigneeId,
  });

  useEffect(() => {
    if (task?.id) {
      setStatus(task.status);
      setForm({
        taskName: task.taskName,
        description: task.description,
        assigneeId: task.assigneeId,
      });
      loadTimeEntries();
    }
  }, [task]);

  const loadTimeEntries = async () => {
    const taskIdToFetch = task.taskId || task.id;
    const res = await fetch(
      `http://localhost:8080/api/emp_task_time/task/${taskIdToFetch}`
    );
    const data = await res.json();
    setTimeEntries(Array.isArray(data) ? data : []);
  };

  /* -------- STATUS -------- */
  const handleStatusClick = async () => {
    let newStatus;
    if (status === "PENDING") newStatus = "IN_PROGRESS";
    else if (status === "IN_PROGRESS") newStatus = "COMPLETED";
    else return;

    // Use taskId (parent task ID) for status updates
    const taskIdToUpdate = task.taskId || task.id;

    await fetch(`http://localhost:8080/api/tasks/${taskIdToUpdate}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        assigneeId: task.assigneeId
      }),
    });

    setStatus(newStatus);
    if (onStatusChange) onStatusChange();
  };

  /* -------- SAVE EDIT -------- */
  console.log(task, 'task');
  const handleSave = async () => {
    try {
      const isAssigneeChanged =
        Number(task.assigneeId) !== Number(form.assigneeId);

      // Use taskId (parent task ID) for updates
      const taskIdToUpdate = task.taskId || task.id;

      // Find the selected employee name for the CURRENTLY selected assigneeId in the form
      const selectedEmployee = allEmployees.find(e => Number(e.emp_pkey) === Number(form.assigneeId));
      const empName = selectedEmployee?.EmpName?.trim() || task.empName || '';

      console.log('Selected employee for save:', selectedEmployee);
      console.log('Employee name to send:', empName);

      // We always send the full object to ensure names are persisted correctly
      await fetch(`http://localhost:8080/api/tasks/${taskIdToUpdate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: form.taskName,
          description: form.description,
          assigneeId: form.assigneeId,
          empName: empName,
        }),
      });

      setIsEdit(false);
      if (onStatusChange) onStatusChange();
      onClose();

    } catch (err) {
      console.error("Save failed", err);
      alert("Failed to save task");
    }
  };


  /* -------- TIME -------- */
  const handleAddTime = () => {
    const now = new Date().toISOString().slice(0, 16);
    setNewEntry({ startTime: now, endTime: "", comment: "" });
  };

  const duration = (s, e) =>
    s && e ? Math.floor((new Date(e) - new Date(s)) / 60000) : 0;

  const saveTime = async () => {
    const taskIdToSave = task.taskId || task.id;

    await fetch("http://localhost:8080/api/emp_task_time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empFkey: task.assigneeId,
        taskFkey: taskIdToSave,
        startTime: newEntry.startTime,
        endTime: newEntry.endTime,
        durationMinutes: duration(newEntry.startTime, newEntry.endTime),
        comment: newEntry.comment,
      }),
    });

    setNewEntry(null);
    loadTimeEntries();
  };

  return (
    <div className="task-details-overlay" onClick={onClose}>
      <div className="task-details-modal" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="task-details-header">
          <h3>Task Details</h3>
          <div>
            {!isEdit ? (
              <button className="btn-primary" onClick={() => setIsEdit(true)}>
                Edit
              </button>
            ) : (
              <>
                <button className="btn-primary" onClick={handleSave}>
                  Save
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setIsEdit(false)}
                  style={{ marginLeft: 8 }}
                >
                  Cancel
                </button>
              </>
            )}
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        {/* BODY – USES YOUR GRID */}
        <div className="task-details-body">

          <label>Task</label>
          {isEdit ? (
            <input
              value={form.taskName}
              onChange={(e) =>
                setForm({ ...form, taskName: e.target.value })
              }
            />
          ) : (
            <span>{task.taskName}</span>
          )}

          <label>Created By</label>
          <span>{task.createdByName || getEmployeeName(task.createdBy)}</span>

          <label>Assignee</label>
          {isEdit ? (

            <select
              value={form.assigneeId}
              onChange={(e) =>
                setForm({ ...form, assigneeId: Number(e.target.value) })
              }
            >
              <option value="">Select assignee</option>

              {allEmployees.map(emp => (
                <option key={emp.emp_pkey} value={emp.emp_pkey}>
                  {emp.EmpName}
                </option>
              ))}
            </select>

          ) : (
            <span>{task.empName || getEmployeeName(task.assigneeId)}</span>
          )}

          <label>Status</label>
          <span className={`task-status status-${status}`}>
            {status.replace("_", " ")}
          </span>

          <label>Description</label>
          {isEdit ? (
            <textarea
              rows="3"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          ) : (
            <span>{task.description}</span>
          )}

        </div>

        {/* ACTIONS */}
        <div className="task-details-actions">
          <button
            className="btn-primary"
            onClick={handleStatusClick}
            disabled={status === "COMPLETED"}
          >
            {status === "PENDING"
              ? "Start"
              : status === "IN_PROGRESS"
                ? "Complete"
                : "Completed"}
          </button>

          <button
            className="btn-secondary"
            onClick={handleAddTime}
            style={{ marginLeft: 10 }}
          >
            ➕ Add Time
          </button>
        </div>

        {/* TIME TABLE */}
        <table style={{ width: "100%", marginTop: 15 }}>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Minutes</th>
              <th>Comment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {timeEntries.map((t) => (
              <tr key={t.timeId}>
                <td>{t.startTime}</td>
                <td>{t.endTime}</td>
                <td>{t.durationMinutes}</td>
                <td>{t.comment}</td>
                <td></td>
              </tr>
            ))}

            {newEntry && (
              <tr>
                <td>
                  <input
                    type="datetime-local"
                    value={newEntry.startTime}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, startTime: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    type="datetime-local"
                    value={newEntry.endTime}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, endTime: e.target.value })
                    }
                  />
                </td>
                <td>{duration(newEntry.startTime, newEntry.endTime)}</td>
                <td>
                  <input
                    value={newEntry.comment}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, comment: e.target.value })
                    }
                  />
                </td>
                <td>
                  <button
                    className="btn-primary"
                    onClick={saveTime}
                    disabled={!newEntry.endTime || !newEntry.comment}
                  >
                    Save
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
}

export default TaskDetails;

