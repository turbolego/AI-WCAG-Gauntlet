document.addEventListener('DOMContentLoaded', function() {
    // Update current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Form validation
    const form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            if (form.checkValidity()) {
                alert('Form submitted successfully!');
                form.reset();
            } else {
                alert('Please fill in all required fields correctly.');
            }
        });
    }

    // Update rating output
    const ratingInput = document.querySelector('input[type="range"]');
    const ratingOutput = document.querySelector('output[for="rating"]');
    if (ratingInput && ratingOutput) {
        ratingInput.addEventListener('input', function() {
            ratingOutput.value = this.value;
        });
    }

    // Canvas drawing
    const canvas = document.getElementById('example-canvas');
    if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0056b3';
        ctx.fillRect(50, 50, 200, 100);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText('Canvas Example', 70, 110);
    }

    // Dialog example
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
        <h3>Example Dialog</h3>
        <p>This is an example of a dialog element.</p>
        <form method="dialog">
            <button type="submit">Close</button>
        </form>
    `;
    document.body.appendChild(dialog);
    
    const openDialogButton = document.createElement('button');
    openDialogButton.textContent = 'Open Dialog';
    openDialogButton.addEventListener('click', () => dialog.showModal());
    document.querySelector('#introduction article').appendChild(openDialogButton);

    // Template usage
    const template = document.getElementById('example-template');
    if (template) {
        const templateClone = template.content.cloneNode(true);
        document.querySelector('#data article').appendChild(templateClone);
    }

    // Keyboard navigation enhancements
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const dialogs = document.querySelectorAll('dialog[open]');
            dialogs.forEach(dialog => dialog.close());
        }
    });

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

    // Example of dynamic content update
    setTimeout(() => {
        liveRegion.textContent = 'Page loaded successfully';
    }, 1000);

    // Color contrast fix for pa11y report
    const style = document.createElement('style');
    style.textContent = `
        body, p, a, time, button, input, select, textarea {
            color: #333333 !important;
        }
        
        a, button {
            color: #0056b3 !important;
        }
        
        button {
            background-color: #0056b3 !important;
        }
    `;
    document.head.appendChild(style);
});