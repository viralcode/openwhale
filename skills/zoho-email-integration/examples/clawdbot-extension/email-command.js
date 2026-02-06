/**
 * Clawdbot Skill Command Handler for Zoho Email
 * 
 * This handler integrates the zoho-email skill with Clawdbot's command system,
 * allowing /email commands in Telegram, Discord, and other messaging platforms.
 * 
 * Installation:
 * 1. Copy this file to your Clawdbot skills directory
 * 2. Update your Clawdbot config to include this skill
 * 3. Ensure ZOHO_EMAIL environment variable is set
 * 4. Run oauth-setup.py or set ZOHO_PASSWORD for authentication
 */

const { execSync } = require('child_process');
const path = require('path');

class ZohoEmailSkillHandler {
  constructor(config = {}) {
    this.skillPath = config.skillPath || '/usr/lib/node_modules/openclaw/skills/zoho-email';
    this.tokenFile = config.tokenFile || null;
    this.verbose = config.verbose || false;
  }

  /**
   * Execute a zoho-email command via Python
   * @param {string} command - Command name (unread, search, send, etc)
   * @param {Array<string>} args - Command arguments
   * @returns {Object} Parsed JSON response or text output
   */
  executeCommand(command, args = []) {
    try {
      const scriptPath = path.join(this.skillPath, 'scripts', 'clawdbot_extension.py');
      const cmdArgs = [command, ...args];
      
      if (this.verbose) {
        cmdArgs.push('--verbose');
      }

      const cmd = `python3 "${scriptPath}" ${cmdArgs.map(arg => `"${arg}"`).join(' ')}`;
      const output = execSync(cmd, {
        timeout: 30000,
        encoding: 'utf-8'
      });

      // Try to parse as JSON, fall back to raw output
      try {
        return JSON.parse(output);
      } catch (e) {
        return { status: 'success', message: output.trim() };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Command failed: ${error.message}`
      };
    }
  }

  /**
   * Clawdbot command handler for /email
   * @param {Object} context - Clawdbot message context
   * @param {string} args - Command arguments
   */
  async handleEmailCommand(context, args) {
    const parts = args.trim().split(/\s+/);
    const command = parts[0] || 'help';
    const cmdArgs = parts.slice(1);

    // Route to appropriate handler
    switch (command) {
      case 'unread':
        return this.handleUnread(context);
      
      case 'summary':
        return this.handleSummary(context);
      
      case 'search':
        return this.handleSearch(context, cmdArgs.join(' '));
      
      case 'send':
        return this.handleSend(context, cmdArgs);
      
      case 'doctor':
        return this.handleDoctor(context);
      
      case 'help':
      default:
        return this.handleHelp(context);
    }
  }

  /**
   * Handle /email unread command
   */
  async handleUnread(context) {
    const result = this.executeCommand('unread');
    
    if (result.status === 'error') {
      return context.reply(`❌ Error: ${result.message}`);
    }

    if (result.unread_count !== undefined) {
      const count = result.unread_count;
      const emoji = count > 0 ? '📬' : '📭';
      const message = `${emoji} **Unread:** ${count} message${count !== 1 ? 's' : ''}`;
      return context.reply(message);
    }

    return context.reply('Unable to fetch unread count');
  }

  /**
   * Handle /email summary command (for briefings)
   */
  async handleSummary(context) {
    const result = this.executeCommand('summary');
    
    if (result.status === 'error') {
      return context.reply(`Email check failed: ${result.message}`);
    }

    if (result.message) {
      return context.reply(result.message);
    }

    return context.reply('Email check unavailable');
  }

  /**
   * Handle /email search command
   */
  async handleSearch(context, query) {
    if (!query) {
      return context.reply('❌ Usage: `/email search <query>`');
    }

    const result = this.executeCommand('search', [query]);
    
    if (result.status === 'error') {
      return context.reply(`❌ Search failed: ${result.message}`);
    }

    if (Array.isArray(result) && result.length > 0) {
      let message = `🔍 **Search results for "${query}":**\n\n`;
      
      result.slice(0, 5).forEach((email, i) => {
        const sender = email.from || 'Unknown';
        const subject = email.subject || '(no subject)';
        message += `${i + 1}. **${subject}**\n   From: ${sender}\n\n`;
      });

      if (result.length > 5) {
        message += `_... and ${result.length - 5} more results_`;
      }

      return context.reply(message);
    }

    return context.reply(`🔍 No results for "${query}"`);
  }

  /**
   * Handle /email send command
   */
  async handleSend(context, args) {
    if (args.length < 3) {
      return context.reply('❌ Usage: `/email send <to> <subject> <body>`');
    }

    const [to, subject, body] = args;
    const result = this.executeCommand('send', [to, subject, body]);

    if (result.status === 'error') {
      return context.reply(`❌ Send failed: ${result.message}`);
    }

    return context.reply(`✅ **Email sent**\nTo: ${to}\nSubject: ${subject}`);
  }

  /**
   * Handle /email doctor command (diagnostics)
   */
  async handleDoctor(context) {
    const result = this.executeCommand('doctor');
    
    const output = result.message || JSON.stringify(result, null, 2);
    const message = `🔧 **Email Setup Check:**\n\n\`\`\`\n${output}\n\`\`\``;
    
    return context.reply(message);
  }

  /**
   * Handle /email help command
   */
  async handleHelp(context) {
    const helpText = `📧 **Zoho Email Commands**

\`/email unread\` - Check unread count
\`/email summary\` - Brief unread summary (for briefings)
\`/email search <query>\` - Search emails
\`/email send <to> <subject> <body>\` - Send email
\`/email doctor\` - Check setup & connectivity
\`/email help\` - Show this help

**Examples:**
- \`/email unread\`
- \`/email search invoice\`
- \`/email send john@example.com "Hello" "Hi John"\`

**Setup Required:**
1. Export ZOHO_EMAIL
2. Run oauth-setup.py OR set ZOHO_PASSWORD`;

    return context.reply(helpText);
  }
}

// Export for Clawdbot skill integration
module.exports = {
  ZohoEmailSkillHandler,
  
  // Clawdbot skill entry point
  async handleCommand(context, message) {
    const handler = new ZohoEmailSkillHandler();
    
    // Parse /email command
    if (message.text && message.text.startsWith('/email')) {
      const args = message.text.substring(7).trim(); // Remove '/email '
      return handler.handleEmailCommand(context, args);
    }
  }
};
