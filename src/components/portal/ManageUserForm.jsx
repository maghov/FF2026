import { useState } from "react";
import { managers, roles, employmentTypes } from "../../data/portalMockData";
import "../portal/CreateUserForm.css";
import "./ManageUserForm.css";

const initialState = {
  name: "",
  firstName: "",
  lastName: "",
  mobileNumber: "+1 555-0100",
  email: "",
  employment: "",
  manager: "",
  jobTitle: "",
  jobRole: "",
  toDate: "",
};

export default function ManageUserForm() {
  const [formData, setFormData] = useState(initialState);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Manage User submitted:", formData);
  };

  return (
    <div className="portal-form-card">
      <h2>Manage User</h2>
      <p className="form-description">Update the user details below.</p>

      <form onSubmit={handleSubmit} className="portal-form">
        <div className="form-grid">
          {/* Name */}
          <div className="form-field">
            <label htmlFor="manage-name">Name</label>
            <input
              id="manage-name"
              type="text"
              placeholder="Full name"
              value={formData.name}
              onChange={handleChange("name")}
            />
          </div>

          {/* First Name */}
          <div className="form-field">
            <label htmlFor="manage-firstName">First Name</label>
            <input
              id="manage-firstName"
              type="text"
              placeholder="First name"
              value={formData.firstName}
              onChange={handleChange("firstName")}
            />
          </div>

          {/* Last Name */}
          <div className="form-field">
            <label htmlFor="manage-lastName">Last Name</label>
            <input
              id="manage-lastName"
              type="text"
              placeholder="Last name"
              value={formData.lastName}
              onChange={handleChange("lastName")}
            />
          </div>

          {/* Mobile Number (read-only) */}
          <div className="form-field">
            <label htmlFor="manage-mobileNumber">Mobile Number</label>
            <input
              id="manage-mobileNumber"
              type="tel"
              value={formData.mobileNumber}
              readOnly
              className="input-readonly"
            />
          </div>

          {/* Email */}
          <div className="form-field">
            <label htmlFor="manage-email">Email</label>
            <input
              id="manage-email"
              type="email"
              placeholder="user@email.com"
              value={formData.email}
              onChange={handleChange("email")}
            />
          </div>

          {/* Employment */}
          <div className="selector">
            <label htmlFor="manage-employment">Employment</label>
            <select
              id="manage-employment"
              value={formData.employment}
              onChange={handleChange("employment")}
            >
              <option value="">Select employment type...</option>
              {employmentTypes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {/* Manager */}
          <div className="selector">
            <label htmlFor="manage-manager">Manager</label>
            <select
              id="manage-manager"
              value={formData.manager}
              onChange={handleChange("manager")}
            >
              <option value="">Select manager...</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Job Title */}
          <div className="form-field">
            <label htmlFor="manage-jobTitle">Job Title</label>
            <input
              id="manage-jobTitle"
              type="text"
              placeholder="Enter job title"
              value={formData.jobTitle}
              onChange={handleChange("jobTitle")}
            />
          </div>

          {/* Job Role */}
          <div className="selector">
            <label htmlFor="manage-jobRole">Job Role</label>
            <select
              id="manage-jobRole"
              value={formData.jobRole}
              onChange={handleChange("jobRole")}
            >
              <option value="">Select role...</option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* To Date */}
          <div className="form-field">
            <label htmlFor="manage-toDate">To Date</label>
            <input
              id="manage-toDate"
              type="date"
              value={formData.toDate}
              onChange={handleChange("toDate")}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
