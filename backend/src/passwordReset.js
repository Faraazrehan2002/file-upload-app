const crypto = require("crypto");
const prisma = require("./db");

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function generateResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getResetUrl(token) {
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}/?resetToken=${token}`;
}

async function createPasswordResetToken(userId) {
  const rawToken = generateResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.deleteMany({
    where: { userId },
  });

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return rawToken;
}

async function findValidPasswordReset(rawToken) {
  const tokenHash = hashResetToken(rawToken);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return null;
  }

  return record;
}

async function consumePasswordReset(rawToken) {
  const tokenHash = hashResetToken(rawToken);
  await prisma.passwordResetToken.deleteMany({
    where: { tokenHash },
  });
}

module.exports = {
  createPasswordResetToken,
  findValidPasswordReset,
  consumePasswordReset,
  getResetUrl,
};
