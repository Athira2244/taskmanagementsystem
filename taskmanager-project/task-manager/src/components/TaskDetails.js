import React, { useEffect, useState } from "react";

function TaskDetails({ task, onClose ,onStatusChange}) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [newEntry, setNewEntry] = useState(null);
  const [status, setStatus] = useState(task.status); // track status locally

  const loadTimeEntries = async () => {
    try {
      const res = await fetch(
        `http://localhost:8080/api/emp_task_time/task/${task.id}`
      );
      if (!res.ok) throw new Error("Failed to load time entries");
      const data = await res.json();
      setTimeEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setTimeEntries([]);
    }
  };

  useEffect(() => {
    if (task?.id) {
      setStatus(task.status); // initialize status from task
      loadTimeEntries();
    }
  }, [task?.id]);

  const handleAddTime = () => {
    const now = new Date().toISOString().slice(0, 16);
    setNewEntry({
      startTime: now,
      endTime: "",
      durationMinutes: 0,
      comment:""
    });
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return 0;
    return Math.floor((new Date(end) - new Date(start)) / (1000 * 60));
  };

  const handleSaveTime = async () => {
    const duration = calculateDuration(newEntry.startTime, newEntry.endTime);

    const payload = {
      empFkey: task.assigneeId,
      taskFkey: task.id,
      startTime: newEntry.startTime,
      endTime: newEntry.endTime,
      durationMinutes: duration,
      comment :newEntry.comment
    };

    await fetch("http://localhost:8080/api/emp_task_time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setNewEntry(null);
    loadTimeEntries();
  };

  // ✅ NEW: Handle Start / Complete
  // const handleStatusClick = async () => {
  //   let newStatus;
  //   if (status === "PENDING") newStatus = "IN_PROGRESS";
  //   else if (status === "IN_PROGRESS") newStatus = "COMPLETED";
  //   else return; // already completed

  //   // Update backend task status
  //   await fetch(`http://localhost:8080/api/tasks/${task.id}`, {
  //     method: "PUT",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ ...task, status: newStatus }),
  //   });

  //   setStatus(newStatus); // update local status
  // };

  const handleStatusClick = async () => {
  let newStatus;
  if (status === "PENDING") newStatus = "IN_PROGRESS";
  else if (status === "IN_PROGRESS") newStatus = "COMPLETED";
  else return;

  try {
    const res = await fetch(`http://localhost:8080/api/tasks/${task.id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: newStatus,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to update task status");
    }

    setStatus(newStatus); // ✅ update UI only after DB update
    if (onStatusChange) onStatusChange();
  } catch (err) {
    console.error(err);
    alert("Status update failed");
  }
};


  // Dynamic button label
  const getStatusButtonLabel = () => {
    if (status === "PENDING") return "Start";
    if (status === "IN_PROGRESS") return "Complete";
    return "Completed"; // disabled
  };

  return (
    <div className="task-details-overlay" onClick={onClose}>
      <div className="task-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-details-header">
          <h3>Task Details</h3>
          <button onClick={onClose}>×</button>
        </div>

        <div className="task-details-body">
          <p><b>Task:</b> {task.taskName}</p>
          <p><b>Description:</b> {task.description}</p>
          <p><b>Status:</b> {status}</p>
        </div>

        <button className="btn-primary" onClick={handleStatusClick} disabled={status === "COMPLETED"}>
          {getStatusButtonLabel()}
        </button>

        <button className="btn-primary" onClick={handleAddTime} style={{ marginLeft: "10px" }}>
          ➕ Add Time
        </button>

        {/* Time table */}
        <table style={{ width: "100%", marginTop: "15px" }}>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Duration (min)</th>
              <th>Comments</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {timeEntries.map(t => (
              <tr key={t.timeId}>
                <td>{t.startTime}</td>
                <td>{t.endTime}</td>
                <td>{t.durationMinutes}</td>
                <td>{t.comment}</td>
                <td></td>
              </tr>
            ))}

            {/* {newEntry && (
              <tr>
                <td><input type="datetime-local" value={newEntry.startTime} readOnly /></td>
                <td>
                  <input
                    type="datetime-local"
                    value={newEntry.endTime}
                    onChange={(e) => setNewEntry({ ...newEntry, endTime: e.target.value })}
                  />
                </td>
                <td>{calculateDuration(newEntry.startTime, newEntry.endTime)}</td>
                <td><button onClick={handleSaveTime}>Save</button></td>
              </tr>
            )} */}

            {newEntry && (
  <tr>
    <td>
      <input
        type="datetime-local"
        value={newEntry.startTime}
        readOnly
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

    <td>
      {calculateDuration(newEntry.startTime, newEntry.endTime)}
    </td>

    <td>
      <input
        type="text"
        placeholder="Enter work comment"
        value={newEntry.comment}
        onChange={(e) =>
          setNewEntry({ ...newEntry, comment: e.target.value })
        }
        style={{ width: "100%" }}
      />
    </td>

    <td>
      <button
        onClick={handleSaveTime}
        disabled={!newEntry.endTime || !newEntry.comment.trim()}
      >
        Save
      </button>
    </td>
  </tr>
)}

          </tbody>
        </table>

        <div style={{ marginTop: "15px" }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default TaskDetails;
