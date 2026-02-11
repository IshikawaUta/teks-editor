// 1. Inisialisasi State & Data Default
let currentTab = 'html';
let editors = {
    html: "<h1>Hello World!</h1>\n<p>Code: By IshikawaUta</p>",
    css: "body {\n  text-align: center;\n  padding-top: 50px;\n  background: #f5f7fa;\n}\nh1 {\n  color: #7d5fff;\n}",
    js: "console.log('Welcome to DevStudio!');"
};

// 2. Konfigurasi CodeMirror
const cmEditor = CodeMirror(document.getElementById("editor-wrapper"), {
    lineNumbers: true,
    theme: "dracula",
    mode: "xml",
    autoCloseBrackets: true,
    lineWrapping: true,
    tabSize: 2
});

// 3. Sistem Konsol (Bridge antara Iframe dan UI)
window.clearConsole = () => {
    document.getElementById("console-logs").innerHTML = "";
};

function appendLog(content, type) {
    const logsContainer = document.getElementById("console-logs");
    const item = document.createElement("div");
    item.className = `log-item log-${type}`;
    item.textContent = `> ${content}`;
    logsContainer.appendChild(item);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Menangkap pesan dari Iframe
window.addEventListener('message', (event) => {
    if (event.data.type === 'log') appendLog(event.data.content, 'info');
    if (event.data.type === 'error') appendLog(event.data.content, 'error');
});

// 4. Load Data (URL > LocalStorage > Default)
function loadAll() {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    
    if (codeParam) {
        try {
            const decoded = JSON.parse(decodeURIComponent(escape(atob(codeParam))));
            editors = decoded;
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch(e) { 
            console.error("Link share tidak valid:", e); 
        }
    } else {
        const saved = localStorage.getItem('devstudio_code');
        if (saved) {
            try {
                editors = JSON.parse(saved);
            } catch(e) { console.error("Error parsing local storage"); }
        }
    }
    cmEditor.setValue(editors[currentTab] || "");
}

// 5. Auto Save
cmEditor.on("change", () => {
    editors[currentTab] = cmEditor.getValue();
    localStorage.setItem('devstudio_code', JSON.stringify(editors));
});

// 6. Fungsi Ganti Tab dengan Animasi Glassmorphism
window.switchTab = function(tab, event) {
    // Update active state pada tombol
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active');
    
    // Trigger Animasi Fade-In Slide
    const wrapper = document.getElementById("editor-wrapper");
    wrapper.classList.remove("editor-animate");
    void wrapper.offsetWidth; // Force reflow
    wrapper.classList.add("editor-animate");
    
    // Switch konten
    currentTab = tab;
    const modes = { html: 'xml', css: 'css', js: 'javascript' };
    cmEditor.setOption("mode", modes[tab]);
    cmEditor.setValue(editors[tab] || "");
    
    // Auto focus ke editor
    setTimeout(() => cmEditor.focus(), 50);
};

// 7. Fungsi Update Preview (Run Code)
function updatePreview() {
    const loading = document.getElementById("loading-overlay");
    const frame = document.getElementById("output-frame");
    
    if (!frame) return;

    loading.classList.remove("hidden");
    loading.style.display = "flex"; 
    
    setTimeout(() => {
        try {
            const frameDoc = frame.contentDocument || frame.contentWindow.document;
            
            const consoleBridge = `
                <script>
                    const _log = console.log;
                    const _error = console.error;
                    console.log = (...args) => {
                        window.parent.postMessage({type: 'log', content: args.join(' ')}, '*');
                        _log.apply(console, args);
                    };
                    console.error = (...args) => {
                        window.parent.postMessage({type: 'error', content: args.join(' ')}, '*');
                        _error.apply(console, args);
                    };
                    window.onerror = (msg) => {
                        window.parent.postMessage({type: 'error', content: msg}, '*');
                    };
                <\/script>
            `;

            const code = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    ${consoleBridge}
                    <style>
                        body { margin: 20px; font-family: sans-serif; }
                        ${editors.css}
                    </style>
                </head>
                <body>
                    ${editors.html}
                    <script>
                        try {
                            ${editors.js}
                        } catch (err) {
                            console.error(err.message);
                        }
                    <\/script>
                </body>
                </html>`;
            
            frameDoc.open();
            frameDoc.write(code);
            frameDoc.close();
        } catch (err) {
            appendLog("System Error: " + err.message, 'error');
        } finally {
            loading.classList.add("hidden");
            loading.style.display = "none";
        }
    }, 400); 
}

// 8. Theme Toggle Logic (Glass Adaptation)
const themeBtn = document.getElementById("theme-toggle");
function setTheme(theme) {
    const isLight = theme === "light";
    document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");
    themeBtn.querySelector("i").className = isLight ? "fas fa-sun" : "fas fa-moon";
    
    // Switch CodeMirror Theme
    cmEditor.setOption("theme", isLight ? "neo" : "dracula");
    
    // Pastikan background editor tetap transparan untuk efek glass
    const cmElement = document.querySelector(".CodeMirror");
    if (cmElement) {
        cmElement.style.backgroundColor = "transparent";
    }
}

themeBtn.addEventListener("click", () => {
    const isCurrentlyLight = document.documentElement.getAttribute("data-theme") === "light";
    const newTheme = isCurrentlyLight ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme-pref", newTheme);
});

// 9. Perbaikan Fitur Fullscreen
document.getElementById("fullscreen-btn").addEventListener("click", function() {
    const previewPanel = document.querySelector(".preview-panel");
    const icon = this.querySelector("i");
    
    previewPanel.classList.toggle("fullscreen-mode");
    
    if (previewPanel.classList.contains("fullscreen-mode")) {
        icon.classList.replace("fa-expand", "fa-compress");
        this.setAttribute("title", "Exit Fullscreen");
    } else {
        icon.classList.replace("fa-compress", "fa-expand");
        this.setAttribute("title", "Enter Fullscreen");
    }
});

// Shortcut Escape untuk keluar Fullscreen
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        const previewPanel = document.querySelector(".preview-panel");
        if (previewPanel.classList.contains("fullscreen-mode")) {
            previewPanel.classList.remove("fullscreen-mode");
            document.querySelector("#fullscreen-btn i").classList.replace("fa-compress", "fa-expand");
        }
    }
});

// 10. Fitur Download, Share, Reset
document.getElementById("download-btn").addEventListener("click", () => {
    const blob = new Blob([document.getElementById("output-frame").contentDocument.documentElement.outerHTML], {type: "text/html"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "devstudio-export.html";
    a.click();
});

document.getElementById("share-btn").addEventListener("click", () => {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(editors))));
    const url = window.location.origin + window.location.pathname + "?code=" + encoded;
    navigator.clipboard.writeText(url);
    alert("Link proyek berhasil disalin!");
});

document.getElementById("reset-btn").addEventListener("click", () => {
    if(confirm("Hapus semua kode dan kembali ke awal?")) {
        localStorage.removeItem('devstudio_code');
        window.location.reload();
    }
});

// 11. Initial Execution
document.addEventListener("DOMContentLoaded", () => {
    // Load data lama atau default
    loadAll();
    
    // Load preferensi tema
    const savedTheme = localStorage.getItem("theme-pref") || "dark";
    setTheme(savedTheme);
    
    // Reset loading state
    const loading = document.getElementById("loading-overlay");
    loading.classList.add("hidden");
    loading.style.display = "none";

    // Jalankan preview pertama kali
    updatePreview();
    
    // Bind tombol Run
    document.getElementById("run-btn").onclick = updatePreview;
});