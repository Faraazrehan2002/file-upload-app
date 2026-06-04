require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const prisma = require("./db");
const authMiddleware = require("./auth");
const upload = require("./upload");
const {
  createPasswordResetToken,
  findValidPasswordReset,
  consumePasswordReset,
  getResetUrl,
} = require("./passwordReset");

const GENERIC_RESET_MESSAGE =
  "If that email is registered, password reset instructions have been sent.";

const app = express();

const corsOriginEnv = process.env.CORS_ORIGIN;
const corsOrigins =
  !corsOriginEnv || corsOriginEnv === "*"
    ? true
    : corsOriginEnv.split(",").map((origin) => origin.trim());

app.use(
  cors({
    origin: corsOrigins,
    credentials: corsOrigins !== true,
  })
);
app.use((req, res, next) => {
  if (req.is("multipart/form-data")) {
    return next();
  }
  express.json()(req, res, next);
});

app.get("/", (req, res) => {
  res.json({ message: "File Upload API is running" });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    const response = { message: GENERIC_RESET_MESSAGE };

    if (user) {
      const resetToken = await createPasswordResetToken(user.id);

      if (process.env.EXPOSE_RESET_LINK === "true") {
        response.resetUrl = getResetUrl(resetToken);
      }
    }

    res.json(response);
  } catch {
    res.status(500).json({ message: "Could not process password reset request" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const resetRecord = await findValidPasswordReset(token);

    if (!resetRecord) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { password: hashedPassword },
    });

    await consumePasswordReset(token);

    res.json({ message: "Password updated successfully. You can log in now." });
  } catch {
    res.status(500).json({ message: "Could not reset password" });
  }
});

app.post("/api/files/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const savedFile = await prisma.uploadedFile.create({
      data: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        userId: req.user.id,
      },
    });

    res.status(201).json({
      message: "File uploaded successfully",
      file: savedFile,
    });
  } catch {
    res.status(500).json({ message: "File upload failed" });
  }
});

app.get("/api/files", authMiddleware, async (req, res) => {
  try {
    const files = await prisma.uploadedFile.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ message: "Could not fetch files" });
  }
});

app.get("/api/files/:id/download", async (req, res) => {
    try {
      const token = req.query.token || req.headers.authorization?.split(" ")[1];
  
      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const fileId = Number(req.params.id);
  
      const file = await prisma.uploadedFile.findFirst({
        where: {
          id: fileId,
          userId: decoded.id,
        },
      });
  
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
  
      const filePath = path.join(__dirname, "..", "uploads", file.storedName);
  
      res.download(filePath, file.originalName);
    } catch (error) {
      res.status(401).json({ message: "Invalid or expired token" });
    }
  });

app.use((err, req, res, next) => {
  if (!err) {
    return next();
  }

  if (req.path !== "/api/files/upload") {
    return next(err);
  }

  const aborted = err.message === "Request aborted";

  res.status(aborted ? 499 : 400).json({
    message: aborted
      ? "Upload was interrupted. Select the file again and try once more."
      : err.message || "File upload error",
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});