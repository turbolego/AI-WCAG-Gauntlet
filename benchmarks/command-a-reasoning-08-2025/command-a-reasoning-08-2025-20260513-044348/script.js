document.addEventListener('DOMContentLoaded', () => {
    // Basic keyboard navigation enhancement
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                if (target) target.tabIndex = -1;
                if (target) target.focus();
            }
        });
    });
});