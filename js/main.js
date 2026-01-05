/**
 * AI Leadership Lab - Main JavaScript
 * Version: 2.1 - Enhanced & Bug Fixed
 * Author: AI Leadership Lab
 */

(function() {
  'use strict';

  // ================ DOM Elements ================
  const elements = {
    loader: document.getElementById('loader'),
    navbar: document.getElementById('navbar'),
    navMenu: document.getElementById('navMenu'),
    navToggle: document.getElementById('navToggle'),
    navLinks: document.querySelectorAll('.nav-link'),
    backToTop: document.getElementById('backToTop'),
    sections: document.querySelectorAll('.section'),
    marqueeTrack: document.getElementById('marqueeTrack'),
  };

  // ================ Configuration ================
  const config = {
    scrollOffset: 100,
    animationDelay: 100,
    scrollThreshold: 300,
    imageObserverMargin: '50px',
    marqueeSpeed: 30, // seconds
  };

  // ================ Utility Functions ================
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ================ Security Functions ================
  function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // ================ Loading Screen ================
  function hideLoader() {
    setTimeout(() => {
      elements.loader.classList.add('loaded');
      document.body.style.overflow = 'visible';
      initAnimations();
    }, 1500);
  }

  // ================ Navigation ================
  function initNavigation() {
    // Toggle mobile menu
    if (elements.navToggle) {
      elements.navToggle.addEventListener('click', toggleMobileMenu);
    }

    // Close mobile menu on link click
    elements.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          closeMobileMenu();
        }
        handleSmoothScroll(e);
      });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', optimizedScroll);
    handleNavbarScroll(); // Initial check
  }

  function toggleMobileMenu() {
    const isActive = elements.navToggle.classList.toggle('active');
    elements.navMenu.classList.toggle('active');
    document.body.classList.toggle('menu-open');
    
    // Update aria-expanded for accessibility
    elements.navToggle.setAttribute('aria-expanded', isActive);
  }

  function closeMobileMenu() {
    elements.navToggle.classList.remove('active');
    elements.navMenu.classList.remove('active');
    document.body.classList.remove('menu-open');
    elements.navToggle.setAttribute('aria-expanded', 'false');
  }

  function handleNavbarScroll() {
    const scrolled = window.pageYOffset > 50;
    if (scrolled) {
      elements.navbar.classList.add('scrolled');
    } else {
      elements.navbar.classList.remove('scrolled');
    }
  }

  // ================ Smooth Scrolling ================
  function handleSmoothScroll(e) {
    const href = e.currentTarget.getAttribute('href');
    
    if (href && href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.substring(1);
      const targetSection = document.getElementById(targetId);
      
      if (targetSection) {
        const offsetTop = targetSection.offsetTop - config.scrollOffset;
        
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });

        // Update URL without jumping
        history.pushState(null, null, href);
      }
    }
  }

  // ================ Back to Top Button ================
  function initBackToTop() {
    if (!elements.backToTop) return;

    window.addEventListener('scroll', () => {
      if (window.pageYOffset > config.scrollThreshold) {
        elements.backToTop.classList.add('visible');
      } else {
        elements.backToTop.classList.remove('visible');
      }
    });

    elements.backToTop.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // ================ Enhanced Projects Marquee ================
  function initProjectsMarquee() {
    if (!elements.marqueeTrack) return;

    // Clone items for seamless infinite scroll
    const items = elements.marqueeTrack.innerHTML;
    elements.marqueeTrack.innerHTML = items + items + items; // Triple for smoother animation

    // Calculate and set animation duration based on content width
    const trackWidth = elements.marqueeTrack.scrollWidth / 3;
    const viewportWidth = window.innerWidth;
    const duration = (trackWidth / viewportWidth) * config.marqueeSpeed;
    
    elements.marqueeTrack.style.setProperty('--marquee-duration', `${duration}s`);
    elements.marqueeTrack.style.setProperty('--marquee-width', `${trackWidth}px`);

    // Pause on hover
    elements.marqueeTrack.addEventListener('mouseenter', () => {
      elements.marqueeTrack.classList.add('paused');
    });

    elements.marqueeTrack.addEventListener('mouseleave', () => {
      elements.marqueeTrack.classList.remove('paused');
    });
  }

  // ================ Animations ================
  function initAnimations() {
    // Single observer for better performance
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const animationObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          
          // Animate child elements with delay
          const animatedElements = entry.target.querySelectorAll('.animate-on-scroll');
          animatedElements.forEach((el, index) => {
            setTimeout(() => {
              el.classList.add('animated');
            }, index * config.animationDelay);
          });
        }
      });
    }, observerOptions);

    // Observe all sections
    elements.sections.forEach(section => {
      animationObserver.observe(section);
    });

    // Parallax effect for hero section
    initParallax();
  }

  // ================ Parallax Effect ================
  function initParallax() {
    const hero = document.querySelector('.hero');
    const heroContent = document.querySelector('.hero-content');
    
    if (!hero || !heroContent) return;

    let ticking = false;

    function updateParallax() {
      const scrolled = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const heroHeight = hero.offsetHeight;

      if (scrolled < heroHeight) {
        const speed = 0.5;
        const yPos = -(scrolled * speed);
        const opacity = Math.max(0.5, 1 - (scrolled / windowHeight * 0.5));
        
        hero.style.transform = `translateY(${yPos}px)`;
        heroContent.style.opacity = opacity;
        heroContent.style.transform = `translateY(${-yPos * 0.3}px)`;
      }
      
      ticking = false;
    }

    function requestTick() {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }

    window.addEventListener('scroll', requestTick);
  }

  // ================ Form Validation & Security ================
  function initForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      form.addEventListener('submit', handleFormSubmit);
    });
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Sanitize inputs
    for (let key in data) {
      data[key] = sanitizeInput(data[key]);
    }
    
    // Validation
    let isValid = true;
    let errors = [];
    
    // Check required fields
    for (let [key, value] of Object.entries(data)) {
      if (!value.trim()) {
        isValid = false;
        errors.push(`${key} is required`);
      }
    }
    
    // Validate email if present
    if (data.email && !validateEmail(data.email)) {
      isValid = false;
      errors.push('Please enter a valid email address');
    }
    
    if (isValid) {
      // Here you would typically send the data to your server
      showSuccess(form, '감사합니다! 문의사항이 접수되었습니다.');
      form.reset();
      
      // Log for development (remove in production)
      console.log('Form submitted:', data);
    } else {
      showError(form, errors[0]);
    }
  }

  function showError(form, message) {
    removeMessages(form);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-message error';
    errorDiv.textContent = message;
    errorDiv.setAttribute('role', 'alert');
    form.appendChild(errorDiv);
    
    setTimeout(() => removeMessages(form), 5000);
  }

  function showSuccess(form, message) {
    removeMessages(form);
    const successDiv = document.createElement('div');
    successDiv.className = 'form-message success';
    successDiv.textContent = message;
    successDiv.setAttribute('role', 'status');
    form.appendChild(successDiv);
    
    setTimeout(() => removeMessages(form), 5000);
  }

  function removeMessages(form) {
    const messages = form.querySelectorAll('.form-message');
    messages.forEach(msg => msg.remove());
  }

  // ================ Active Section Detection ================
  function initActiveSectionDetection() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    const observerOptions = {
      rootMargin: '-50% 0% -50% 0%',
      threshold: 0
    };
    
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          
          navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, observerOptions);
    
    sections.forEach(section => {
      sectionObserver.observe(section);
    });
  }

  // ================ Typing Effect for Messages ================
  function initTypingEffect() {
    const messages = document.querySelectorAll('.message-bubble');
    
    messages.forEach((message, index) => {
      setTimeout(() => {
        message.style.opacity = '1';
        message.style.transform = 'translateY(0)';
      }, index * 500);
    });
  }

  // ================ Number Counter Animation ================
  function initNumberCounters() {
    const counters = document.querySelectorAll('.stat-value');
    const speed = 200; // Animation speed
    
    const observerOptions = {
      threshold: 0.5
    };
    
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
          const counter = entry.target;
          const target = parseInt(counter.getAttribute('data-target')) || 
                        parseInt(counter.innerText.replace(/\D/g, ''));
          
          if (target) {
            animateCounter(counter, target, speed);
            counter.classList.add('counted');
          }
        }
      });
    }, observerOptions);
    
    counters.forEach(counter => {
      const text = counter.innerText;
      counter.setAttribute('data-original', text);
      counterObserver.observe(counter);
    });
  }

  function animateCounter(counter, target, speed) {
    const originalText = counter.getAttribute('data-original');
    const increment = target / speed;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      
      if (current >= target) {
        counter.innerText = originalText;
        clearInterval(timer);
      } else {
        const suffix = originalText.replace(/[\d,]+/, '').trim();
        counter.innerText = Math.ceil(current).toLocaleString() + (suffix ? ' ' + suffix : '');
      }
    }, 1);
  }

  // ================ Enhanced Image Lazy Loading with Error Handling ================
  function initLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    // Error handling for all images
    images.forEach(img => {
      // Add error handler
      img.addEventListener('error', handleImageError);
      
      // Native lazy loading support check
      if (!('loading' in HTMLImageElement.prototype)) {
        // Fallback for browsers without native lazy loading
        observeImage(img);
      }
    });
  }

  function handleImageError(e) {
    const img = e.target;
    const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' fill='%23e5e7eb'%3E%3Crect width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-family='sans-serif' font-size='18'%3E이미지를 불러올 수 없습니다%3C/text%3E%3C/svg%3E`;
    
    // Prevent infinite loop
    if (img.src !== fallbackSvg) {
      img.src = fallbackSvg;
      img.alt = '이미지를 불러올 수 없습니다';
      console.warn('Image failed to load:', img.getAttribute('src'));
    }
  }

  function observeImage(img) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: config.imageObserverMargin
    });
    
    imageObserver.observe(img);
  }

  // ================ Keyboard Navigation ================
  function initKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      // ESC key closes mobile menu
      if (e.key === 'Escape' && elements.navMenu.classList.contains('active')) {
        closeMobileMenu();
      }
      
      // Tab trap for mobile menu when open
      if (e.key === 'Tab' && elements.navMenu.classList.contains('active')) {
        const focusableElements = elements.navMenu.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });
  }

  // ================ Dark Mode Toggle ================
  function initDarkModeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    const STORAGE_KEY = 'ai-leadership-theme';

    // Get stored preference or null
    function getStoredTheme() {
      return localStorage.getItem(STORAGE_KEY);
    }

    // Check if system prefers dark mode
    function systemPrefersDark() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Apply theme based on preference
    function applyTheme(theme) {
      if (theme === 'dark') {
        html.classList.add('dark-mode');
        html.classList.remove('light-mode');
      } else if (theme === 'light') {
        html.classList.add('light-mode');
        html.classList.remove('dark-mode');
      } else {
        // Auto - remove manual classes, let system preference work
        html.classList.remove('dark-mode', 'light-mode');
      }
    }

    // Initialize theme on page load
    function initTheme() {
      const storedTheme = getStoredTheme();
      if (storedTheme) {
        applyTheme(storedTheme);
      }
      // If no stored preference, CSS media query handles it automatically
    }

    // Toggle between light and dark
    function toggleTheme() {
      const storedTheme = getStoredTheme();
      const currentlyDark = html.classList.contains('dark-mode') ||
                            (!html.classList.contains('light-mode') && systemPrefersDark());

      if (currentlyDark) {
        // Switch to light
        localStorage.setItem(STORAGE_KEY, 'light');
        applyTheme('light');
      } else {
        // Switch to dark
        localStorage.setItem(STORAGE_KEY, 'dark');
        applyTheme('dark');
      }
    }

    // Event listener for toggle button
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // Listen for system preference changes (only if no manual preference set)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getStoredTheme()) {
        // No manual preference, CSS handles it automatically
        // Just ensure no conflicting classes
        html.classList.remove('dark-mode', 'light-mode');
      }
    });

    // Initialize on load
    initTheme();
  }

  // ================ Performance Monitoring ================
  function initPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      // Monitor Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // LCP observer not supported
      }
    }
  }

  // ================ Performance Optimization ================
  const optimizedScroll = throttle(() => {
    handleNavbarScroll();
  }, 100);

  const optimizedResize = debounce(() => {
    if (window.innerWidth > 768) {
      closeMobileMenu();
    }
    // Recalculate marquee on resize
    initProjectsMarquee();
  }, 250);

  // ================ Event Listeners ================
  window.addEventListener('resize', optimizedResize);

  // ================ Initialize Everything ================
  function init() {
    // Check for critical features
    if (!document.querySelector || !window.addEventListener) {
      console.error('Browser does not support required features');
      return;
    }
    
    // Hide loader after page load
    hideLoader();
    
    // Initialize all components
    initNavigation();
    initBackToTop();
    initProjectsMarquee();
    initForms();
    initActiveSectionDetection();
    initTypingEffect();
    initNumberCounters();
    initLazyLoading();
    initKeyboardNav();
    initDarkModeToggle();
    
    // Performance monitoring (development only)
    if (window.location.hostname === 'localhost') {
      initPerformanceMonitoring();
    }
    
    // Add loaded class to body
    document.body.classList.add('loaded');
    
    console.log('AI Leadership Lab website initialized successfully! Version 2.1');
  }

  // ================ Start Application ================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ================ Public API ================
  window.AILeadershipLab = {
    version: '2.1',
    reinit: init,
    scrollTo: (target) => {
      const element = document.querySelector(target);
      if (element) {
        window.scrollTo({
          top: element.offsetTop - config.scrollOffset,
          behavior: 'smooth'
        });
      }
    },
    // Expose utility functions for external use if needed
    utils: {
      debounce,
      throttle,
      validateEmail,
      sanitizeInput
    }
  };

})();
