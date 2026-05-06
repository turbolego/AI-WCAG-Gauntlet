document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('user-form');
    const submitBtn = document.getElementById('submit-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultsDiv = document.getElementById('results');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const ageInput = document.getElementById('age');

    // Set up keyboard support for buttons
    submitBtn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSubmit();
        }
    });

    resetBtn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleReset();
        }
    });

    // Form submission handler
    function handleSubmit() {
        // Validate inputs
        if (!nameInput.value.trim() || !emailInput.value.trim()) {
            resultsDiv.textContent = 'Please fill in all required fields.';
            resultsDiv.setAttribute('aria-live', 'assertive');
            return;
        }

        if (!validateEmail(emailInput.value)) {
            resultsDiv.textContent = 'Please enter a valid email address.';
            resultsDiv.setAttribute('aria-live', 'assertive');
            emailInput.focus();
            return;
        }

        // Create result message
        const ageText = ageInput.value ? `, age ${ageInput.value}` : '';
        const resultMessage = `Thank you, ${nameInput.value}! Your information has been received.${ageText}`;

        resultsDiv.textContent = resultMessage;
        resultsDiv.setAttribute('aria-live', 'polite');

        // Clear form
        form.reset();
        nameInput.focus();
    }

    // Form reset handler
    function handleReset() {
        resultsDiv.textContent = '';
        resultsDiv.setAttribute('aria-live', 'polite');
        nameInput.focus();
    }

    // Email validation helper
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Set up button click handlers
    submitBtn.addEventListener('click', handleSubmit);
    resetBtn.addEventListener('click', handleReset);

    // Set initial focus
    nameInput.focus();

    // Add form submission on Enter key
    form.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            handleSubmit();
        }
    });

    // Add input validation feedback
    nameInput.addEventListener('input', function() {
        if (this.value.trim() === '') {
            this.setAttribute('aria-invalid', 'true');
        } else {
            this.setAttribute('aria-invalid', 'false');
        }
    });

    emailInput.addEventListener('input', function() {
        if (!validateEmail(this.value)) {
            this.setAttribute('aria-invalid', 'true');
        } else {
            this.setAttribute('aria-invalid', 'false');
        }
    });

    // Add visual feedback for required fields
    const requiredInputs = form.querySelectorAll('[aria-required="true"]');
    requiredInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.style.borderColor = '#3498db';
        });
        input.addEventListener('blur', function() {
            this.style.borderColor = '#ddd';
        });
    });
});