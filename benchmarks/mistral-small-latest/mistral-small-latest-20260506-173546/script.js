// Accessibility-focused JavaScript

// DOM ready function
document.addEventListener('DOMContentLoaded', function() {
    // Skip link functionality
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
        skipLink.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.setAttribute('tabindex', '-1');
                targetElement.focus();
            }
        });
    }

    // Form validation with accessible error messages
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            let isValid = true;
            
            // Check required fields
            const requiredFields = this.querySelectorAll('[required]');
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    e.preventDefault();
                    field.setAttribute('aria-invalid', 'true');
                    field.setAttribute('aria-describedby', 'error-' + field.id);
                    
                    // Create error message if it doesn't exist
                    let errorId = 'error-' + field.id;
                    let errorElement = document.getElementById(errorId);
                    if (!errorElement) {
                        errorElement = document.createElement('div');
                        errorElement.id = errorId;
                        errorElement.className = 'error-message';
                        errorElement.setAttribute('role', 'alert');
                        errorElement.setAttribute('aria-live', 'assertive');
                        field.parentNode.insertBefore(errorElement, field.nextSibling);
                    }
                    
                    errorElement.textContent = 'This field is required.';
                    isValid = false;
                } else {
                    field.removeAttribute('aria-invalid');
                    field.removeAttribute('aria-describedby');
                    
                    let errorId = 'error-' + field.id;
                    let errorElement = document.getElementById(errorId);
                    if (errorElement) {
                        errorElement.textContent = '';
                    }
                }
            });
            
            // Check email format
            const emailFields = this.querySelectorAll('input[type="email"]');
            emailFields.forEach(field => {
                if (field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
                    e.preventDefault();
                    field.setAttribute('aria-invalid', 'true');
                    field.setAttribute('aria-describedby', 'error-' + field.id);
                    
                    let errorId = 'error-' + field.id;
                    let errorElement = document.getElementById(errorId);
                    if (!errorElement) {
                        errorElement = document.createElement('div');
                        errorElement.id = errorId;
                        errorElement.className = 'error-message';
                        errorElement.setAttribute('role', 'alert');
                        errorElement.setAttribute('aria-live', 'assertive');
                        field.parentNode.insertBefore(errorElement, field.nextSibling);
                    }
                    
                    errorElement.textContent = 'Please enter a valid email address.';
                    isValid = false;
                }
            });
            
            if (!isValid) {
                // Focus on first invalid field
                const firstInvalid = this.querySelector('[aria-invalid="true"]');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
            }
        });
    });

    // Form reset functionality
    forms.forEach(form => {
        form.addEventListener('reset', function() {
            const errorMessages = this.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.textContent = '';
            });
            
            const invalidFields = this.querySelectorAll('[aria-invalid="true"]');
            invalidFields.forEach(field => {
                field.removeAttribute('aria-invalid');
                field.removeAttribute('aria-describedby');
            });
        });
    });

    // Details element polyfill for older browsers
    if ('open' in document.createElement('details')) {
        // Native support, do nothing
    } else {
        const detailsElements = document.querySelectorAll('details');
        detailsElements.forEach(details => {
            const summary = details.querySelector('summary');
            if (summary) {
                summary.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (details.hasAttribute('open')) {
                        details.removeAttribute('open');
                    } else {
                        details.setAttribute('open', '');
                    }
                });
            }
        });
    }

    // Keyboard navigation enhancements
    document.addEventListener('keydown', function(e) {
        // Trap focus in modal dialogs if implemented
        // This is a placeholder for actual modal implementation
        
        // Handle escape key for closing dialogs/modals
        if (e.key === 'Escape') {
            const openDialogs = document.querySelectorAll('dialog[open]');
            if (openDialogs.length > 0) {
                e.preventDefault();
                openDialogs[0].close();
            }
        }
    });

    // Focus management for interactive elements
    document.addEventListener('focusin', function(e) {
        // Ensure focus is visible
        if (!e.target.hasAttribute('data-focus-visible')) {
            e.target.setAttribute('data-focus-visible', 'true');
        }
    });

    document.addEventListener('focusout', function(e) {
        if (e.target.hasAttribute('data-focus-visible')) {
            e.target.removeAttribute('data-focus-visible');
        }
    });

    // Live region for dynamic content changes
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

    // Form submission feedback
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            announce('Form submitted successfully. Thank you for your feedback.');
        });
    });

    // Check for JavaScript availability
    const noscript = document.querySelector('noscript');
    if (noscript) {
        noscript.style.display = 'none';
    }

    // Dynamic content loading simulation
    setTimeout(() => {
        // Simulate loading additional content
        const dynamicSection = document.getElementById('feedback');
        if (dynamicSection) {
            const newContent = document.createElement('div');
            newContent.className = 'dynamic-content';
            newContent.setAttribute('aria-live', 'polite');
            newContent.innerHTML = '<p>Additional feedback options have been loaded dynamically.</p>';
            dynamicSection.appendChild(newContent);
            announce('Additional feedback options loaded.');
        }
    }, 2000);

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
        document.body.style.animationDuration = '0.01ms';
        document.body.style.animationIterationCount = '1';
    }

    // Check for color scheme preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (darkModeQuery.matches) {
        document.documentElement.style.setProperty('--background-color', '#121212');
        document.documentElement.style.setProperty('--text-color', '#f0f0f0');
        document.documentElement.style.setProperty('--heading-color', '#ffffff');
        document.documentElement.style.setProperty('--border-color', '#444');
        document.documentElement.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)');
    }

    // Accessibility audit function
    function runAccessibilityAudit() {
        const results = {
            passed: [],
            warnings: [],
            failed: []
        };

        // Check for landmark roles
        const landmarks = document.querySelectorAll('[role="banner"], [role="navigation"], [role="main"], [role="contentinfo"]');
        if (landmarks.length >= 4) {
            results.passed.push('Sufficient landmark roles present');
        } else {
            results.failed.push('Insufficient landmark roles (expected at least 4)');
        }

        // Check heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length > 0) {
            results.passed.push('Heading elements present');
        } else {
            results.failed.push('No heading elements found');
        }

        // Check for skip link
        const skipLink = document.querySelector('.skip-link');
        if (skipLink) {
            results.passed.push('Skip link present');
        } else {
            results.failed.push('Skip link missing');
        }

        // Check for focus indicators
        const focusableElements = document.querySelectorAll('a, button, input, select, textarea');
        let hasFocusStyles = true;
        focusableElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            if (computedStyle.outlineStyle === 'none' && !el.classList.contains('skip-link')) {
                hasFocusStyles = false;
            }
        });

        if (hasFocusStyles) {
            results.passed.push('Focus indicators present');
        } else {
            results.warnings.push('Some focus indicators may be missing');
        }

        // Check for alt text on images
        const images = document.querySelectorAll('img');
        let allImagesHaveAlt = true;
        images.forEach(img => {
            if (!img.alt || img.alt.trim() === '') {
                allImagesHaveAlt = false;
            }
        });

        if (allImagesHaveAlt) {
            results.passed.push('All images have alt text');
        } else {
            results.failed.push('Some images missing alt text');
        }

        // Log results to console
        console.group('Accessibility Audit Results');
        console.log('Passed:', results.passed);
        if (results.warnings.length > 0) console.warn('Warnings:', results.warnings);
        if (results.failed.length > 0) console.error('Failed:', results.failed);
        console.groupEnd();

        return results;
    }

    // Run audit on page load
    window.addEventListener('load', runAccessibilityAudit);

    // Run audit periodically
    setInterval(runAccessibilityAudit, 30000);

    // Announce page load
    window.addEventListener('load', function() {
        announce('Page loaded successfully. Welcome to the accessible web application.');
    });

    // Handle window resize for responsive adjustments
    window.addEventListener('resize', function() {
        // Placeholder for responsive adjustments
    });

    // Check for touch devices and adjust hover behaviors
    if ('ontouchstart' in window) {
        document.documentElement.classList.add('touch-device');
    }

    // Enhance data tables with sorting functionality
    const sortableTables = document.querySelectorAll('table[aria-label]');
    sortableTables.forEach(table => {
        const headers = table.querySelectorAll('th[scope="col"]');
        headers.forEach((header, index) => {
            header.setAttribute('tabindex', '0');
            header.setAttribute('role', 'button');
            header.setAttribute('aria-label', `Sort column ${header.textContent}`);
            
            header.addEventListener('click', function() {
                sortTable(table, index);
            });
            
            header.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sortTable(table, index);
                }
            });
        });
    });

    function sortTable(table, columnIndex) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const header = table.querySelectorAll('th[scope="col"]')[columnIndex];
        const isAscending = header.getAttribute('aria-sort') !== 'ascending';
        
        // Reset all headers
        table.querySelectorAll('th[scope="col"]').forEach(h => {
            h.removeAttribute('aria-sort');
        });
        
        // Set current header sort state
        header.setAttribute('aria-sort', isAscending ? 'ascending' : 'descending');
        
        rows.sort((a, b) => {
            const aValue = a.cells[columnIndex].textContent.trim();
            const bValue = b.cells[columnIndex].textContent.trim();
            
            // Numeric comparison
            const aNum = parseFloat(aValue);
            const bNum = parseFloat(bValue);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return isAscending ? aNum - bNum : bNum - aNum;
            }
            
            // String comparison
            return isAscending 
                ? aValue.localeCompare(bValue) 
                : bValue.localeCompare(aValue);
        });
        
        // Re-append sorted rows
        rows.forEach(row => tbody.appendChild(row));
        
        announce(`Table sorted by ${header.textContent} in ${isAscending ? 'ascending' : 'descending'} order`);
    }

    // Enhance form controls with custom validation messages
    const formControls = document.querySelectorAll('input, textarea, select');
    formControls.forEach(control => {
        control.addEventListener('invalid', function(e) {
            if (!this.validity.valid) {
                this.setAttribute('aria-invalid', 'true');
                
                let errorMessage = '';
                if (this.validity.valueMissing) {
                    errorMessage = 'This field is required.';
                } else if (this.validity.typeMismatch) {
                    if (this.type === 'email') {
                        errorMessage = 'Please enter a valid email address.';
                    }
                } else if (this.validity.patternMismatch) {
                    errorMessage = 'Please match the requested format.';
                } else if (this.validity.tooShort) {
                    errorMessage = `Please use at least ${this.minLength} characters.`;
                } else if (this.validity.rangeUnderflow) {
                    errorMessage = `Please enter a value greater than or equal to ${this.min}.`;
                } else if (this.validity.rangeOverflow) {
                    errorMessage = `Please enter a value less than or equal to ${this.max}.`;
                }
                
                this.setAttribute('aria-describedby', 'error-' + this.id);
                
                let errorId = 'error-' + this.id;
                let errorElement = document.getElementById(errorId);
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.id = errorId;
                    errorElement.className = 'error-message';
                    errorElement.setAttribute('role', 'alert');
                    errorElement.setAttribute('aria-live', 'assertive');
                    this.parentNode.insertBefore(errorElement, this.nextSibling);
                }
                
                errorElement.textContent = errorMessage;
            }
        });
        
        control.addEventListener('input', function() {
            if (this.validity.valid) {
                this.removeAttribute('aria-invalid');
                this.removeAttribute('aria-describedby');
                
                let errorId = 'error-' + this.id;
                let errorElement = document.getElementById(errorId);
                if (errorElement) {
                    errorElement.textContent = '';
                }
            }
        });
    });

    // Enhance interactive elements with keyboard support
    const interactiveElements = document.querySelectorAll('[tabindex="0"]');
    interactiveElements.forEach(el => {
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (this.tagName === 'BUTTON' || this.tagName === 'A') {
                    this.click();
                }
            }
        });
    });

    // Check for preferred reading direction
    const rtlElements = document.querySelectorAll('[dir="rtl"]');
    if (rtlElements.length > 0) {
        document.documentElement.dir = 'rtl';
    }

    // Enhance navigation with keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+Shift+F: Focus search
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            const searchInput = document.querySelector('input[type="search"]');
            if (searchInput) {
                searchInput.focus();
                announce('Search field focused');
            }
        }
        
        // Ctrl+Shift+N: Focus main navigation
        if (e.ctrlKey && e.shiftKey && e.key === 'N') {
            e.preventDefault();
            const nav = document.querySelector('nav[aria-label]');
            if (nav) {
                nav.focus();
                announce('Main navigation focused');
            }
        }
    });

    // Check for high contrast mode
    const highContrastMedia = window.matchMedia('(forced-colors: active)');
    if (highContrastMedia.matches) {
        document.documentElement.classList.add('high-contrast');
    }

    // Enhance video and audio controls with keyboard shortcuts
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(media => {
        media.setAttribute('controls', 'controls');
        
        // Add keyboard shortcuts for media playback
        media.addEventListener('keydown', function(e) {
            if (e.key === ' ') {
                e.preventDefault();
                if (media.paused) {
                    media.play();
                    announce('Media playback started');
                } else {
                    media.pause();
                    announce('Media playback paused');
                }
            } else if (e.key === 'ArrowRight') {
                media.currentTime += 5;
                announce(`Seek forward 5 seconds. Current time: ${Math.floor(media.currentTime)} seconds`);
            } else if (e.key === 'ArrowLeft') {
                media.currentTime = Math.max(0, media.currentTime - 5);
                announce(`Seek backward 5 seconds. Current time: ${Math.floor(media.currentTime)} seconds`);
            } else if (e.key === 'ArrowUp') {
                media.volume = Math.min(1, media.volume + 0.1);
                announce(`Volume increased to ${Math.round(media.volume * 100)} percent`);
            } else if (e.key === 'ArrowDown') {
                media.volume = Math.max(0, media.volume - 0.1);
                announce(`Volume decreased to ${Math.round(media.volume * 100)} percent`);
            }
        });
    });

    // Check for reduced data preference
    const reducedDataMedia = window.matchMedia('(prefers-reduced-data: reduce)');
    if (reducedDataMedia.matches) {
        // Disable autoplay for media
        mediaElements.forEach(media => {
            media.removeAttribute('autoplay');
        });
        
        announce('Reduced data mode detected. Autoplay disabled for media elements.');
    }

    // Check for reduced transparency preference
    const reducedTransparencyMedia = window.matchMedia('(prefers-reduced-transparency: reduce)');
    if (reducedTransparencyMedia.matches) {
        document.documentElement.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.1)');
    }

    // Check for scripting preference
    const noScriptMedia = window.matchMedia('(scripting: none)');
    if (noScriptMedia.matches) {
        const noscriptElements = document.querySelectorAll('noscript');
        noscriptElements.forEach(el => {
            el.style.display = 'block';
        });
    }

    // Enhance interactive map with keyboard navigation
    const mapAreas = document.querySelectorAll('area');
    mapAreas.forEach(area => {
        area.setAttribute('tabindex', '0');
        area.setAttribute('role', 'button');
        area.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const href = this.getAttribute('href');
                if (href) {
                    window.location.href = href;
                }
            }
        });
    });

    // Check for pointer precision preference
    const coarsePointerMedia = window.matchMedia('(pointer: coarse)');
    if (coarsePointerMedia.matches) {
        document.documentElement.classList.add('coarse-pointer');
    }

    // Check for hover capability
    const hoverMedia = window.matchMedia('(hover: hover)');
    if (!hoverMedia.matches) {
        document.documentElement.classList.add('no-hover');
    }

    // Enhance dialog elements if they exist
    const dialogs = document.querySelectorAll('dialog');
    dialogs.forEach(dialog => {
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close dialog';
        closeButton.style.position = 'absolute';
        closeButton.style.right = '10px';
        closeButton.style.top = '10px';
        closeButton.addEventListener('click', () => dialog.close());
        dialog.appendChild(closeButton);
        
        dialog.addEventListener('close', function() {
            announce('Dialog closed');
        });
    });

    // Check for viewport segment preference
    const viewportSegmentMedia = window.matchMedia('(view-mode: segment)');
    if (viewportSegmentMedia.matches) {
        // Adjust layout for segmented display
        document.documentElement.classList.add('segmented-view');
    }

    // Check for forced colors mode
    const forcedColorsMedia = window.matchMedia('(forced-colors: active)');
    if (forcedColorsMedia.matches) {
        document.documentElement.classList.add('forced-colors');
    }

    // Check for inverted colors preference
    const invertedColorsMedia = window.matchMedia('(inverted-colors: inverted)');
    if (invertedColorsMedia.matches) {
        document.documentElement.classList.add('inverted-colors');
    }

    // Check for monochrome preference
    const monochromeMedia = window.matchMedia('(monochrome: 1)');
    if (monochromeMedia.matches) {
        document.documentElement.classList.add('monochrome');
    }

    // Check for color-gamut preference
    const wideGamutMedia = window.matchMedia('(color-gamut: p3)');
    if (wideGamutMedia.matches) {
        document.documentElement.classList.add('wide-gamut');
    }

    // Check for dynamic range preference
    const hdrMedia = window.matchMedia('(dynamic-range: high)');
    if (hdrMedia.matches) {
        document.documentElement.classList.add('hdr');
    }

    // Check for color-index preference
    const colorIndexMedia = window.matchMedia('(color-index: 256)');
    if (colorIndexMedia.matches) {
        document.documentElement.classList.add('limited-colors');
    }

    // Check for resolution preference
    const resolutionMedia = window.matchMedia('(resolution: 192dpi)');
    if (resolutionMedia.matches) {
        document.documentElement.classList.add('high-resolution');
    }

    // Check for video color volume preference
    const videoColorVolumeMedia = window.matchMedia('(video-color-volume: high)');
    if (videoColorVolumeMedia.matches) {
        document.documentElement.classList.add('high-video-volume');
    }

    // Check for video dynamic range preference
    const videoDynamicRangeMedia = window.matchMedia('(video-dynamic-range: high)');
    if (videoDynamicRangeMedia.matches) {
        document.documentElement.classList.add('high-video-dynamic-range');
    }
});