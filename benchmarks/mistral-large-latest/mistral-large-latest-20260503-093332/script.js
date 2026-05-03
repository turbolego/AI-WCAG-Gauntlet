document.addEventListener('DOMContentLoaded', function() {
    // Improved color contrast for skip link
    const skipLink = document.querySelector('.skip-link');
    skipLink.addEventListener('focus', function() {
        this.style.backgroundColor = '#004494';
    });
    skipLink.addEventListener('blur', function() {
        this.style.backgroundColor = '#0056b3';
    });
    
    // Dialog functionality
    const dialog = document.getElementById('example-dialog');
    const openDialogBtn = document.getElementById('open-dialog');
    const closeDialogBtn = document.getElementById('close-dialog');
    
    openDialogBtn.addEventListener('click', function() {
        dialog.showModal();
        dialog.setAttribute('aria-hidden', 'false');
        closeDialogBtn.focus();
    });
    
    closeDialogBtn.addEventListener('click', function() {
        dialog.close();
        dialog.setAttribute('aria-hidden', 'true');
        openDialogBtn.focus();
    });
    
    // Close dialog on escape key
    dialog.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            dialog.close();
            dialog.setAttribute('aria-hidden', 'true');
            openDialogBtn.focus();
        }
    });
    
    // Toggle menu functionality
    const toggleMenuBtn = document.querySelector('button[aria-expanded]');
    const menu = document.getElementById('menu-content');
    
    toggleMenuBtn.addEventListener('click', function() {
        const expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', !expanded);
        menu.hidden = expanded;
    });
    
    // Update rating output
    const ratingInput = document.getElementById('rating');
    const ratingOutput = document.getElementById('rating-output');
    
    ratingInput.addEventListener('input', function() {
        ratingOutput.textContent = this.value;
    });
    
    // Form validation
    const contactForm = document.getElementById('contact-form');
    
    contactForm.addEventListener('submit', function(event) {
        event.preventDefault();
        alert('Form submitted successfully!');
        this.reset();
    });
    
    // Template demonstration
    const template = document.getElementById('example-template');
    const templateClone = template.content.cloneNode(true);
    const section = document.querySelector('section[aria-labelledby="content-heading"] div');
    section.appendChild(templateClone);
    
    // Iframe accessibility - ensure axe-core is loaded
    const iframe = document.querySelector('iframe');
    iframe.addEventListener('load', function() {
        try {
            const iframeDoc = this.contentDocument || this.contentWindow.document;
            const script = iframeDoc.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/axe-core@4.11.4/axe.min.js';
            script.onload = function() {
                iframe.contentWindow.axe.run(iframeDoc.body, {
                    runOnly: {
                        type: 'tag',
                        values: ['wcag2a', 'wcag2aa', 'best-practice']
                    }
                }, function(err, results) {
                    if (err) console.error('Iframe accessibility check error:', err);
                });
            };
            iframeDoc.head.appendChild(script);
        } catch (e) {
            console.warn('Could not access iframe content:', e);
        }
    });
    
    // Ensure all interactive elements are keyboard accessible
    const interactiveElements = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');
    interactiveElements.forEach(element => {
        element.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                if (this.tagName === 'A' || this.getAttribute('role') === 'button') {
                    event.preventDefault();
                    this.click();
                }
            }
        });
    });
    
    // Live region for dynamic content
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
    
    // Example of using the live region
    setTimeout(() => {
        liveRegion.textContent = 'Page fully loaded and interactive';
    }, 1000);
    
    // Focus management for modal dialogs
    dialog.addEventListener('close', function() {
        const focusableElements = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        dialog.addEventListener('keydown', function trapTabKey(event) {
            if (event.key === 'Tab') {
                if (event.shiftKey && document.activeElement === firstElement) {
                    lastElement.focus();
                    event.preventDefault();
                } else if (!event.shiftKey && document.activeElement === lastElement) {
                    firstElement.focus();
                    event.preventDefault();
                }
            }
        });
    });
    
    // Ensure iframe has a title
    if (!iframe.title) {
        iframe.title = 'Embedded content';
    }
    
    // Audio and video accessibility
    const audioElements = document.querySelectorAll('audio, video');
    audioElements.forEach(audio => {
        audio.addEventListener('play', function() {
            liveRegion.textContent = 'Media started playing';
        });
        audio.addEventListener('pause', function() {
            liveRegion.textContent = 'Media paused';
        });
    });
    
    // Improved focus styles for high contrast mode
    if (window.matchMedia('(prefers-contrast: more)').matches) {
        const style = document.createElement('style');
        style.textContent = `
            :focus {
                outline: 0.2rem solid black !important;
                outline-offset: 0.2rem !important;
            }
        `;
        document.head.appendChild(style);
    }
});