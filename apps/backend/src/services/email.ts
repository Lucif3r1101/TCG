type PasswordResetMailInput = {
  to: string;
  username: string;
  resetToken: string;
  resetPasswordUrl?: string;
};

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

export async function sendPasswordResetEmail(input: PasswordResetMailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return false;
  }

  const resetUrl = buildResetUrl(input.resetPasswordUrl, input.resetToken);

  const lines = [
    `Hi ${input.username},`,
    "",
    "You requested a password reset for Chronicles of the Rift.",
    `Reset token: ${input.resetToken}`,
    resetUrl ? `Reset link: ${resetUrl}` : "",
    "",
    "If you did not request this, you can ignore this email.",
    "Token expires in 30 minutes."
  ].filter(Boolean);

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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "Reset your Chronicles of the Rift password",
      text: lines.join("\n"),
      html
    })
  });

  return response.ok;
}
