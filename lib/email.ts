import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"SkillLoop" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Verify your SkillLoop email",
    html: `
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;border-radius:16px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#38bdf8;font-size:28px;margin:0;">SkillLoop</h1>
          <p style="color:#94a3b8;font-size:14px;margin-top:8px;">AI-Powered Learning Platform</p>
        </div>
        <div style="background:#1e293b;border-radius:12px;padding:32px;text-align:center;">
          <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 16px;">Welcome! Verify your email</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Click the button below to verify your email address and start your learning journey.
          </p>
          <a href="${verifyUrl}"
             style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#0ea5e9,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;">
            Verify Email
          </a>
          <p style="color:#64748b;font-size:12px;margin-top:24px;">
            This link expires in 24 hours. If you didn't create an account, ignore this email.
          </p>
        </div>
      </div>
    `,
  });
}
