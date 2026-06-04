import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "/api";

const FILE_READ_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 60000;

function readFileWithTimeout(file, timeoutMs) {
  return Promise.race([
    file.arrayBuffer(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("FILE_READ_TIMEOUT")), timeoutMs);
    }),
  ]);
}

function App() {
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("resetToken");

    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setMode("reset-password");
      localStorage.removeItem("token");
      setToken("");
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchFiles();
    }
  }, [token]);

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");

    try {
      await axios.post(`${API_URL}/auth/register`, form);
      setMessage("Account created. Please log in.");
      setMode("login");
      setForm({ name: "", email: "", password: "" });
    } catch (error) {
      setMessage(error.response?.data?.message || "Registration failed");
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("");

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: form.email,
        password: form.password,
      });

      localStorage.setItem("token", response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      setMessage("Logged in successfully");
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setFiles([]);
    setSelectedFile(null);
    setForm({ name: "", email: "", password: "" });
    setResetToken("");
    setResetPassword("");
    setResetPasswordConfirm("");
    setDevResetUrl("");
    setMode("login");
    setMessage("Logged out successfully");
    window.history.replaceState({}, "", window.location.pathname);
  }

  function switchAuthMode(nextMode, options = {}) {
    setMode(nextMode);
    if (!options.keepMessage) {
      setMessage("");
    }
    setDevResetUrl("");

    if (nextMode !== "reset-password") {
      setResetToken("");
      setResetPassword("");
      setResetPasswordConfirm("");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setMessage("");
    setDevResetUrl("");

    if (!form.email) {
      setMessage("Enter your account email");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: form.email,
      });

      setMessage(response.data.message || "Check your email for reset instructions.");

      if (response.data.resetUrl) {
        setDevResetUrl(response.data.resetUrl);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not request password reset");
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setMessage("");

    if (!resetToken) {
      setMessage("Reset link is invalid. Request a new one.");
      return;
    }

    if (resetPassword.length < 8) {
      setMessage("Password must be at least 8 characters");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        token: resetToken,
        password: resetPassword,
      });

      setResetPassword("");
      setResetPasswordConfirm("");
      setResetToken("");
      setForm({ name: "", email: form.email, password: "" });
      switchAuthMode("login", { keepMessage: true });
      setMessage(response.data.message || "Password updated. Please log in.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not reset password");
    }
  }

  async function fetchFiles() {
    try {
      const response = await axios.get(`${API_URL}/files`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setFiles(response.data);
    } catch (error) {
      setMessage("Could not load files");
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setMessage("");

    if (!selectedFile) {
      setMessage("Please select a file first");
      return;
    }

    setUploading(true);

    try {
      setUploadPhase("Preparing file…");
      let buffer;
      try {
        buffer = await readFileWithTimeout(selectedFile, FILE_READ_TIMEOUT_MS);
      } catch (readError) {
        if (readError.message === "FILE_READ_TIMEOUT") {
          setMessage(
            "Could not read the file in time. If it is in iCloud, open it in Preview or move it to Downloads, then try again."
          );
        } else {
          setMessage("Could not read the selected file.");
        }
        return;
      }

      const data = new FormData();
      data.append(
        "file",
        new Blob([buffer], { type: selectedFile.type || "application/octet-stream" }),
        selectedFile.name
      );

      setUploadPhase("Uploading…");
      const controller = new AbortController();
      const uploadTimeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

      const response = await fetch(`${API_URL}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
        signal: controller.signal,
      });

      clearTimeout(uploadTimeout);

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.message || "Upload failed");
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMessage("File uploaded successfully");
      fetchFiles();
    } catch (error) {
      if (error.name === "AbortError") {
        setMessage(
          "Upload timed out. Check that the backend is running, then try again."
        );
      } else {
        setMessage("Upload failed. Make sure the backend is running on port 5001.");
      }
    } finally {
      setUploading(false);
      setUploadPhase("");
    }
  }

  function downloadFile(fileId) {
    window.open(`${API_URL}/files/${fileId}/download?token=${token}`, "_blank");
  }

  return (
    <div className="app">
      <div className="card">
        <h1>Secure File Upload</h1>
        <p className="subtitle">Register, log in, upload, view, and download files.</p>

        {message && <div className="message">{message}</div>}

        {!token ? (
          <div>
            {mode !== "forgot-password" && mode !== "reset-password" && (
              <div className="tabs">
                <button
                  className={mode === "login" ? "active" : ""}
                  onClick={() => switchAuthMode("login")}
                >
                  Login
                </button>
                <button
                  className={mode === "register" ? "active" : ""}
                  onClick={() => switchAuthMode("register")}
                >
                  Register
                </button>
              </div>
            )}

            {mode === "forgot-password" && (
              <>
                <h2 className="section-title">Forgot password</h2>
                <p className="hint">
                  Enter your email. If an account exists, you will receive reset instructions.
                </p>
                <form onSubmit={handleForgotPassword}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <button type="submit">Send reset link</button>
                </form>
                {devResetUrl && (
                  <p className="dev-reset">
                    Development reset link:{" "}
                    <a href={devResetUrl}>Set new password</a>
                  </p>
                )}
                <button type="button" className="link-button" onClick={() => switchAuthMode("login")}>
                  Back to login
                </button>
              </>
            )}

            {mode === "reset-password" && (
              <>
                <h2 className="section-title">Set new password</h2>
                <form onSubmit={handleResetPassword}>
                  <input
                    type="password"
                    placeholder="New password (min 8 characters)"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={resetPasswordConfirm}
                    onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  />
                  <button type="submit">Update password</button>
                </form>
                <button type="button" className="link-button" onClick={() => switchAuthMode("login")}>
                  Back to login
                </button>
              </>
            )}

            {(mode === "login" || mode === "register") && (
              <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
                {mode === "register" && (
                  <input
                    type="text"
                    placeholder="Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                )}

                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />

                <button type="submit">{mode === "login" ? "Log In" : "Create Account"}</button>

                {mode === "login" && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => switchAuthMode("forgot-password")}
                  >
                    Forgot password?
                  </button>
                )}
              </form>
            )}
          </div>
        ) : (
          <div>
            <div className="topbar">
              <p>Logged in{user?.name ? ` as ${user.name}` : ""}</p>
              <button onClick={handleLogout} className="secondary">Logout</button>
            </div>

            <form onSubmit={handleUpload} className="upload-box">
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setSelectedFile(file || null);
                  setMessage("");
                }}
              />
              {selectedFile && (
                <p className="selected-file">
                  Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </p>
              )}
              <button type="submit" disabled={uploading || !selectedFile}>
                {uploading ? uploadPhase || "Uploading…" : "Upload File"}
              </button>
            </form>

            <h2>Your Files</h2>

            {files.length === 0 ? (
              <p className="empty">No files uploaded yet.</p>
            ) : (
              <div className="file-list">
                {files.map((file) => (
                  <div className="file-item" key={file.id}>
                    <div>
                      <strong>{file.originalName}</strong>
                      <p>{Math.round(file.size / 1024)} KB · {file.mimeType}</p>
                    </div>
                    <button onClick={() => downloadFile(file.id)}>Download</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;