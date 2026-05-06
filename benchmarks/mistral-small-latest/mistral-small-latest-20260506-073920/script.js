document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('user-form');
    const output = document.getElementById('output');
    const submitBtn = document.getElementById('submit-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    // Set up form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        
        // Create output message
        const outputMessage = `Form submitted successfully!\nName: ${name}\nEmail: ${email}\nMessage: ${message}`;
        
        // Display output
        output.textContent = outputMessage;
        
        // Announce to screen readers
        output.setAttribute('aria-live', 'assertive');
        setTimeout(() => {
            output.setAttribute('aria-live', 'polite');
        }, 1000);
        
        // Focus on output for screen readers
        output.focus();
    });
    
    // Set up reset button
    resetBtn.addEventListener('click', function() {
        form.reset();
        output.textContent = '';
        
        // Return focus to form
        form.elements[0].focus();
    });
    
    // Keyboard support for buttons
    submitBtn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });
    
    resetBtn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            resetBtn.click();
        }
    });
    
    // Form validation feedback
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (!this.checkValidity()) {
                this.setAttribute('aria-invalid', 'true');
                const errorId = this.id + '-error';
                let errorElement = document.getElementById(errorId);
                
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.id = errorId;
                    errorElement.className = 'error-message';
                    errorElement.setAttribute('role', 'alert');
                    this.parentNode.insertBefore(errorElement, this.nextSibling);
                }
                
                errorElement.textContent = this.validationMessage || 'Please fill out this field.';
            } else {
                this.setAttribute('aria-invalid', 'false');
                const errorElement = document.getElementById(this.id + '-error');
                if (errorElement) {
                    errorElement.textContent = '';
                }
            }
        });
    });
});