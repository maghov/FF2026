import { useState } from "react";
import {
  countryCodes,
  externalCompanies,
  internalCompanies,
  managers,
  roles,
} from "../../data/portalMockData";
import "./CreateUserForm.css";

const initialState = {
  countryCode: "",
  mobileNumber: "",
  firstName: "",
  lastName: "",
  externalEmail: "",
  externalCompany: "",
  includeSearch: false,
  manager: "",
  internalCompany: "",
  startDate: "",
  endDate: "",
  title: "",
  role: "",
};

export default function CreateUserForm() {
  const [formData, setFormData] = useState(initialState);

  const handleChange = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Create User submitted:", formData);
  };

  const handleReset = () => {
    setFormData(initialState);
  };

  return (
    <div className="portal-form-card">
      <h2>Create User</h2>
      <p className="form-description">
        Fill in the details below to create a new external user account.
      </p>

      <form onSubmit={handleSubmit} className="portal-form">
        <div className="form-grid">
          {/* Country Code */}
          <div className="selector">
            <label htmlFor="countryCode">Country Code</label>
            <select
              id="countryCode"
              value={formData.countryCode}
              onChange={handleChange("countryCode")}
            >
              <option value="">Select country...</option>
              {countryCodes.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile Number */}
          <div className="form-field">
            <label htmlFor="mobileNumber">Mobile Number</label>
            <input
              id="mobileNumber"
              type="tel"
              placeholder="Enter mobile number"
              value={formData.mobileNumber}
              onChange={handleChange("mobileNumber")}
            />
          </div>

          {/* First Name */}
          <div className="form-field">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              type="text"
              placeholder="Enter first name"
              value={formData.firstName}
              onChange={handleChange("firstName")}
            />
          </div>

          {/* Last Name */}
          <div className="form-field">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              type="text"
              placeholder="Enter last name"
              value={formData.lastName}
              onChange={handleChange("lastName")}
            />
          </div>

          {/* External Email */}
          <div className="form-field">
            <label htmlFor="externalEmail">External Email</label>
            <input
              id="externalEmail"
              type="email"
              placeholder="user@company.com"
              value={formData.externalEmail}
              onChange={handleChange("externalEmail")}
            />
          </div>

          {/* External Company */}
          <div className="selector">
            <label htmlFor="externalCompany">External Company</label>
            <select
              id="externalCompany"
              value={formData.externalCompany}
              onChange={handleChange("externalCompany")}
            >
              <option value="">Select company...</option>
              {externalCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Include Search */}
          <div className="form-field form-field-checkbox">
            <label htmlFor="includeSearch" className="checkbox-label">
              <input
                id="includeSearch"
                type="checkbox"
                checked={formData.includeSearch}
                onChange={handleChange("includeSearch")}
              />
              <span>Include in Search</span>
            </label>
          </div>

          {/* Manager */}
          <div className="selector">
            <label htmlFor="manager">Manager</label>
            <select
              id="manager"
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

          {/* Internal Company */}
          <div className="selector">
            <label htmlFor="internalCompany">Internal Company</label>
            <select
              id="internalCompany"
              value={formData.internalCompany}
              onChange={handleChange("internalCompany")}
            >
              <option value="">Select internal company...</option>
              {internalCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="form-field">
            <label htmlFor="startDate">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={handleChange("startDate")}
            />
          </div>

          {/* End Date */}
          <div className="form-field">
            <label htmlFor="endDate">End Date</label>
            <input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={handleChange("endDate")}
            />
          </div>

          {/* Title */}
          <div className="form-field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              placeholder="Enter job title"
              value={formData.title}
              onChange={handleChange("title")}
            />
          </div>

          {/* Role */}
          <div className="selector">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={formData.role}
              onChange={handleChange("role")}
            >
              <option value="">Select role...</option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Create User
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
