#!/usr/bin/env python3
"""
Send email via SMTP.

Usage:
    python3 send_email.py --to <recipient> --subject <subject> --body <body> [--html] [--attachments file1,file2]

Environment variables (or ~/.smtp_config):
    SMTP_HOST       - SMTP server hostname (e.g., smtp.gmail.com)
    SMTP_PORT       - SMTP server port (default: 587 for TLS, 465 for SSL)
    SMTP_USER       - SMTP username (usually your email)
    SMTP_PASSWORD   - SMTP password or app password
    SMTP_FROM       - From email address (defaults to SMTP_USER)
    SMTP_USE_SSL    - Use SSL instead of TLS (set to 'true' for port 465)
"""

import argparse
import smtplib
import sys
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
import json

def load_config():
    """Load SMTP config from environment or ~/.smtp_config file."""
    config = {}
    config_file = Path.home() / '.smtp_config'
    
    # Try to load from config file
    if config_file.exists():
        try:
            with open(config_file) as f:
                config = json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load {config_file}: {e}", file=sys.stderr)
    
    # Environment variables override config file
    config['host'] = os.getenv('SMTP_HOST', config.get('host'))
    config['port'] = int(os.getenv('SMTP_PORT', config.get('port', 587)))
    config['user'] = os.getenv('SMTP_USER', config.get('user'))
    config['password'] = os.getenv('SMTP_PASSWORD', config.get('password'))
    config['from'] = os.getenv('SMTP_FROM', config.get('from', config.get('user')))
    
    # Handle use_ssl (can be bool from JSON or string from env)
    use_ssl_value = os.getenv('SMTP_USE_SSL', config.get('use_ssl', False))
    if isinstance(use_ssl_value, bool):
        config['use_ssl'] = use_ssl_value
    else:
        config['use_ssl'] = str(use_ssl_value).lower() == 'true'
    
    # Validate required fields
    required = ['host', 'user', 'password']
    missing = [f for f in required if not config.get(f)]
    if missing:
        print(f"Error: Missing required SMTP config: {', '.join(missing)}", file=sys.stderr)
        print(f"Set via environment variables or create {config_file}", file=sys.stderr)
        print(f"Example {config_file}:", file=sys.stderr)
        print(json.dumps({
            "host": "smtp.gmail.com",
            "port": 587,
            "user": "your-email@gmail.com",
            "password": "your-app-password",
            "from": "your-email@gmail.com",
            "use_ssl": False
        }, indent=2), file=sys.stderr)
        sys.exit(1)
    
    return config

def create_message(from_addr, to, subject, body, is_html=False, attachments=None):
    """Create email message."""
    if attachments:
        message = MIMEMultipart()
        message['From'] = from_addr
        message['To'] = to
        message['Subject'] = subject
        
        # Add body
        msg_body = MIMEText(body, 'html' if is_html else 'plain')
        message.attach(msg_body)
        
        # Add attachments
        for filepath in attachments:
            filepath = Path(filepath)
            if not filepath.exists():
                print(f"Warning: Attachment not found: {filepath}", file=sys.stderr)
                continue
            
            with open(filepath, 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
            
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename={filepath.name}')
            message.attach(part)
    else:
        message = MIMEText(body, 'html' if is_html else 'plain')
        message['From'] = from_addr
        message['To'] = to
        message['Subject'] = subject
    
    return message

def send_email(config, message):
    """Send email via SMTP."""
    try:
        if config['use_ssl']:
            # SSL connection (port 465)
            server = smtplib.SMTP_SSL(config['host'], config['port'])
        else:
            # TLS connection (port 587)
            server = smtplib.SMTP(config['host'], config['port'])
            server.starttls()
        
        server.login(config['user'], config['password'])
        server.send_message(message)
        server.quit()
        
        print(f"✓ Email sent successfully to {message['To']}")
        return True
    except Exception as e:
        print(f"Error sending email: {e}", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description='Send email via SMTP')
    parser.add_argument('--to', required=True, help='Recipient email address')
    parser.add_argument('--subject', required=True, help='Email subject')
    parser.add_argument('--body', required=True, help='Email body')
    parser.add_argument('--html', action='store_true', help='Send as HTML email')
    parser.add_argument('--attachments', help='Comma-separated list of attachment file paths')
    
    args = parser.parse_args()
    
    # Load SMTP config
    config = load_config()
    
    # Parse attachments
    attachments = None
    if args.attachments:
        attachments = [p.strip() for p in args.attachments.split(',')]
    
    # Create and send message
    message = create_message(
        from_addr=config['from'],
        to=args.to,
        subject=args.subject,
        body=args.body,
        is_html=args.html,
        attachments=attachments
    )
    
    success = send_email(config, message)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
