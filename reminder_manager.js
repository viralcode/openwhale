#!/usr/bin/env node

/**
 * Reminder Manager Script
 * Handles creating, listing, and managing reminders with WhatsApp notifications
 */

const fs = require('fs');
const path = require('path');

class ReminderManager {
    constructor() {
        this.remindersFile = 'reminders.json';
        this.loadReminders();
    }

    loadReminders() {
        try {
            if (fs.existsSync(this.remindersFile)) {
                const data = fs.readFileSync(this.remindersFile, 'utf8');
                this.reminders = JSON.parse(data);
            } else {
                this.reminders = [];
            }
        } catch (error) {
            console.error('Error loading reminders:', error.message);
            this.reminders = [];
        }
    }

    saveReminders() {
        try {
            fs.writeFileSync(this.remindersFile, JSON.stringify(this.reminders, null, 2));
        } catch (error) {
            console.error('Error saving reminders:', error.message);
        }
    }

    addReminder(title, datetime, description = '', recurring = false) {
        const reminder = {
            id: Date.now().toString(),
            title,
            datetime: new Date(datetime),
            description,
            recurring,
            active: true,
            created: new Date()
        };

        this.reminders.push(reminder);
        this.saveReminders();
        
        console.log(`✅ Reminder added: "${title}" scheduled for ${reminder.datetime.toLocaleString()}`);
        return reminder;
    }

    listReminders(activeOnly = true) {
        const filtered = activeOnly ? this.reminders.filter(r => r.active) : this.reminders;
        
        if (filtered.length === 0) {
            console.log('📝 No reminders found.');
            return [];
        }

        console.log('\n📋 Your Reminders:');
        console.log('==================');
        
        filtered.forEach((reminder, index) => {
            const status = reminder.active ? '🔔' : '✅';
            const date = new Date(reminder.datetime).toLocaleString();
            console.log(`${status} ${index + 1}. ${reminder.title}`);
            console.log(`   📅 ${date}`);
            if (reminder.description) {
                console.log(`   📝 ${reminder.description}`);
            }
            console.log('');
        });

        return filtered;
    }

    getPendingReminders() {
        const now = new Date();
        return this.reminders.filter(reminder => {
            return reminder.active && new Date(reminder.datetime) <= now;
        });
    }

    markCompleted(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (reminder) {
            reminder.active = false;
            this.saveReminders();
            console.log(`✅ Reminder "${reminder.title}" marked as completed`);
        }
    }

    deleteReminder(id) {
        this.reminders = this.reminders.filter(r => r.id !== id);
        this.saveReminders();
        console.log(`🗑️ Reminder deleted`);
    }
}

// CLI Interface
if (require.main === module) {
    const manager = new ReminderManager();
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
🔔 Reminder Manager

Usage:
  node reminder_manager.js add "Title" "YYYY-MM-DD HH:mm" ["Description"]
  node reminder_manager.js list
  node reminder_manager.js pending
  node reminder_manager.js complete <id>
  node reminder_manager.js delete <id>

Examples:
  node reminder_manager.js add "Team Meeting" "2024-02-05 14:00" "Weekly standup"
  node reminder_manager.js add "Doctor Appointment" "2024-02-10 09:30"
        `);
        process.exit(0);
    }

    const command = args[0];

    switch (command) {
        case 'add':
            if (args.length < 3) {
                console.error('❌ Usage: add "title" "datetime" ["description"]');
                process.exit(1);
            }
            manager.addReminder(args[1], args[2], args[3] || '');
            break;

        case 'list':
            manager.listReminders();
            break;

        case 'pending':
            const pending = manager.getPendingReminders();
            if (pending.length > 0) {
                console.log('🔔 Pending Reminders:');
                pending.forEach(r => {
                    console.log(`- ${r.title} (${new Date(r.datetime).toLocaleString()})`);
                });
            } else {
                console.log('✅ No pending reminders');
            }
            break;

        case 'complete':
            if (args[1]) {
                manager.markCompleted(args[1]);
            } else {
                console.error('❌ Usage: complete <id>');
            }
            break;

        case 'delete':
            if (args[1]) {
                manager.deleteReminder(args[1]);
            } else {
                console.error('❌ Usage: delete <id>');
            }
            break;

        default:
            console.error('❌ Unknown command. Use without arguments to see help.');
            process.exit(1);
    }
}

module.exports = ReminderManager;