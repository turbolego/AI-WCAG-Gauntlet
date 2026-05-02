document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('myCanvas');
    if (canvas.getContext) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#e8491d';
        ctx.fillRect(10, 10, 150, 80);
    }
    const template = document.getElementById('myTemplate');
    const host = document.getElementById('host');
    const clone = document.importNode(template.content, true);
    host.appendChild(clone);
});