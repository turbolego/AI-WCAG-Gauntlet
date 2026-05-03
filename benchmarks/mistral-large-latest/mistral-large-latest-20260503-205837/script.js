document.addEventListener('DOMContentLoaded', function() {
    // Skip link functionality
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
        skipLink.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).focus();
        });
    }

    // Dialog functionality
    const dialog = document.querySelector('dialog');
    if (dialog) {
        const closeButton = dialog.querySelector('button');
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                dialog.close();
            });
        }
    }

    // Form validation
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            let isValid = true;
            const requiredFields = form.querySelectorAll('[required]');
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    field.setAttribute('aria-invalid', 'true');
                    
                    // Create or update error message
                    let errorId = field.getAttribute('aria-errormessage');
                    if (!errorId) {
                        errorId = field.id + '-error';
                        field.setAttribute('aria-errormessage', errorId);
                    }
                    
                    let errorElement = document.getElementById(errorId);
                    if (!errorElement) {
                        errorElement = document.createElement('div');
                        errorElement.id = errorId;
                        errorElement.className = 'error-message';
                        field.parentNode.insertBefore(errorElement, field.nextSibling);
                    }
                    
                    errorElement.textContent = 'This field is required';
                } else {
                    field.setAttribute('aria-invalid', 'false');
                    const errorId = field.getAttribute('aria-errormessage');
                    if (errorId) {
                        const errorElement = document.getElementById(errorId);
                        if (errorElement) {
                            errorElement.textContent = '';
                        }
                    }
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                // Focus on first invalid field
                const firstInvalidField = form.querySelector('[aria-invalid="true"]');
                if (firstInvalidField) {
                    firstInvalidField.focus();
                }
            } else {
                // Form is valid - in a real app, you would submit the form here
                e.preventDefault();
                alert('Form submitted successfully!');
            }
        });
    });

    // Canvas example
    const canvas = document.getElementById('exampleChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#0056b3';
            ctx.fillRect(10, 10, 150, 100);
            ctx.fillStyle = '#cccccc';
            ctx.fillRect(180, 10, 150, 100);
            ctx.fillStyle = '#333333';
            ctx.font = '16px sans-serif';
            ctx.fillText('Example Chart', 10, 180);
        }
    }

    // Template example
    const template = document.getElementById('example-template');
    if (template) {
        const templateContent = template.content.cloneNode(true);
        const target = document.querySelector('main');
        if (target) {
            target.appendChild(templateContent);
        }
    }

    // Keyboard navigation for menu
    const menuItems = document.querySelectorAll('.menu button');
    menuItems.forEach(item => {
        item.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });

    // Focus management for dialog
    if (dialog) {
        dialog.addEventListener('close', function() {
            const trigger = document.querySelector('[aria-haspopup="dialog"]');
            if (trigger) {
                trigger.focus();
            }
        });
    }

    // ARIA live region for dynamic content
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

    // Example of updating live region
    setTimeout(() => {
        liveRegion.textContent = 'Page loaded successfully';
    }, 1000);
});