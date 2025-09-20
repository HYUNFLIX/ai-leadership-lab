/**
 * AI Leadership Lab - Main JavaScript
 * Version: 2.0
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
  };

  // ================ Configuration ================
  const config = {
    scrollOffset: 100,
    animationDelay: 100,
    scrollThreshold: 300,
  };

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
    window.addEventListener('scroll', handleNavbarScroll);
    handleNavbarScroll(); // Initial check
  }

  function toggleMobileMenu() {
    elements.navToggle.classList.toggle('active');
    elements.navMenu.classList.toggle('active');
    document.body.classList.toggle('menu-open');
  }

  function closeMobileMenu() {
    elements.navToggle.classList.remove('active');
    elements.navMenu.classList.remove('active');
    document.body.classList.remove('menu-open');
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

  // ================ Animations ================
  function initAnimations() {
    // Intersection Observer for section animations
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
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
      observer.observe(section);
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
        const opacity = 1 - (scrolled / windowHeight * 0.5);
        
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

  // ================ Projects Marquee ================
  function initProjectsMarquee() {
    const marqueeTrack = document.querySelector('.marquee-track');
    if (!marqueeTrack) return;

    // Clone items for infinite scroll
    const items = marqueeTrack.innerHTML;
    marqueeTrack.innerHTML = items + items;

    // Pause on hover
    marqueeTrack.addEventListener('mouseenter', () => {
      marqueeTrack.style.animationPlayState = 'paused';
    });

    marqueeTrack.addEventListener('mouseleave', () => {
      marqueeTrack.style.animationPlayState = 'running';
    });
  }

  // ================ Form Validation (if needed) ================
  function initForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Basic validation
        let isValid = true;
        for (let [key, value] of Object.entries(data)) {
          if (!value.trim()) {
            isValid = false;
            showError(form, `${key} is required`);
            break;
          }
        }
        
        if (isValid) {
          // Show success message
          showSuccess(form, 'Thank you for your message!');
          form.reset();
        }
      });
    });
  }

  function showError(form, message) {
    removeMessages(form);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-message error';
    errorDiv.textContent = message;
    form.appendChild(errorDiv);
    
    setTimeout(() => removeMessages(form), 5000);
  }

  function showSuccess(form, message) {
    removeMessages(form);
    const successDiv = document.createElement('div');
    successDiv.className = 'form-message success';
    successDiv.textContent = message;
    form.appendChild(successDiv);
    
    setTimeout(() => removeMessages(form), 5000);
  }

  function removeMessages(form) {
    const messages = form.querySelectorAll('.form-message');
    messages.forEach(msg => msg.remove());
  }

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

  // ================ Active Section Detection ================
  function initActiveSectionDetection() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    const observerOptions = {
      rootMargin: '-50% 0% -50% 0%',
      threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
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
      observer.observe(section);
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
    
    const observer = new IntersectionObserver((entries) => {
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
      observer.observe(counter);
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

  // ================ Image Lazy Loading ================
  function initLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('loading' in HTMLImageElement.prototype) {
      // Browser supports native lazy loading
      images.forEach(img => {
        if (img.dataset.src) {
          img.src = img.dataset.src;
        }
      });
    } else {
      // Fallback for browsers that don't support lazy loading
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
      });
      
      images.forEach(img => imageObserver.observe(img));
    }
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

  // ================ Performance Optimization ================
  const optimizedScroll = throttle(() => {
    handleNavbarScroll();
  }, 100);

  const optimizedResize = debounce(() => {
    if (window.innerWidth > 768) {
      closeMobileMenu();
    }
  }, 250);

  // ================ Event Listeners ================
  window.addEventListener('scroll', optimizedScroll);
  window.addEventListener('resize', optimizedResize);

  // ================ Initialize Everything ================
  function init() {
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
    
    // Add loaded class to body
    document.body.classList.add('loaded');
    
    console.log('AI Leadership Lab website initialized successfully!');
  }

  // ================ Start Application ================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ================ Public API (if needed) ================
  window.AILeadershipLab = {
    version: '2.0',
    reinit: init,
    scrollTo: (target) => {
      const element = document.querySelector(target);
      if (element) {
        window.scrollTo({
          top: element.offsetTop - config.scrollOffset,
          behavior: 'smooth'
        });
      }
    }
  };

})();