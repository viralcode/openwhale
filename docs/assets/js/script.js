function copyInstall() {
    const cmd = "git clone https://github.com/viralcode/openwhale.git";
    navigator.clipboard.writeText(cmd).then(() => {
        const snippet = document.querySelector('.code-snippet');
        const icon = snippet.querySelector('.fa-copy');

        // Visual feedback
        snippet.style.backgroundColor = "var(--acid-green)";
        snippet.style.color = "#000";
        icon.className = "fas fa-check";
        icon.style.color = "#000";

        setTimeout(() => {
            snippet.style.backgroundColor = "";
            snippet.style.color = "";
            icon.className = "far fa-copy";
            icon.style.color = "";
        }, 1000);
    });
}
