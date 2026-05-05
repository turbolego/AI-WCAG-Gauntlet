document.addEventListener('DOMContentLoaded', function() {
    const skipLink = document.querySelector('.skip-link');
    skipLink.addEventListener('focus', function() {
        this.style.top = '0';
    });

    skipLink.addEventListener('blur', function() {
        this.style.top = '-40px';
    });
});