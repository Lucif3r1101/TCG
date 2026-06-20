import nodemailer, { type Transporter } from "nodemailer";

type PasswordResetMailInput = {
  to: string;
  username: string;
  resetToken: string;
  resetPasswordUrl?: string;
};

type MailMessage = {
  subject: string;
  text: string;
  html: string;
};

type MailProvider = "resend" | "smtp";

function buildResetUrl(baseUrl: string | undefined, token: string): string | null {
  if (!baseUrl) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}

// Shared email content, independent of which provider sends it.
function buildResetMessage(input: PasswordResetMailInput): MailMessage {
  const resetUrl = buildResetUrl(input.resetPasswordUrl, input.resetToken);

  const text = [
    `Hi ${input.username},`,
    "",
    "You requested a password reset for Chronicles of the Rift.",
    `Reset token: ${input.resetToken}`,
    resetUrl ? `Reset link: ${resetUrl}` : "",
    "",
    "If you did not request this, you can ignore this email.",
    "Token expires in 30 minutes."
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
      <h2 style="margin:0 0 12px;">Password Reset</h2>
      <p>Hi ${input.username},</p>
      <p>You requested a password reset for <strong>Chronicles of the Rift</strong>.</p>
      <p><strong>Reset token:</strong> ${input.resetToken}</p>
      ${resetUrl ? `<p><a href="${resetUrl}">Open Reset Link</a></p>` : ""}
      <p>If you did not request this, you can ignore this email.</p>
      <p style="color:#6b7280;">Token expires in 30 minutes.</p>
    </div>
  `;

  return { subject: "Reset your Chronicles of the Rift password", text, html };
}

// Decide which provider to use. `MAIL_PROVIDER` forces a choice; otherwise we
// auto-detect: Resend stays primary when its key is set, with SMTP (e.g. Gmail)
// as the fallback for early/no-custom-domain testing.
function resolveProvider(): MailProvider | null {
  const explicit = (process.env.MAIL_PROVIDER || "").trim().toLowerCase();
  if (explicit === "resend") return "resend";
  if (explicit === "smtp") return "smtp";

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return null;
}

async function sendViaResend(to: string, msg: MailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error("Resend not configured (RESEND_API_KEY / EMAIL_FROM missing).");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, subject: msg.subject, text: msg.text, html: msg.html })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Resend email API error:", response.status, body);
    return false;
  }
  return true;
}

let cachedTransport: Transporter | null = null;

// SMTP transport (works with Gmail: host smtp.gmail.com, port 587, an App
// Password as SMTP_PASS). Cached across calls.
function getSmtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (cachedTransport) return cachedTransport;

  const port = Number(process.env.SMTP_PORT || 587);
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Fail fast instead of hanging if the SMTP port is blocked (e.g. Render
    // blocks outbound SMTP — use MAIL_PROVIDER=resend there instead).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
  return cachedTransport;
}

async function sendViaSmtp(to: string, msg: MailMessage): Promise<boolean> {
  const transport = getSmtpTransport();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  if (!transport || !from) {
    console.error("SMTP not configured (SMTP_HOST / EMAIL_FROM|SMTP_USER missing).");
    return false;
  }

  try {
    await transport.sendMail({ from, to, subject: msg.subject, text: msg.text, html: msg.html });
    return true;
  } catch (error) {
    console.error("SMTP email error:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(input: PasswordResetMailInput): Promise<boolean> {
  const provider = resolveProvider();
  if (!provider) {
    // No mail provider configured — caller treats this as "not sent".
    return false;
  }

  const message = buildResetMessage(input);
  return provider === "resend" ? sendViaResend(input.to, message) : sendViaSmtp(input.to, message);
}
