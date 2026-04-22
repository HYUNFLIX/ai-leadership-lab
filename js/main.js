/**
 * AI Leadership Lab - Main JavaScript
 * Version: 2.1 - Enhanced & Bug Fixed
 * Author: AI Leadership Lab
 */

(function() {
  'use strict';

  // ================ DOM Elements ================
  const elements = {
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
  // window.scrollTo 제거 → CSS scroll-behavior: smooth 사용 (GPU 가속)
  function handleSmoothScroll(e) {
    const href = e.currentTarget.getAttribute('href');

    if (href && href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.substring(1);
      const targetSection = document.getElementById(targetId);

      if (targetSection) {
        // CSS scroll-behavior:smooth가 처리, JS는 offset 보정만 담당
        const offsetTop = targetSection.getBoundingClientRect().top + window.pageYOffset - config.scrollOffset;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
        history.pushState(null, null, href);
      }
    }
  }

  // ================ Back to Top Button ================
  function initBackToTop() {
    if (!elements.backToTop) return;

    let _bttTicking = false;
    window.addEventListener('scroll', () => {
      if (!_bttTicking) {
        window.requestAnimationFrame(() => {
          elements.backToTop.classList.toggle('visible', window.pageYOffset > config.scrollThreshold);
          _bttTicking = false;
        });
        _bttTicking = true;
      }
    }, { passive: true });

    elements.backToTop.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // ================ Enhanced Projects Marquee ================
  let marqueeInitialized = false;

  function initProjectsMarquee() {
    if (!elements.marqueeTrack) return;

    // Prevent re-initialization on resize (memory leak fix)
    if (marqueeInitialized) {
      // Only recalculate duration on resize
      const trackWidth = elements.marqueeTrack.scrollWidth / 3;
      const viewportWidth = window.innerWidth;
      const duration = (trackWidth / viewportWidth) * config.marqueeSpeed;
      elements.marqueeTrack.style.setProperty('--marquee-duration', `${duration}s`);
      return;
    }

    // Clone items for seamless infinite scroll (only once)
    const items = elements.marqueeTrack.innerHTML;
    elements.marqueeTrack.innerHTML = items + items + items;
    marqueeInitialized = true;

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
          // setTimeout 제거 — CSS animation-delay 인라인으로 처리
          entry.target.querySelectorAll('.animate-on-scroll').forEach((el, index) => {
            el.style.animationDelay = `${index * (config.animationDelay / 1000)}s`;
            el.classList.add('animated');
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
  // hero 전체 transform 제거 — canvas 리페인트 원인
  // heroContent opacity만 CSS transition으로 처리
  function initParallax() {
    const heroContent = document.querySelector('.hero-content');
    if (!heroContent) return;

    let ticking = false;
    const hero = document.querySelector('.hero');

    function updateParallax() {
      const scrolled = window.pageYOffset;
      const heroHeight = hero ? hero.offsetHeight : window.innerHeight;
      if (scrolled < heroHeight) {
        const opacity = Math.max(0.4, 1 - (scrolled / window.innerHeight * 0.7));
        heroContent.style.opacity = opacity;
      }
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
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
  // ① Scroll Spy — nav 링크 + dot indicator 동기화
  function initActiveSectionDetection() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    const dots     = document.querySelectorAll('.section-dot');
    const dotsNav  = document.getElementById('sectionDots');

    // dot indicator: 스크롤 300px 이상이면 표시
    window.addEventListener('scroll', () => {
      if (dotsNav) dotsNav.classList.toggle('visible', window.pageYOffset > 300);
    }, { passive: true });

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute('id');

        // 네비게이션 active
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });

        // dot indicator active
        dots.forEach(dot => {
          dot.classList.toggle('active', dot.getAttribute('href') === `#${id}`);
        });
      });
    }, { rootMargin: '-40% 0% -40% 0%', threshold: 0 });

    sections.forEach(s => sectionObserver.observe(s));
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
    const suffix = originalText.replace(/[\d,]+/, '').trim();
    const duration = speed; // speed를 ms 단위 duration으로 재사용
    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.ceil(ease * target);

      if (progress < 1) {
        counter.innerText = current.toLocaleString() + (suffix ? ' ' + suffix : '');
        requestAnimationFrame(step);
      } else {
        counter.innerText = originalText;
      }
    }
    requestAnimationFrame(step);
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

    // Initialize theme on page load (default = dark)
    function initTheme() {
      const storedTheme = getStoredTheme();
      if (storedTheme === 'light') {
        applyTheme('light');
      } else {
        // Default: always dark. Remove any stale light-mode class.
        html.classList.remove('light-mode');
        html.classList.add('dark-mode');
      }
    }

    // Toggle between light and dark (default = dark)
    function toggleTheme() {
      const isLight = html.classList.contains('light-mode');
      if (isLight) {
        // Switch to dark (default)
        localStorage.setItem(STORAGE_KEY, 'dark');
        applyTheme('dark');
      } else {
        // Switch to light
        localStorage.setItem(STORAGE_KEY, 'light');
        applyTheme('light');
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

  // ================ Interactive 3D Cube ================
  function initInteractiveCube() {
    const cubeScene = document.getElementById('cubeScene');
    const cube = document.getElementById('interactiveCube');

    if (!cubeScene || !cube) return;

    let isHovering = false;
    let isVisible = false;
    let mouseX = 0;
    let mouseY = 0;
    let currentRotateX = -20;
    let currentRotateY = 0;
    let animationId = null;

    // Visibility observer - only animate when cube is visible
    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible && !animationId) {
          animate();
        } else if (!isVisible && animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      });
    }, { threshold: 0.1 });

    visibilityObserver.observe(cubeScene);

    // Mouse move handler
    cubeScene.addEventListener('mousemove', (e) => {
      const rect = cubeScene.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    // Mouse enter - pause auto rotation
    cubeScene.addEventListener('mouseenter', () => {
      isHovering = true;
      cube.classList.add('paused');
    });

    // Mouse leave - resume auto rotation
    cubeScene.addEventListener('mouseleave', () => {
      isHovering = false;
      cube.classList.remove('paused');
    });

    // Touch support for mobile
    cubeScene.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = cubeScene.getBoundingClientRect();
      const touch = e.touches[0];
      mouseX = ((touch.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = ((touch.clientY - rect.top) / rect.height - 0.5) * 2;
    }, { passive: false });

    cubeScene.addEventListener('touchstart', () => {
      isHovering = true;
      cube.classList.add('paused');
    });

    cubeScene.addEventListener('touchend', () => {
      isHovering = false;
      cube.classList.remove('paused');
      mouseX = 0;
      mouseY = 0;
    });

    // Animation loop for smooth interaction (only runs when visible)
    function animate() {
      if (!isVisible) {
        animationId = null;
        return;
      }

      if (isHovering) {
        // Interactive rotation based on mouse position
        const targetRotateX = -20 + mouseY * 30;
        const targetRotateY = mouseX * 45;

        // Smooth interpolation
        currentRotateX += (targetRotateX - currentRotateX) * 0.1;
        currentRotateY += (targetRotateY - currentRotateY) * 0.1;

        cube.style.transform = `rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg)`;
      }

      animationId = requestAnimationFrame(animate);
    }

    // Start animation only if visible
    if (isVisible) {
      animate();
    }

    // Cleanup function
    return () => {
      visibilityObserver.disconnect();
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }

  // ================ Scroll Reveal – all sections ================
  function initScrollReveal() {
    const targets = document.querySelectorAll(
      '.section-header, .books-grid, .media-grid, .testimonials-grid, .contact-centered, .lectures-by-year'
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    targets.forEach((el) => observer.observe(el));
  }

  // ================ About Section – Counter Animation ================
  function initAboutCounters() {
    const statNums = document.querySelectorAll('.about-stat-num[data-count]');
    if (!statNums.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-count'), 10);
          if (!target) return;
          const duration = 1200; // ms
          const start = performance.now();

          function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out quad
            const eased = 1 - (1 - progress) * (1 - progress);
            el.textContent = Math.round(eased * target).toLocaleString();
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.3 });

    statNums.forEach((el) => observer.observe(el));
  }

  // ================ Director Section Animations ================
  function initDirectorAnimations() {
    // 1. Staggered card fade-in
    const cards = document.querySelectorAll('[data-director-card]');
    if (cards.length) {
      const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target;
            const index = Array.from(cards).indexOf(card);
            setTimeout(() => {
              card.classList.add('director-card--visible');
            }, index * 120);
            cardObserver.unobserve(card);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });

      cards.forEach(card => cardObserver.observe(card));
    }

    // 2. Text slide-up animation
    const textBlock = document.querySelector('[data-director-text]');
    if (textBlock) {
      const textObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            textBlock.classList.add('director-text--visible');
            textObserver.unobserve(textBlock);
          }
        });
      }, { threshold: 0.2 });

      textObserver.observe(textBlock);
    }

    // 3. Photo fade-in
    const photoWrap = document.querySelector('[data-director-parallax]');
    if (photoWrap) {
      const photoObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            photoWrap.classList.add('director-photo--visible');
            photoObserver.unobserve(photoWrap);
          }
        });
      }, { threshold: 0.15 });

      photoObserver.observe(photoWrap);
    }

    // 4. Subtle parallax on scroll for the photo
    if (photoWrap) {
      let directorTicking = false;
      const directorSection = document.querySelector('.section-director');

      function updateDirectorParallax() {
        if (!directorSection) return;
        const rect = directorSection.getBoundingClientRect();
        const windowH = window.innerHeight;

        if (rect.top < windowH && rect.bottom > 0) {
          const progress = (windowH - rect.top) / (windowH + rect.height);
          const yShift = (progress - 0.5) * -20;
          photoWrap.style.transform = `translate3d(0,${yShift}px,0)`;
        }
        directorTicking = false;
      }

      window.addEventListener('scroll', () => {
        if (!directorTicking) {
          window.requestAnimationFrame(updateDirectorParallax);
          directorTicking = true;
        }
      }, { passive: true });
    }
  }

  // ================ Initialize Everything ================
  function init() {
    // Check for critical features
    if (!document.querySelector || !window.addEventListener) {
      console.error('Browser does not support required features');
      return;
    }

    // Initialize animations
    initAnimations();

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
    initInteractiveCube();
    initScrollReveal();
    initAboutCounters();
    initDirectorAnimations();
    
    // Performance monitoring (development only)
    if (window.location.hostname === 'localhost') {
      initPerformanceMonitoring();
    }
    
    // Add loaded class to body
    document.body.classList.add('loaded');
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

/* ── ③ 미디어 탭 필터 ──────────────────────────────────────────── */
(function () {
  const btns  = document.querySelectorAll('.media-filter-btn');
  const cards = document.querySelectorAll('.media-card[data-type]');
  if (!btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // 버튼 active
      btns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected','true');

      // 카드 표시/숨김
      cards.forEach(card => {
        const match = filter === 'all' || card.dataset.type === filter;
        card.classList.toggle('hidden', !match);
      });
    });
  });
}());

/* ── ④ 강의 실적 스켈레톤 로딩 UI ──────────────────────────────── */
(function () {
  const container = document.getElementById('lecturesByYear');
  if (!container) return;

  // 텍스트 스피너 대신 스켈레톤 카드 3개로 교체
  container.innerHTML = `
    <div class="skeleton-grid">
      ${[1,2,3].map(() => `
        <div class="skeleton-card">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line long"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line full"></div>
          <div class="skeleton-line medium"></div>
        </div>`).join('')}
    </div>`;
}());

/* ── Hero Orb Parallax ──────────────────────────────────────────
   마우스 위치에 따라 오브가 부드럽게 반응.
   transform3d만 사용 → GPU compositor 처리, CPU 부담 없음.
   ─────────────────────────────────────────────────────────────── */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const hero = document.getElementById('hero');
  if (!hero) return;

  const orbs = [
    // 큰 ambient 오브 — 느리고 묵직하게
    { el: hero.querySelector('.hero-orb-1'), mouse:  0.03,  drift: { amp: 35, sx: 0.20, sy: 0.15, phase: 0.0 } },
    { el: hero.querySelector('.hero-orb-2'), mouse: -0.04,  drift: { amp: 28, sx: 0.17, sy: 0.13, phase: 2.1 } },
    // 중간 오브 — 적당한 반응
    { el: hero.querySelector('.hero-orb-3'), mouse:  0.07,  drift: { amp: 22, sx: 0.26, sy: 0.22, phase: 1.3 } },
    { el: hero.querySelector('.hero-orb-4'), mouse: -0.08,  drift: { amp: 18, sx: 0.30, sy: 0.25, phase: 3.7 } },
    // 작은 포인트 오브 — 빠르고 민감하게
    { el: hero.querySelector('.hero-orb-5'), mouse:  0.13,  drift: { amp: 14, sx: 0.38, sy: 0.32, phase: 5.1 } },
    { el: hero.querySelector('.hero-orb-6'), mouse: -0.11,  drift: { amp: 12, sx: 0.42, sy: 0.35, phase: 0.8 } },
  ].filter(o => o.el);

  if (!orbs.length) return;

  let mx = 0, my = 0;                        // 마우스 위치 (hero 중심 기준)
  let cx = [0,0,0,0,0,0], cy = [0,0,0,0,0,0]; // 현재 lerp 위치
  const LERP = 0.055;          // 부드러움 (낮을수록 느리게 따라옴)
  const t0 = performance.now();

  // 히어로에서 마우스 좌표 수집 (passive)
  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    mx = e.clientX - r.left - r.width  / 2;
    my = e.clientY - r.top  - r.height / 2;
  }, { passive: true });

  hero.addEventListener('mouseleave', () => { mx = 0; my = 0; });

  // 히어로가 화면에 없으면 rAF 중단 (배터리 절약)
  let heroVisible = true;
  const io = new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0 });
  io.observe(hero);

  function tick(now) {
    requestAnimationFrame(tick);
    if (!heroVisible) return;

    const t = (now - t0) / 1000; // 초

    orbs.forEach((orb, i) => {
      const d = orb.drift;
      // 사인파 idle drift (마우스 없을 때도 살아있는 느낌)
      const driftX = Math.sin(t * d.sx + d.phase) * d.amp;
      const driftY = Math.cos(t * d.sy + d.phase) * d.amp;

      // 마우스 패럴랙스 더하기
      const tX = driftX + mx * orb.mouse;
      const tY = driftY + my * orb.mouse;

      // Lerp (smooth follow)
      cx[i] += (tX - cx[i]) * LERP;
      cy[i] += (tY - cy[i]) * LERP;

      orb.el.style.transform = `translate3d(${cx[i].toFixed(1)}px,${cy[i].toFixed(1)}px,0)`;
    });
  }

  requestAnimationFrame(tick);
}());

/* ================ EmailJS Contact Form ================
   설정값은 EmailJS 대시보드(https://www.emailjs.com)에서 확인하세요.
   - PUBLIC_KEY  : Account → API Keys → Public Key
   - SERVICE_ID  : Email Services → 서비스 ID
   - TEMPLATE_ID : Email Templates → 템플릿 ID
   템플릿 변수: {{from_name}}, {{reply_to}}, {{organization}}, {{message}}
   ======================================================= */
(function () {
  // ▼▼▼ 여기에 본인의 EmailJS 키를 입력하세요 ▼▼▼
  const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
  const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
  const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  const form       = document.getElementById('contactForm');
  const submitBtn  = document.getElementById('cfSubmitBtn');
  const statusEl   = document.getElementById('cfStatus');

  if (!form) return; // 폼이 없으면 종료

  // EmailJS 초기화 (defer 로드 후 실행되므로 안전)
  function initEmailJS() {
    if (typeof emailjs !== 'undefined') {
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    }
  }
  // defer 스크립트가 이미 로드됐을 수도, 아직일 수도 있으므로 두 경우 모두 처리
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmailJS);
  } else {
    initEmailJS();
  }

  // 유효성 검사
  function validate() {
    let ok = true;
    ['cf-name', 'cf-email', 'cf-message'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      const empty = !el.value.trim();
      const badEmail = id === 'cf-email' && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
      if (empty || badEmail) {
        el.classList.add('cf-error');
        ok = false;
      } else {
        el.classList.remove('cf-error');
      }
    });
    return ok;
  }

  // 실시간 오류 해제
  form.querySelectorAll('input, textarea').forEach(function (el) {
    el.addEventListener('input', function () {
      el.classList.remove('cf-error');
      setStatus('', '');
    });
  });

  // 상태 메시지 헬퍼
  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className   = 'cf-status' + (type ? ' ' + type : '');
  }

  // 로딩 상태 헬퍼
  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('loading', on);
  }

  // 폼 제출
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) {
      setStatus('필수 항목을 모두 입력해주세요.', 'error');
      return;
    }

    if (typeof emailjs === 'undefined') {
      setStatus('이메일 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'error');
      return;
    }

    setLoading(true);
    setStatus('', '');

    emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, form)
      .then(function () {
        setStatus('✅ 문의가 성공적으로 전송되었습니다. 1영업일 이내 답변드리겠습니다.', 'success');
        form.reset();
      })
      .catch(function (err) {
        console.error('EmailJS error:', err);
        setStatus('❌ 전송에 실패했습니다. 잠시 후 다시 시도하거나 hyunnet@gmail.com으로 직접 연락해주세요.', 'error');
      })
      .finally(function () {
        setLoading(false);
      });
  });
}());
