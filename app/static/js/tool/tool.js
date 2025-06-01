 // 导航栏滚动效果
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('nav');
        if (window.scrollY > 50) {
            navbar.classList.add('py-2', 'shadow-lg');
            navbar.classList.remove('py-3');
        } else {
            navbar.classList.add('py-3');
            navbar.classList.remove('py-2', 'shadow-lg');
        }
    });

    // 移动端菜单
    const menuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    menuButton.addEventListener('click', function() {
        if (mobileMenu.classList.contains('opacity-0')) {
            mobileMenu.classList.remove('opacity-0', '-translate-y-full', 'pointer-events-none');
        } else {
            mobileMenu.classList.add('opacity-0', '-translate-y-full', 'pointer-events-none');
        }
    });

    // 工具导航高亮
    document.addEventListener('DOMContentLoaded', function() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.sidebar-link');

        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('bg-primary/10', 'text-primary');
                link.classList.remove('hover:bg-white/5');
            }
        });
    });