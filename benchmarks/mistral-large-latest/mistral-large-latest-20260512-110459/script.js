document.addEventListener('DOMContentLoaded', function() {
    // Set up canvas
    const canvas = document.getElementById('example-canvas');
    if (canvas.getContext) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#3498db';
        ctx.fillRect(50, 50, 300, 100);
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('This is a canvas example', 200, 105);
    }
    
    // Set up range input output
    const rangeInput = document.getElementById('rating');
    const rangeOutput = document.getElementById('rating-output');
    
    if (rangeInput && rangeOutput) {
        rangeInput.addEventListener('input', function() {
            rangeOutput.textContent = this.value;
        });
    }
    
    // Set up dialog
    const openDialogBtn = document.getElementById('open-dialog');
    const closeDialogBtn = document.getElementById('close-dialog');
    const dialog = document.getElementById('example-dialog');
    
    if (openDialogBtn && dialog) {
        openDialogBtn.addEventListener('click', function() {
            dialog.showModal();
        });
    }
    
    if (closeDialogBtn && dialog) {
        closeDialogBtn.addEventListener('click', function() {
            dialog.close();
        });
    }
    
    // Close dialog when clicking outside
    if (dialog) {
        dialog.addEventListener('click', function(event) {
            if (event.target === dialog) {
                dialog.close();
            }
        });
    }
    
    // Form validation
    const form = document.getElementById('example-form');
    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            alert('Form submitted successfully!');
        });
    }
    
    // Add ARIA attributes dynamically
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.setAttribute('aria-current', 'page');
        link.addEventListener('click', function() {
            navLinks.forEach(l => l.removeAttribute('aria-current'));
            this.setAttribute('aria-current', 'page');
        });
    });
    
    // Set initial aria-current for home link
    document.querySelector('.nav-link').setAttribute('aria-current', 'page');
    
    // Add keyboard navigation for menu
    const menuButtons = document.querySelectorAll('.menu button');
    menuButtons.forEach(button => {
        button.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.click();
            }
        });
    });
    
    // Trap focus in dialog when open
    if (dialog) {
        dialog.addEventListener('keydown', function(event) {
            if (event.key === 'Tab') {
                const focusableElements = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (event.shiftKey && document.activeElement === firstElement) {
                    lastElement.focus();
                    event.preventDefault();
                } else if (!event.shiftKey && document.activeElement === lastElement) {
                    firstElement.focus();
                    event.preventDefault();
                }
            }
        });
    }
    
    // Add live region for dynamic content
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.margin = '-1px';
    liveRegion.style.padding = '0';
    liveRegion.style.overflow = 'hidden';
    liveRegion.style.clip = 'rect(0, 0, 0, 0)';
    liveRegion.style.border = '0';
    document.body.appendChild(liveRegion);
    
    // Example of using live region
    function announce(message) {
        liveRegion.textContent = message;
    }
    
    // Announce when dialog opens
    if (openDialogBtn) {
        openDialogBtn.addEventListener('click', function() {
            announce('Dialog opened');
        });
    }
    
    // Announce when dialog closes
    if (closeDialogBtn) {
        closeDialogBtn.addEventListener('click', function() {
            announce('Dialog closed');
        });
    }
    
    // Add focus styles for keyboard users
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Tab') {
            document.body.classList.add('user-is-tabbing');
        }
    });
    
    document.addEventListener('mousedown', function() {
        document.body.classList.remove('user-is-tabbing');
    });
    
    // Add class for focus-visible polyfill
    try {
        if (!('focusVisible' in document.documentElement)) {
            document.body.classList.add('js-focus-visible');
        }
    } catch (e) {
        console.log('Focus visible polyfill not applied');
    }
});