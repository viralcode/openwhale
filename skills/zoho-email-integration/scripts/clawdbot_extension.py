#!/usr/bin/env python3
"""
Clawdbot Extension for Zoho Email Integration

This module provides Clawdbot command handlers that integrate Zoho Mail
directly into your Clawdbot messaging workflow (Telegram, Discord, etc).

Usage in Clawdbot:
  /email unread
  /email search invoice
  /email send user@example.com "Subject" "Body text"
  /email summary (brief unread count)
"""

import os
import sys
import json
import subprocess
from pathlib import Path

# Add parent scripts directory to path
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

class ClawdbotEmailExtension:
    """Clawdbot command handler for Zoho Email"""
    
    def __init__(self, token_file=None, verbose=False):
        """
        Initialize the extension
        
        Args:
            token_file: Path to OAuth2 token file (optional)
            verbose: Enable debug output
        """
        self.script_path = SCRIPT_DIR / "zoho_email.py"
        self.token_file = token_file
        self.verbose = verbose
        self.email = os.environ.get('ZOHO_EMAIL', 'unknown')
    
    def run_command(self, *args):
        """
        Execute zoho_email.py command and return result
        
        Args:
            *args: Command arguments (e.g., "unread" or "search", "invoice")
        
        Returns:
            dict: Command output parsed as JSON, or raw output
        """
        cmd = [sys.executable, str(self.script_path)]
        
        # Add token file if provided
        if self.token_file:
            cmd.extend(['--token-file', self.token_file])
        
        # Add verbose flag if enabled
        if self.verbose:
            cmd.append('--verbose')
        
        # Add command arguments
        cmd.extend(args)
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                return {
                    'status': 'error',
                    'message': result.stderr or 'Unknown error'
                }
            
            output = result.stdout.strip()
            
            # Try to parse as JSON
            try:
                return json.loads(output)
            except json.JSONDecodeError:
                # Return raw output if not JSON
                return {
                    'status': 'success',
                    'message': output
                }
        
        except subprocess.TimeoutExpired:
            return {
                'status': 'error',
                'message': 'Command timed out (30s)'
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Failed to execute command: {e}'
            }
    
    def format_unread(self):
        """Get and format unread email count"""
        result = self.run_command('unread')
        
        if result.get('status') == 'error':
            return f"❌ Error: {result.get('message')}"
        
        if isinstance(result, dict) and 'unread_count' in result:
            count = result['unread_count']
            emoji = "📬" if count > 0 else "📭"
            return f"{emoji} **Unread:** {count} message{'s' if count != 1 else ''}"
        
        return "Unable to fetch unread count"
    
    def format_summary(self):
        """Get brief email summary for briefings"""
        result = self.run_command('unread')
        
        if result.get('status') == 'error':
            return f"Email check failed: {result.get('message')}"
        
        if isinstance(result, dict) and 'unread_count' in result:
            count = result['unread_count']
            if count == 0:
                return "📭 No unread emails"
            else:
                return f"📧 {count} unread email{'s' if count != 1 else ''}"
        
        return "Email check unavailable"
    
    def format_search(self, query):
        """Search emails and format results"""
        result = self.run_command('search', query)
        
        if result.get('status') == 'error':
            return f"❌ Search failed: {result.get('message')}"
        
        if isinstance(result, list):
            if not result:
                return f"🔍 No results for '{query}'"
            
            output = f"🔍 **Search results for '{query}':**\n\n"
            for i, email in enumerate(result[:5], 1):  # Limit to 5 for readability
                sender = email.get('from', 'Unknown')
                subject = email.get('subject', '(no subject)')
                output += f"{i}. **{subject}**\n   From: {sender}\n\n"
            
            if len(result) > 5:
                output += f"_... and {len(result) - 5} more results_"
            
            return output
        
        return "Search returned unexpected format"
    
    def format_send_confirmation(self, to, subject):
        """Format confirmation message for sent email"""
        return f"✅ **Email sent**\nTo: {to}\nSubject: {subject}"
    
    def handle_command(self, command, *args):
        """
        Main command handler for Clawdbot
        
        Args:
            command: Email command (unread, search, send, summary, etc)
            *args: Command arguments
        
        Returns:
            str: Formatted response for messaging platform
        """
        if command == 'unread':
            return self.format_unread()
        
        elif command == 'summary':
            return self.format_summary()
        
        elif command == 'search' and args:
            query = ' '.join(args)
            return self.format_search(query)
        
        elif command == 'send' and len(args) >= 3:
            to = args[0]
            subject = args[1]
            body = args[2]
            result = self.run_command('send', to, subject, body)
            
            if result.get('status') == 'error':
                return f"❌ Send failed: {result.get('message')}"
            
            return self.format_send_confirmation(to, subject)
        
        elif command == 'doctor':
            result = self.run_command('doctor')
            return result.get('message', 'Doctor check unavailable')
        
        elif command == 'help':
            return self._get_help_text()
        
        else:
            return f"Unknown command: /email {command}\nType `/email help` for available commands"
    
    def _get_help_text(self):
        """Return help text for available commands"""
        return """📧 **Zoho Email Commands**

`/email unread` - Check unread email count
`/email summary` - Brief unread summary (for briefings)
`/email search <query>` - Search emails by keyword
`/email send <to> <subject> <body>` - Send email
`/email doctor` - Check email setup & connectivity
`/email help` - Show this help

**Examples:**
- `/email unread`
- `/email search invoice`
- `/email send john@example.com "Hello" "Hi John"`

**Setup Required:**
1. Export ZOHO_EMAIL (your email address)
2. Run `python3 scripts/oauth-setup.py` for OAuth2
   OR set ZOHO_PASSWORD for app-password mode"""


def main():
    """CLI entry point for testing"""
    if len(sys.argv) < 2:
        print("Usage: python3 clawdbot_extension.py <command> [args...]")
        print("\nAvailable commands:")
        print("  unread         - Show unread count")
        print("  summary        - Show summary")
        print("  search <query> - Search emails")
        print("  send <to> <subject> <body> - Send email")
        print("  doctor         - Check setup")
        print("  help           - Show help")
        sys.exit(1)
    
    # Initialize extension
    ext = ClawdbotEmailExtension(verbose='--verbose' in sys.argv)
    
    # Parse command
    command = sys.argv[1]
    args = sys.argv[2:] if len(sys.argv) > 2 else ()
    
    # Filter out verbose flag
    args = tuple(a for a in args if a != '--verbose')
    
    # Handle command and print result
    result = ext.handle_command(command, *args)
    print(result)


if __name__ == '__main__':
    main()
