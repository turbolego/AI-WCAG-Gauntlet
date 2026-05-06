// Enhanced accessibility features
(function() {
    'use strict';
    
    // Set language attribute if not already set
    if (!document.documentElement.lang) {
        document.documentElement.lang = 'en';
    }
    
    // Add ARIA live region for dynamic content
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
    
    // Function to announce dynamic content
    function announce(message) {
        liveRegion.textContent = message;
    }
    
    // Skip link functionality
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
        skipLink.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.setAttribute('tabindex', '-1');
                target.focus();
                // Remove the tabindex after focus to maintain accessibility tree
                setTimeout(() => {
                    target.removeAttribute('tabindex');
                }, 1000);
            }
        });
    }
    
    // Range input output update
    const rangeInputs = document.querySelectorAll('input[type="range"]');
    rangeInputs.forEach(input => {
        const output = document.querySelector(`output[for="${input.id}"]`);
        if (output) {
            input.addEventListener('input', function() {
                output.value = this.value;
                announce(`Rating changed to ${this.value}`);
            });
        }
    });
    
    // Form validation
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            let isValid = true;
            const requiredInputs = this.querySelectorAll('[required]');
            
            requiredInputs.forEach(input => {
                if (!input.value.trim()) {
                    isValid = false;
                    input.setAttribute('aria-invalid', 'true');
                    const errorId = `${input.id}-error`;
                    let errorElement = document.getElementById(errorId);
                    
                    if (!errorElement) {
                        errorElement = document.createElement('div');
                        errorElement.id = errorId;
                        errorElement.className = 'error-message';
                        errorElement.setAttribute('aria-live', 'assertive');
                        input.parentNode.insertBefore(errorElement, input.nextSibling);
                    }
                    
                    errorElement.textContent = 'This field is required';
                } else {
                    input.setAttribute('aria-invalid', 'false');
                    const errorId = `${input.id}-error`;
                    const errorElement = document.getElementById(errorId);
                    if (errorElement) {
                        errorElement.textContent = '';
                    }
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                announce('Please fill in all required fields');
                const firstInvalid = this.querySelector('[aria-invalid="true"]');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
            } else {
                announce('Form submitted successfully');
            }
        });
    });
    
    // Canvas drawing with accessibility
    const canvas = document.getElementById('sample-canvas');
    if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(50, 50, 200, 100);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Canvas Drawing', 150, 105);
        ctx.fillStyle = '#FFC107';
        ctx.beginPath();
        ctx.arc(100, 100, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(200, 100, 30, 0, Math.PI * 2);
        ctx.fill();
        
        // Add ARIA details for canvas
        const canvasDetails = document.createElement('details');
        canvasDetails.innerHTML = `
            <summary>Canvas Description</summary>
            <p>This canvas displays a green rectangle with the text 'Canvas Drawing'. 
            There are two circles: a yellow circle on the left and a blue circle on the right.</p>
        `;
        canvas.parentNode.insertBefore(canvasDetails, canvas.nextSibling);
    }
    
    // Dialog functionality
    const dialogContainer = document.getElementById('dialog-container');
    if (dialogContainer) {
        const template = document.getElementById('sample-template');
        if (template) {
            const templateContent = template.content.cloneNode(true);
            
            const dialog = document.createElement('dialog');
            dialog.setAttribute('aria-labelledby', 'dialog-title');
            dialog.setAttribute('aria-describedby', 'dialog-description');
            dialog.innerHTML = `
                <h4 id="dialog-title">Sample Dialog</h4>
                <div id="dialog-description">
                    <p>This is a sample dialog created with JavaScript.</p>
                </div>
                <button id="close-dialog" aria-label="Close dialog">Close</button>
            `;
            
            dialog.querySelector('#dialog-description').appendChild(templateContent);
            dialogContainer.appendChild(dialog);
            
            const openDialogButton = document.createElement('button');
            openDialogButton.textContent = 'Open Dialog';
            openDialogButton.addEventListener('click', () => {
                dialog.showModal();
                announce('Dialog opened');
            });
            
            const closeDialogButton = dialog.querySelector('#close-dialog');
            closeDialogButton.addEventListener('click', () => {
                dialog.close();
                announce('Dialog closed');
            });
            
            // Close dialog when clicking outside
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.close();
                    announce('Dialog closed');
                }
            });
            
            // Add open dialog button to the page
            const mediaSection = document.getElementById('media');
            if (mediaSection) {
                mediaSection.appendChild(openDialogButton);
            }
        }
    }
    
    // Add table with all HTML5 tags for demonstration
    const contentSection = document.getElementById('content');
    if (contentSection) {
        const tableContainer = document.createElement('section');
        tableContainer.innerHTML = `
            <h5>HTML5 Tags Reference</h5>
            <table>
                <caption>HTML5 Tags Used in This Document</caption>
                <thead>
                    <tr>
                        <th scope="col">Tag</th>
                        <th scope="col">Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>&lt;a&gt;</td><td>Defines a hyperlink</td></tr>
                    <tr><td>&lt;abbr&gt;</td><td>Defines an abbreviation or acronym</td></tr>
                    <tr><td>&lt;address&gt;</td><td>Defines contact information for the author/owner of a document</td></tr>
                    <tr><td>&lt;area&gt;</td><td>Defines an area inside an image map</td></tr>
                    <tr><td>&lt;article&gt;</td><td>Defines an article</td></tr>
                    <tr><td>&lt;aside&gt;</td><td>Defines content aside from the page content</td></tr>
                    <tr><td>&lt;audio&gt;</td><td>Defines embedded sound content</td></tr>
                    <tr><td>&lt;b&gt;</td><td>Defines bold text</td></tr>
                    <tr><td>&lt;base&gt;</td><td>Specifies the base URL/target for all relative URLs in a document</td></tr>
                    <tr><td>&lt;bdi&gt;</td><td>Isolates a part of text that might be formatted in a different direction from other text</td></tr>
                    <tr><td>&lt;bdo&gt;</td><td>Overrides the current text direction</td></tr>
                    <tr><td>&lt;blockquote&gt;</td><td>Defines a section that is quoted from another source</td></tr>
                    <tr><td>&lt;body&gt;</td><td>Defines the document's body</td></tr>
                    <tr><td>&lt;br&gt;</td><td>Defines a single line break</td></tr>
                    <tr><td>&lt;button&gt;</td><td>Defines a clickable button</td></tr>
                    <tr><td>&lt;canvas&gt;</td><td>Used to draw graphics, on the fly, via scripting</td></tr>
                    <tr><td>&lt;caption&gt;</td><td>Defines a table caption</td></tr>
                    <tr><td>&lt;cite&gt;</td><td>Defines the title of a creative work</td></tr>
                    <tr><td>&lt;code&gt;</td><td>Defines a piece of computer code</td></tr>
                    <tr><td>&lt;col&gt;</td><td>Specifies column properties for each column within a &lt;colgroup&gt; element</td></tr>
                    <tr><td>&lt;colgroup&gt;</td><td>Specifies a group of one or more columns in a table for formatting</td></tr>
                    <tr><td>&lt;data&gt;</td><td>Links the given content with a machine-readable translation</td></tr>
                    <tr><td>&lt;datalist&gt;</td><td>Specifies a list of pre-defined options for input controls</td></tr>
                    <tr><td>&lt;dd&gt;</td><td>Defines a description/value of a term in a description list</td></tr>
                    <tr><td>&lt;del&gt;</td><td>Defines text that has been deleted from a document</td></tr>
                    <tr><td>&lt;details&gt;</td><td>Defines additional details that the user can view or hide</td></tr>
                    <tr><td>&lt;dfn&gt;</td><td>Specifies a term that is going to be defined within the content</td></tr>
                    <tr><td>&lt;dialog&gt;</td><td>Defines a dialog box or window</td></tr>
                    <tr><td>&lt;div&gt;</td><td>Defines a division or a section in a document</td></tr>
                    <tr><td>&lt;dl&gt;</td><td>Defines a description list</td></tr>
                    <tr><td>&lt;dt&gt;</td><td>Defines a term/name in a description list</td></tr>
                    <tr><td>&lt;em&gt;</td><td>Defines emphasized text</td></tr>
                    <tr><td>&lt;embed&gt;</td><td>Defines a container for an external application</td></tr>
                    <tr><td>&lt;fieldset&gt;</td><td>Groups related elements in a form</td></tr>
                    <tr><td>&lt;figcaption&gt;</td><td>Defines a caption for a &lt;figure&gt; element</td></tr>
                    <tr><td>&lt;figure&gt;</td><td>Specifies self-contained content</td></tr>
                    <tr><td>&lt;footer&gt;</td><td>Defines a footer for a document or section</td></tr>
                    <tr><td>&lt;form&gt;</td><td>Defines an HTML form for user input</td></tr>
                    <tr><td>&lt;h1&gt; to &lt;h6&gt;</td><td>Defines HTML headings</td></tr>
                    <tr><td>&lt;head&gt;</td><td>Contains metadata/information for the document</td></tr>
                    <tr><td>&lt;header&gt;</td><td>Defines a header for a document or section</td></tr>
                    <tr><td>&lt;hgroup&gt;</td><td>Groups heading elements</td></tr>
                    <tr><td>&lt;hr&gt;</td><td>Defines a thematic change in the content</td></tr>
                    <tr><td>&lt;html&gt;</td><td>Defines the root of an HTML document</td></tr>
                    <tr><td>&lt;i&gt;</td><td>Defines a part of text in an alternate voice or mood</td></tr>
                    <tr><td>&lt;iframe&gt;</td><td>Defines an inline frame</td></tr>
                    <tr><td>&lt;img&gt;</td><td>Defines an image</td></tr>
                    <tr><td>&lt;input&gt;</td><td>Defines an input control</td></tr>
                    <tr><td>&lt;ins&gt;</td><td>Defines a text that has been inserted into a document</td></tr>
                    <tr><td>&lt;kbd&gt;</td><td>Defines keyboard input</td></tr>
                    <tr><td>&lt;label&gt;</td><td>Defines a label for an &lt;input&gt; element</td></tr>
                    <tr><td>&lt;legend&gt;</td><td>Defines a caption for a &lt;fieldset&gt; element</td></tr>
                    <tr><td>&lt;li&gt;</td><td>Defines a list item</td></tr>
                    <tr><td>&lt;link&gt;</td><td>Defines the relationship between a document and an external resource</td></tr>
                    <tr><td>&lt;main&gt;</td><td>Specifies the main content of a document</td></tr>
                    <tr><td>&lt;map&gt;</td><td>Defines a client-side image map</td></tr>
                    <tr><td>&lt;mark&gt;</td><td>Defines marked/highlighted text</td></tr>
                    <tr><td>&lt;menu&gt;</td><td>Defines a list/menu of commands</td></tr>
                    <tr><td>&lt;meta&gt;</td><td>Defines metadata about an HTML document</td></tr>
                    <tr><td>&lt;meter&gt;</td><td>Defines a scalar measurement within a known range</td></tr>
                    <tr><td>&lt;nav&gt;</td><td>Defines navigation links</td></tr>
                    <tr><td>&lt;noscript&gt;</td><td>Defines an alternate content for users that do not support client-side scripts</td></tr>
                    <tr><td>&lt;object&gt;</td><td>Defines an embedded object</td></tr>
                    <tr><td>&lt;ol&gt;</td><td>Defines an ordered list</td></tr>
                    <tr><td>&lt;optgroup&gt;</td><td>Defines a group of related options in a drop-down list</td></tr>
                    <tr><td>&lt;option&gt;</td><td>Defines an option in a drop-down list</td></tr>
                    <tr><td>&lt;output&gt;</td><td>Defines the result of a calculation</td></tr>
                    <tr><td>&lt;p&gt;</td><td>Defines a paragraph</td></tr>
                    <tr><td>&lt;param&gt;</td><td>Defines a parameter for an object</td></tr>
                    <tr><td>&lt;picture&gt;</td><td>Defines a container for multiple image resources</td></tr>
                    <tr><td>&lt;pre&gt;</td><td>Defines preformatted text</td></tr>
                    <tr><td>&lt;progress&gt;</td><td>Represents the progress of a task</td></tr>
                    <tr><td>&lt;q&gt;</td><td>Defines a short quotation</td></tr>
                    <tr><td>&lt;rp&gt;</td><td>Defines what to show in browsers that do not support ruby annotations</td></tr>
                    <tr><td>&lt;rt&gt;</td><td>Defines an explanation/pronunciation of characters (for East Asian typography)</td></tr>
                    <tr><td>&lt;ruby&gt;</td><td>Defines a ruby annotation (for East Asian typography)</td></tr>
                    <tr><td>&lt;s&gt;</td><td>Defines text that is no longer correct</td></tr>
                    <tr><td>&lt;samp&gt;</td><td>Defines sample output from a computer program</td></tr>
                    <tr><td>&lt;script&gt;</td><td>Defines a client-side script</td></tr>
                    <tr><td>&lt;search&gt;</td><td>Defines a search section</td></tr>
                    <tr><td>&lt;section&gt;</td><td>Defines a section in a document</td></tr>
                    <tr><td>&lt;select&gt;</td><td>Defines a drop-down list</td></tr>
                    <tr><td>&lt;slot&gt;</td><td>Defines a slot for web components</td></tr>
                    <tr><td>&lt;small&gt;</td><td>Defines smaller text</td></tr>
                    <tr><td>&lt;source&gt;</td><td>Defines multiple media resources for media elements</td></tr>
                    <tr><td>&lt;span&gt;</td><td>Defines a section in a document</td></tr>
                    <tr><td>&lt;strong&gt;</td><td>Defines important text</td></tr>
                    <tr><td>&lt;style&gt;</td><td>Defines style information for a document</td></tr>
                    <tr><td>&lt;sub&gt;</td><td>Defines subscripted text</td></tr>
                    <tr><td>&lt;summary&gt;</td><td>Defines a visible heading for a &lt;details&gt; element</td></tr>
                    <tr><td>&lt;sup&gt;</td><td>Defines superscripted text</td></tr>
                    <tr><td>&lt;table&gt;</td><td>Defines a table</td></tr>
                    <tr><td>&lt;tbody&gt;</td><td>Groups the body content in a table</td></tr>
                    <tr><td>&lt;td&gt;</td><td>Defines a cell in a table</td></tr>
                    <tr><td>&lt;template&gt;</td><td>Defines a template</td></tr>
                    <tr><td>&lt;textarea&gt;</td><td>Defines a multiline input control</td></tr>
                    <tr><td>&lt;tfoot&gt;</td><td>Groups the footer content in a table</td></tr>
                    <tr><td>&lt;th&gt;</td><td>Defines a header cell in a table</td></tr>
                    <tr><td>&lt;thead&gt;</td><td>Groups the header content in a table</td></tr>
                    <tr><td>&lt;time&gt;</td><td>Defines a date/time</td></tr>
                    <tr><td>&lt;title&gt;</td><td>Defines a title for the document</td></tr>
                    <tr><td>&lt;tr&gt;</td><td>Defines a row in a table</td></tr>
                    <tr><td>&lt;track&gt;</td><td>Defines text tracks for media elements</td></tr>
                    <tr><td>&lt;u&gt;</td><td>Defines text that should be stylistically different from normal text</td></tr>
                    <tr><td>&lt;ul&gt;</td><td>Defines an unordered list</td></tr>
                    <tr><td>&lt;var&gt;</td><td>Defines a variable</td></tr>
                    <tr><td>&lt;video&gt;</td><td>Defines embedded video content</td></tr>
                    <tr><td>&lt;wbr&gt;</td><td>Defines a possible line-break</td></tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2">All HTML5 tags demonstrated in this document</td>
                    </tr>
                </tfoot>
            </table>
        `;
        contentSection.appendChild(tableContainer);
        
        // Add ruby annotation example
        const rubyExample = document.createElement('div');
        rubyExample.innerHTML = `
            <h5>Ruby Annotation Example</h5>
            <p><ruby>
                漢 <rp>(</rp><rt>かん</rt><rp>)</rp>
                字 <rp>(</rp><rt>じ</rt><rp>)</rp>
            </ruby> pronunciation guide.</p>
        `;
        contentSection.appendChild(rubyExample);
    }
    
    // Add preformatted text example
    const preExample = document.createElement('div');
    preExample.innerHTML = `
        <h5>Preformatted Text Example</h5>
        <pre>
function helloWorld() {
    console.log("Hello, world!");
    // This is a code example
    return true;
}
        </pre>
    `;
    const contentSection = document.getElementById('content');
    if (contentSection) {
        contentSection.appendChild(preExample);
    }
    
    // Add menu example
    const menuExample = document.createElement('div');
    menuExample.innerHTML = `
        <h5>Menu Example</h5>
        <menu>
            <li><button>New Document</button></li>
            <li><button>Open Document</button></li>
            <li><button>Save Document</button></li>
        </menu>
    `;
    if (contentSection) {
        contentSection.appendChild(menuExample);
    }
    
    // Add data element example
    const dataExample = document.createElement('div');
    dataExample.innerHTML = `
        <h5>Data Element Example</h5>
        <ul>
            <li><data value="12345">Product #12345</data></li>
            <li><data value="67890">Product #67890</data></li>
        </ul>
    `;
    if (contentSection) {
        contentSection.appendChild(dataExample);
    }
    
    // Add hr example
    const hrExample = document.createElement('hr');
    if (contentSection) {
        contentSection.appendChild(hrExample);
    }
    
    // Keyboard navigation enhancements
    document.addEventListener('keydown', function(e) {
        // Close dialog with Escape key
        if (e.key === 'Escape') {
            const dialog = document.querySelector('dialog[open]');
            if (dialog) {
                dialog.close();
                announce('Dialog closed');
            }
        }
    });
    
    // Trap focus in dialog when open
    const dialogs = document.querySelectorAll('dialog');
    dialogs.forEach(dialog => {
        dialog.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                const focusableElements = this.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey && document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        });
    });
    
    // Initialize all interactive elements
    function initInteractiveElements() {
        // Initialize all buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (!button.hasAttribute('tabindex')) {
                button.setAttribute('tabindex', '0');
            }
        });
        
        // Initialize all links
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            if (!link.hasAttribute('tabindex')) {
                link.setAttribute('tabindex', '0');
            }
        });
        
        // Initialize all form elements
        const formElements = document.querySelectorAll('input, select, textarea');
        formElements.forEach(element => {
            if (!element.hasAttribute('tabindex')) {
                element.setAttribute('tabindex', '0');
            }
        });
    }
    
    // Call initialization function
    initInteractiveElements();
    
    // Announce page load
    window.addEventListener('load', function() {
        announce('Page loaded. Welcome to the Accessible Single-Page Web App.');
    });
})();