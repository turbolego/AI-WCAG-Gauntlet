// Enhanced accessibility features
(function() {
    'use strict';

    // Polyfill for dialog element
    if (!('showModal' in document.createElement('dialog'))) {
        document.addEventListener('DOMContentLoaded', function() {
            const dialogPolyfill = document.createElement('script');
            dialogPolyfill.src = 'https://cdn.jsdelivr.net/npm/dialog-polyfill@0.5.6/dist/dialog-polyfill.min.js';
            document.head.appendChild(dialogPolyfill);
            dialogPolyfill.onload = function() {
                const dialogs = document.querySelectorAll('dialog');
                dialogs.forEach(function(dialog) {
                    dialogPolyfill.registerDialog(dialog);
                });
            };
        });
    }

    // Trap focus in dialogs
    function trapFocus(element) {
        const focusableEls = element.querySelectorAll(
            'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled])
        ');
        const firstFocusableEl = focusableEls[0];
        const lastFocusableEl = focusableEls[focusableEls.length - 1];
        
        element.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstFocusableEl) {
                    lastFocusableEl.focus();
                    e.preventDefault();
                } else if (!e.shiftKey && document.activeElement === lastFocusableEl) {
                    firstFocusableEl.focus();
                    e.preventDefault();
                }
            }
        });
    }

    // Initialize dialogs
    function initDialogs() {
        const dialogButtons = document.querySelectorAll('button[aria-controls]');
        dialogButtons.forEach(button => {
            const dialogId = button.getAttribute('aria-controls');
            const dialog = document.getElementById(dialogId);
            
            if (dialog && dialog.tagName === 'DIALOG') {
                button.addEventListener('click', () => {
                    dialog.showModal();
                    button.setAttribute('aria-expanded', 'true');
                    trapFocus(dialog);
                });
                
                dialog.addEventListener('close', () => {
                    button.setAttribute('aria-expanded', 'false');
                    button.focus();
                });
            }
        });
    }

    // Live region for dynamic content
    function createLiveRegion() {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);
        return liveRegion;
    }

    // Announce changes to screen readers
    function announce(message) {
        const liveRegion = document.querySelector('[aria-live]') || createLiveRegion();
        liveRegion.textContent = '';
        setTimeout(() => {
            liveRegion.textContent = message;
        }, 100);
    }

    // Initialize form validation
    function initFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', function(e) {
                const requiredInputs = form.querySelectorAll('[aria-required="true"]');
                let isValid = true;
                
                requiredInputs.forEach(input => {
                    if (!input.value.trim()) {
                        isValid = false;
                        input.setAttribute('aria-invalid', 'true');
                        const errorId = input.id + '-error';
                        let errorElement = document.getElementById(errorId);
                        
                        if (!errorElement) {
                            errorElement = document.createElement('div');
                            errorElement.id = errorId;
                            errorElement.className = 'error-message';
                            errorElement.style.color = 'var(--error-color)';
                            input.parentNode.insertBefore(errorElement, input.nextSibling);
                        }
                        
                        errorElement.textContent = 'This field is required';
                    } else {
                        input.setAttribute('aria-invalid', 'false');
                        const errorId = input.id + '-error';
                        const errorElement = document.getElementById(errorId);
                        if (errorElement) {
                            errorElement.textContent = '';
                        }
                    }
                });
                
                if (!isValid) {
                    e.preventDefault();
                    announce('Please fill in all required fields');
                }
            });
        });
    }

    // Initialize range input
    function initRangeInputs() {
        const ranges = document.querySelectorAll('input[type="range"]');
        ranges.forEach(range => {
            const output = document.querySelector(`output[for="${range.id}"]`);
            if (output) {
                range.addEventListener('input', () => {
                    output.textContent = range.value;
                });
            }
        });
    }

    // Initialize template functionality
    function initTemplates() {
        const templateButtons = document.querySelectorAll('button[onclick^="showTemplate"]');
        templateButtons.forEach(button => {
            button.addEventListener('click', () => {
                const templateId = button.getAttribute('data-template') || 'template-example';
                const template = document.getElementById(templateId);
                const outputId = button.getAttribute('data-output') || 'template-output';
                const output = document.getElementById(outputId);
                
                if (template && output) {
                    const clone = template.content.cloneNode(true);
                    output.innerHTML = '';
                    output.appendChild(clone);
                    announce('Template content added');
                }
            });
        });
    }

    // Initialize canvas
    function initCanvas() {
        const canvas = document.getElementById('chart');
        if (canvas && canvas.getContext) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgb(200, 0, 0)';
            ctx.fillRect(10, 10, 50, 50);
            ctx.fillStyle = 'rgba(0, 0, 200, 0.5)';
            ctx.fillRect(30, 30, 50, 50);
            
            // Add ARIA details for the canvas
            const details = document.createElement('details');
            details.innerHTML = `
                <summary>Chart Details</summary>
                <p>This chart shows two overlapping rectangles. The first is a solid red rectangle, and the second is a semi-transparent blue rectangle.</p>
            `;
            canvas.parentNode.insertBefore(details, canvas.nextSibling);
        }
    }

    // Initialize map
    function initMap() {
        const map = document.createElement('map');
        map.name = 'example-map';
        
        const area = document.createElement('area');
        area.shape = 'rect';
        area.coords = '0,0,82,126';
        area.href = '#';
        area.alt = 'Example clickable area';
        area.setAttribute('aria-label', 'Example image map area');
        
        map.appendChild(area);
        document.body.appendChild(map);
    }

    // Initialize all components
    document.addEventListener('DOMContentLoaded', function() {
        initDialogs();
        initFormValidation();
        initRangeInputs();
        initTemplates();
        initCanvas();
        initMap();
        
        // Add ARIA attributes to interactive elements
        const interactiveElements = document.querySelectorAll('button, [role="button"], a, input, select, textarea');
        interactiveElements.forEach(el => {
            if (!el.getAttribute('tabindex')) {
                el.setAttribute('tabindex', '0');
            }
        });
        
        // Add keyboard event handlers
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const dialogs = document.querySelectorAll('dialog[open]');
                dialogs.forEach(dialog => {
                    dialog.close();
                });
            }
        });
    });

    // Expose functions to global scope for testing
    window.accessibilityApp = {
        announce,
        trapFocus
    };
})();