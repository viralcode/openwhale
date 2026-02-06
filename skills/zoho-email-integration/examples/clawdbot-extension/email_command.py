#!/usr/bin/env python3
"""
Clawdbot Command Handler for Zoho Email

This module provides Clawdbot integration for /email commands.
Drop into your Clawdbot skills directory to enable email commands in all messaging platforms.

Usage in Clawdbot:
  /email unread
  /email search invoice
  /email send user@example.com "Subject" "Body"
  /email doctor
  /email help
"""

import sys
import os
from pathlib import Path

# Import the extension module
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'scripts'))
from clawdbot_extension import ClawdbotEmailExtension


class EmailCommandHandler:
    """Clawdbot command handler for /email"""
    
    def __init__(self):
        """Initialize the handler"""
        self.extension = ClawdbotEmailExtension(verbose=False)
    
    def handle(self, context):
        """
        Main handler for Clawdbot message context
        
        Args:
            context: Clawdbot message context with:
                - message.text: The command text
                - send_reply(message): Method to send reply
        
        Returns:
            Response message string
        """
        try:
            message_text = context.get('text', '') or context.get('message', {}).get('text', '')
            
            if not message_text.startswith('/email'):
                return None
            
            # Parse command: /email <command> [args...]
            parts = message_text.split(None, 2)  # Split on whitespace, max 3 parts
            
            if len(parts) < 2:
                return self.extension.handle_command('help')
            
            command = parts[1]
            args = tuple(parts[2:]) if len(parts) > 2 else ()
            
            # Route to extension handler
            response = self.extension.handle_command(command, *args)
            
            return response
        
        except Exception as e:
            return f"❌ Error: {str(e)}"


def handle_email_command(context):
    """
    Clawdbot skill entry point
    
    Args:
        context: Clawdbot message context
    
    Returns:
        Response message or None if not an email command
    """
    handler = EmailCommandHandler()
    return handler.handle(context)


# Alternative: For Clawdbot CLI-style usage
def main():
    """CLI entry point for testing"""
    if len(sys.argv) < 2:
        print("Email command handler - use with Clawdbot")
        sys.exit(1)
    
    handler = EmailCommandHandler()
    
    # Simulate a message context
    context = {
        'text': ' '.join(sys.argv[1:])
    }
    
    response = handler.handle(context)
    print(response)


if __name__ == '__main__':
    main()
