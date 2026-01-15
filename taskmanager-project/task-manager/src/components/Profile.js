import React from "react";
import "../styles/Profile.css";

function Profile({ onBack, onLogout }) {
  const user = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.clear();
    onLogout();
  };
  

  // Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return "-"; // handle empty/null dates
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // months are 0-indexed
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

  return (
    <div className="profile-container">
      {/* Heading */}
      <h1 className="profile-heading">My Profile</h1>

      {/* Main content: image + details */}
      <div className="profile-main">
        {/* Image */}
        <img
          src={user?.profile_pic || "/istockphoto-2132177453-170667a.jpg"}
          alt="Profile"
          className="profile-image-large"
          onError={(e) => (e.target.src = "/istockphoto-2132177453-170667a.jpg")}
        />
        

        

        {/* Details */}
        <div className="profile-details">
          <h2>{user?.employee_name || "Employee"}</h2>
          <p><b>Employee ID:</b> {user?.user_id}</p>
          <p><b>Department:</b> {user?.department}</p>
          <p><b>Designation:</b> {user?.designation}</p>
          <p><b>Date of Birth:</b> {formatDate(user?.date_of_birth)}</p>
          <p><b>Date of Joining:</b> {formatDate(user?.joining_date)}</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="profile-buttons">
        <button className="profile-back-btn" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Profile;
