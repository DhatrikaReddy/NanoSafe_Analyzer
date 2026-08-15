"""
auth/email_service.py — NanoSafe Analyzer: Mail Service

Sends OTP codes and password reset links using direct smtplib (SSL/TLS).
Flask-Mail is kept for init_app compatibility but actual sending uses smtplib.
"""

import logging
import smtplib
import ssl
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app
from flask_mail import Mail

logger = logging.getLogger("nanosafe.email")

# Shared Flask-Mail instance (initialised in app_factory.py)
mail = Mail()


def _send_email(to_email: str, subject: str, body_text: str, body_html: str = None) -> bool:
    """Send an email using direct smtplib with SSL. Returns True on success."""
    mail_server   = current_app.config.get("MAIL_SERVER", "")
    mail_port     = int(current_app.config.get("MAIL_PORT", 465))
    mail_user     = current_app.config.get("MAIL_USERNAME", "")
    mail_password = current_app.config.get("MAIL_PASSWORD", "")
    mail_sender   = current_app.config.get("MAIL_DEFAULT_SENDER", mail_user)
    use_ssl       = current_app.config.get("MAIL_USE_SSL", False)
    use_tls       = current_app.config.get("MAIL_USE_TLS", True)

    if not mail_user or not mail_password:
        logger.warning("MAIL_USERNAME or MAIL_PASSWORD not set — cannot send email.")
        return False

    # Build message
    msg = MIMEMultipart("alternative")
    msg["From"]    = mail_sender
    msg["To"]      = to_email
    msg["Subject"] = subject
    msg["Content-Type"] = "text/plain; charset=utf-8"
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        if use_ssl or mail_port == 465:
            # SSL from the start (port 465)
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(mail_server, mail_port, context=context) as server:
                server.login(mail_user, mail_password)
                server.sendmail(mail_user, to_email, msg.as_bytes())
        else:
            # STARTTLS (port 587)
            with smtplib.SMTP(mail_server, mail_port) as server:
                server.ehlo()
                if use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                    server.ehlo()
                server.login(mail_user, mail_password)
                server.sendmail(mail_user, to_email, msg.as_bytes())

        logger.info("Email sent to %s — Subject: %s", to_email, subject)
        return True

    except Exception as exc:
        logger.error("Email send failed to %s: %s\n%s", to_email, exc, traceback.format_exc())
        return False


def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send a 6-digit OTP code to the user's email."""
    subject = "NanoSafe Analyzer — Your Verification Code"

    body_text = (
        f"Hello,\n\n"
        f"Your NanoSafe Analyzer 6-digit verification code is:\n\n"
        f"  {otp_code}\n\n"
        f"This code expires in 10 minutes.\n"
        f"If you did not request this, please ignore this email.\n\n"
        f"— NanoSafe Analyzer Security Team"
    )

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background: #f0fafb; border-radius: 12px;">
        <h2 style="color: #0f766e; margin-top: 0;">NanoSafe Analyzer</h2>
        <p style="color: #334155;">Your verification code is:</p>
        <div style="background: #0f766e; color: white; font-size: 36px; font-weight: 900;
                    letter-spacing: 10px; text-align: center; padding: 18px; border-radius: 10px;
                    font-family: monospace; margin: 20px 0;">
            {otp_code}
        </div>
        <p style="color: #64748b; font-size: 13px;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color: #64748b; font-size: 13px;">If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px;">NanoSafe Analyzer &mdash; ZnO Nanoparticle Safety Research Platform</p>
    </div>
    """

    return _send_email(to_email, subject, body_text, body_html)


def send_verification_email(to_email: str, verification_link: str) -> bool:
    """Send an email verification link."""
    subject   = "NanoSafe Analyzer — Verify your Email"
    body_text = (
        f"Welcome to NanoSafe Analyzer!\n\n"
        f"Please click the link below to verify your email address:\n"
        f"{verification_link}\n\n"
        "If you did not request this, please ignore this email."
    )
    return _send_email(to_email, subject, body_text)


def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """Send a password reset link."""
    subject = "NanoSafe Analyzer — Password Reset Request"

    body_text = (
        f"Hello,\n\n"
        f"You requested to reset your NanoSafe Analyzer password.\n"
        f"Click the link below to set a new password:\n\n"
        f"{reset_link}\n\n"
        "This link expires in 1 hour.\n"
        "If you did not request this, ignore this email."
    )

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background: #f0fafb; border-radius: 12px;">
        <h2 style="color: #0f766e; margin-top: 0;">NanoSafe Analyzer</h2>
        <p style="color: #334155;">You requested a password reset. Click the button below:</p>
        <a href="{reset_link}" style="display: block; background: #0f766e; color: white; text-align: center;
            padding: 14px 24px; border-radius: 10px; text-decoration: none; font-weight: bold;
            font-size: 16px; margin: 20px 0;">Reset My Password</a>
        <p style="color: #64748b; font-size: 13px;">This link expires in <strong>1 hour</strong>.</p>
        <p style="color: #64748b; font-size: 13px;">If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px;">NanoSafe Analyzer &mdash; ZnO Nanoparticle Safety Research Platform</p>
    </div>
    """

    return _send_email(to_email, subject, body_text, body_html)


def send_admin_password_reset(to_email: str, new_password: str) -> bool:
    """Send admin-triggered password reset notification."""
    subject   = "NanoSafe Analyzer — Your Password Has Been Reset"
    body_text = (
        f"Your NanoSafe Analyzer account password has been reset by an administrator.\n\n"
        f"New password: {new_password}\n\n"
        "Please login and change your password immediately."
    )
    return _send_email(to_email, subject, body_text)




