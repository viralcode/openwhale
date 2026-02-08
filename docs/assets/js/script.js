/* Chat Simulation Logic */
const chatContainer = document.querySelector('#chat-container');

const script = [
    { type: 'user', text: "Create an extension to check Bitcoin price every morning." },
    { type: 'ai', text: "Creating 'crypto-morning.ts'..." },
    { type: 'ai', text: "✅ Extension created. Schedule set to 8:00 AM." },
    { type: 'user', text: "Nice. Also scan my iMessages for 'Keynote'." },
    { type: 'ai', text: "Scanning iMessage database..." },
    { type: 'ai', text: "Found 2 messages from 'Mark' about 'Keynote Slides'." },
    { type: 'user', text: "Create a slide deck based on them." },
    { type: 'ai', text: "Using <strong>slides</strong> tool. Generating 'Project_Update.pptx'..." },
    { type: 'ai', text: "✅ Presentation saved to desktop." }
];

let step = 0;

function addMessage(msg) {
    const div = document.createElement('div');
    div.className = `msg ${msg.type}`;
    div.innerHTML = msg.text;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function runChat() {
    if (step >= script.length) {
        setTimeout(() => {
            chatContainer.innerHTML = '';
            step = 0;
            runChat();
        }, 5000);
        return;
    }

    const msg = script[step];
    addMessage(msg);
    step++;
    const delay = msg.type === 'user' ? 800 : 1200;
    setTimeout(runChat, delay);
}

// window.addEventListener('load', () => {
//     setTimeout(runChat, 1000);
// });


/* Copy Command */
function copyInstall() {
    const cmd = "git clone https://github.com/viralcode/openwhale.git";
    navigator.clipboard.writeText(cmd).then(() => {
        const textSpan = document.getElementById('cmd-text');
        const icon = document.querySelector('.code-copy .fa-copy');

        const originalText = textSpan.innerText;

        // Feedback
        textSpan.innerText = "Copied to clipboard!";
        textSpan.style.color = "#2563eb";
        icon.className = "fas fa-check";

        setTimeout(() => {
            textSpan.innerText = originalText;
            textSpan.style.color = "";
            icon.className = "far fa-copy";
        }, 2000);
    });
}
/* App Cycling Logic */
const apps = [
    { id: 'view-terminal', name: 'OpenWhale Local' },
    { id: 'view-whatsapp', name: 'OpenWhale on WhatsApp' },
    { id: 'view-discord', name: 'OpenWhale on Discord' }
];

let currentAppIndex = 0;

function cycleApps() {
    // Hide current
    const currentApp = apps[currentAppIndex];
    document.getElementById(currentApp.id).classList.add('hidden-view');
    document.getElementById(currentApp.id).classList.remove('active-view');

    // Next index
    currentAppIndex = (currentAppIndex + 1) % apps.length;
    const nextApp = apps[currentAppIndex];

    // Show next
    const nextEl = document.getElementById(nextApp.id);
    nextEl.classList.remove('hidden-view');
    nextEl.classList.add('active-view');

    // Update Header Text
    const headerText = document.getElementById('chat-header-text');
    if (headerText) {
        headerText.style.opacity = 0;
        setTimeout(() => {
            headerText.innerText = nextApp.name;
            headerText.style.opacity = 1;
        }, 200);
    }
}

// Start cycling

/* Floating Background Logic */
function initFloatingBackground() {
    const bg = document.getElementById('hero-background');
    if (!bg) return;

    // Add CSS for floating elements if not already present
    // (We will add the CSS in style.css, but this is a safeguard)

    const uses = [
        "Hey, can you organize my folders?",
        "Find me 100 leads for SaaS startups",
        "Book the cheapest flight to NYC next Friday",
        "Monitor my server logs for errors",
        "Scrape all product prices from Amazon",
        "Summarize this 50-page PDF",
        "Check my calendar and reschedule conflicts",
        "Draft a cold email to these 50 CEOs",
        "Log into my bank and export transactions",
        "Watch this YouTube video and give me key takeaways",
        "Design a logo for my coffee shop",
        "Find the best sushi place open now",
        "Automate my daily standup report",
        "Convert this data to a CSV",
        "Research competitors in the AI space",
        "Message all my LinkedIn connections",
        "Turn this blog post into a tweet thread",
        "Debug this Python script",
        "Create a Spotify playlist from this mood",
        "Buy tickets for the concert instantly",
        "Track price drops for the iPhone 16",
        "Generate a weekly SEO report",
        "Sync my Notion tasks to Google Calendar",
        "Find me a freelance designer",
        "Analyze the sentiment of these reviews",
        "Archive my old emails",
        "Verify these email addresses",
        "Create a chart from this Excel sheet",
        "Go through my unread Slack messages",
        "Find me a gift for my mom under $50"
    ];

    // Create 50 floating elements
    for (let i = 0; i < 50; i++) {
        const span = document.createElement('span');
        span.className = 'floating-use';
        span.innerText = uses[Math.floor(Math.random() * uses.length)];

        // Randomize position and animation properties
        const left = Math.random() * 100;
        const duration = 15 + Math.random() * 20; // 15-35s
        const delay = -1 * (Math.random() * 30); // Start mid-animation (-30s to 0s)
        const opacity = 0.03 + Math.random() * 0.05; // 0.03 - 0.08
        const fontSize = 0.8 + Math.random() * 1.5; // 0.8rem - 2.3rem
        const rotation = (Math.random() * 20) - 10; // -10deg to 10deg

        // Apply styles
        span.style.left = `${left}%`;
        span.style.animationDuration = `${duration}s`;
        span.style.animationDelay = `${delay}s`;
        span.style.opacity = opacity;
        span.style.fontSize = `${fontSize}rem`;
        span.style.setProperty('--rotation', `${rotation}deg`);

        bg.appendChild(span);
    }
}

window.addEventListener('load', initFloatingBackground);
