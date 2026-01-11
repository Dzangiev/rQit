document.addEventListener('DOMContentLoaded', () => {
    // Set viewport height unit
    function setVhVariable() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // Set on initial load
    setVhVariable();

    // Set on resize
    window.addEventListener('resize', setVhVariable);
    
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const indicator = document.querySelector('.nav-indicator');

    function moveIndicator(activeItem) {
        if (activeItem) {
            indicator.style.left = `${activeItem.offsetLeft - 1.5}px`;
        }
    }

    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.toggle('active', page.id === pageId);
        });
    }

    // Set initial position for indicator and show initial page
    const initialActiveNavItem = document.querySelector('.nav-item.active');
    if (initialActiveNavItem) {
        moveIndicator(initialActiveNavItem);
        showPage(initialActiveNavItem.dataset.page);
    }

    navItems.forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();

            // Ignore click if it's already active
            if (item.classList.contains('active')) {
                return;
            }

            // Update active class on nav items
            const currentActive = document.querySelector('.nav-item.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            item.classList.add('active');

            // Move indicator
            moveIndicator(item);

            // Show corresponding page
            showPage(item.dataset.page);
        });
    });
});
