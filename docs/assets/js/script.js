document.addEventListener('DOMContentLoaded', () => {
    // Typing Animation
    const terminal = document.getElementById('typing-terminal');
    if (terminal) {
        const lines = [
            { text: "INITIALIZING OPENWHALE CORE...", delay: 10 },
            { text: "Loading Neural Modules [====================] 100%", delay: 5 },
            { text: ">> Connecting to 8 Providers: OK", delay: 5, class: "highlight" },
            { text: ">> Mounting BrowserOS: OK", delay: 5, class: "highlight" },
            { text: ">> Syncing 6 Channels: WhatsApp, Discord, Telegram... OK", delay: 5 },
            { text: ">> SYSTEM READY. CLONE REPO TO START.", delay: 0, class: "highlight" }
        ];

        setTimeout(() => typeLines(terminal, lines), 500);
    }
});

async function typeLines(terminal, lines) {
    for (let line of lines) {
        const div = document.createElement('div');
        div.className = 'line ' + (line.class || '');
        terminal.appendChild(div);

        if (line.delay > 0) {
            // Hacker typing style
            for (let char of line.text) {
                div.textContent += char;
                await new Promise(r => setTimeout(r, Math.random() * 10 + line.delay));
            }
        } else {
            div.textContent = line.text;
        }
        terminal.scrollTop = terminal.scrollHeight;
        await new Promise(r => setTimeout(r, 100));
    }

    const prompt = document.createElement('div');
    prompt.className = 'line';
    prompt.innerHTML = '> ROOT@OPENWHALE:~$ <span class="blink">_</span>';
    terminal.appendChild(prompt);
}

window.copyInstall = function () {
    const text = "git clone https://github.com/viralcode/openwhale.git";
    navigator.clipboard.writeText(text).then(() => {
        const cmd = document.querySelector('.install-cmd');
        const icon = cmd.querySelector('.copy-icon');
        const original = icon.innerHTML;

        cmd.style.background = '#fff';
        cmd.style.color = '#000';
        icon.innerHTML = '<i class="fas fa-check"></i>';

        setTimeout(() => {
            cmd.style.background = '#000';
            cmd.style.color = '#fff';
            icon.innerHTML = original;
        }, 1000);
    });
};
