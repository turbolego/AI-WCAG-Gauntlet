// Main application script
document.addEventListener('DOMContentLoaded', function() {
    // Set up contrast checker
    const checkContrastBtn = document.getElementById('check-contrast');
    const contrastResult = document.getElementById('contrast-result');
    const textColorInput = document.getElementById('text-color');
    const bgColorInput = document.getElementById('bg-color');
    
    if (checkContrastBtn && contrastResult && textColorInput && bgColorInput) {
        checkContrastBtn.addEventListener('click', function() {
            const textColor = textColorInput.value;
            const bgColor = bgColorInput.value;
            
            const contrastRatio = calculateContrastRatio(textColor, bgColor);
            const resultClass = getContrastResultClass(contrastRatio);
            
            contrastResult.className = `contrast-result ${resultClass}`;
            contrastResult.innerHTML = `
                <p>Contrast ratio: ${contrastRatio.toFixed(2)}:1</p>
                <p>${getContrastDescription(contrastRatio)}</p>
            `;
        });
    }
    
    // Set up quick contrast checker
    const quickCheckBtn = document.getElementById('quick-contrast-check');
    const quickResult = document.getElementById('quick-contrast-result');
    const color1Input = document.getElementById('color1');
    const color2Input = document.getElementById('color2');
    
    if (quickCheckBtn && quickResult && color1Input && color2Input) {
        quickCheckBtn.addEventListener('click', function() {
            const color1 = color1Input.value;
            const color2 = color2Input.value;
            
            const contrastRatio = calculateContrastRatio(color1, color2);
            const resultClass = getContrastResultClass(contrastRatio);
            
            quickResult.className = `contrast-result ${resultClass}`;
            quickResult.innerHTML = `
                <p>Contrast ratio: ${contrastRatio.toFixed(2)}:1</p>
                <p>${getContrastDescription(contrastRatio)}</p>
            `;
        });
    }
    
    // Set up form validation
    const demoForm = document.getElementById('demo-form');
    if (demoForm) {
        demoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Simple validation feedback
            const name = document.getElementById('name');
            const email = document.getElementById('email');
            const feedback = document.getElementById('feedback');
            
            if (!name.value.trim()) {
                name.setCustomValidity('Please enter your name');
                name.reportValidity();
            } else if (!email.value.trim()) {
                email.setCustomValidity('Please enter your email');
                email.reportValidity();
            } else if (!feedback.value.trim()) {
                feedback.setCustomValidity('Please enter your feedback');
                feedback.reportValidity();
            } else {
                // Form would be submitted here
                alert('Form submitted successfully!');
                demoForm.reset();
            }
        });
    }
    
    // Color input value display
    const contrastValue = document.getElementById('contrast-value');
    const contrastInput = document.getElementById('contrast');
    if (contrastValue && contrastInput) {
        contrastInput.addEventListener('input', function() {
            contrastValue.textContent = contrastInput.value;
        });
    }
    
    // Helper functions for contrast calculation
    function calculateContrastRatio(color1, color2) {
        // Convert hex to RGB
        const rgb1 = hexToRgb(color1);
        const rgb2 = hexToRgb(color2);
        
        if (!rgb1 || !rgb2) return 0;
        
        // Calculate relative luminance
        const l1 = calculateLuminance(rgb1.r, rgb1.g, rgb1.b);
        const l2 = calculateLuminance(rgb2.r, rgb2.g, rgb2.b);
        
        // Calculate contrast ratio
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        
        return (lighter + 0.05) / (darker + 0.05);
    }
    
    function hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse r, g, b values
        let r, g, b;
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return null;
        }
        
        return { r, g, b };
    }
    
    function calculateLuminance(r, g, b) {
        // Convert RGB values to sRGB
        const sr = r / 255;
        const sg = g / 255;
        const sb = b / 255;
        
        // Apply gamma correction
        const rsrgb = sr <= 0.03928 ? sr / 12.92 : Math.pow((sr + 0.055) / 1.055, 2.4);
        const gsrgb = sg <= 0.03928 ? sg / 12.92 : Math.pow((sg + 0.055) / 1.055, 2.4);
        const bsrgb = sb <= 0.03928 ? sb / 12.92 : Math.pow((sb + 0.055) / 1.055, 2.4);
        
        // Calculate relative luminance
        return 0.2126 * rsrgb + 0.7152 * gsrgb + 0.0722 * bsrgb;
    }
    
    function getContrastResultClass(ratio) {
        if (ratio >= 7) return 'contrast-pass';
        if (ratio >= 4.5) return 'contrast-pass';
        if (ratio >= 3) return 'contrast-warning';
        return 'contrast-fail';
    }
    
    function getContrastDescription(ratio) {
        if (ratio >= 7) return 'Excellent contrast - meets AAA standards for all text sizes';
        if (ratio >= 4.5) return 'Good contrast - meets AA standards for normal text';
        if (ratio >= 3) return 'Minimum contrast - meets AA standards for large text only';
        return 'Insufficient contrast - fails accessibility standards';
    }
    
    // Skip link functionality
    const skipLink = document.createElement('a');
    skipLink.href = '#main';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    skipLink.style.position = 'absolute';
    skipLink.style.left = '-9999px';
    skipLink.style.top = '0';
    skipLink.style.backgroundColor = '#f1c40f';
    skipLink.style.color = '#000';
    skipLink.style.padding = '0.5rem 1rem';
    skipLink.style.zIndex = '1000';
    
    skipLink.addEventListener('focus', function() {
        this.style.left = '0';
    });
    
    skipLink.addEventListener('blur', function() {
        this.style.left = '-9999px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Add keyboard navigation support for image map areas
    const mapAreas = document.querySelectorAll('area[tabindex="0"]');
    mapAreas.forEach(area => {
        area.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const link = document.createElement('a');
                link.href = this.href;
                link.click();
            }
        });
    });
    
    // Add keyboard navigation support for buttons
    const buttons = document.querySelectorAll('button, [role="button"]');
    buttons.forEach(button => {
        button.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });
});