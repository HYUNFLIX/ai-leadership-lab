// State
let likedPrompts = JSON.parse(localStorage.getItem('likedPrompts') || '[]');
let currentFilter = 'all';
let showOnlyLiked = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeCards();
    initializeLikes();
    initializeModal();
    initializeFilters();
    initializeSearch();
    initializeKeyboardShortcuts();
    checkUrlHash();
    updateLikedCount();
});

// Theme toggle
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Set initial theme
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    } else if (!prefersDark) {
        document.documentElement.setAttribute('data-theme', 'light');
        updateThemeIcon('light');
    }

    // Toggle button click
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-theme', newTheme === 'dark' ? '' : newTheme);
            if (newTheme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            if (e.matches) {
                document.documentElement.removeAttribute('data-theme');
                updateThemeIcon('dark');
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                updateThemeIcon('light');
            }
        }
    });
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
        themeToggle.title = theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환';
    }
}

// Initialize card IDs and previews
function initializeCards() {
    const categoryPrefixes = {
        'hr': 'HR',
        'sales': 'SALES',
        'marketing': 'MKT',
        'finance': 'FIN',
        'meeting': 'MTG',
        'comm': 'COMM',
        'decision': 'DEC',
        'feedback': 'FB',
        'report': 'RPT',
        'crisis': 'CRISIS',
        'eval': 'EVAL',
        'strategy': 'STR'
    };

    document.querySelectorAll('.category-section').forEach(section => {
        const category = section.dataset.category;
        const prefix = categoryPrefixes[category] || 'P';

        section.querySelectorAll('.prompt-card').forEach((card, index) => {
            const id = `${prefix}-${String(index + 1).padStart(2, '0')}`;
            card.dataset.promptId = id;

            // Add ID display
            const headerText = card.querySelector('.card-header-text');
            if (headerText && !headerText.querySelector('.card-id')) {
                const idEl = document.createElement('div');
                idEl.className = 'card-id';
                idEl.textContent = `#${id}`;
                headerText.insertBefore(idEl, headerText.firstChild);
            }

            // Create preview from full text
            const fullText = card.querySelector('.prompt-text');
            if (fullText && !card.querySelector('.prompt-preview')) {
                const preview = document.createElement('div');
                preview.className = 'prompt-preview';
                preview.textContent = fullText.textContent.substring(0, 150) + '...';
                card.querySelector('.card-body').appendChild(preview);
            }
        });
    });
}

// Initialize like buttons on cards
function initializeLikes() {
    document.querySelectorAll('.prompt-card').forEach(card => {
        const promptId = card.dataset.promptId;
        const actions = card.querySelector('.card-actions');

        if (actions) {
            const likeBtn = actions.querySelector('.like-btn');
            if (likeBtn) {
                if (likedPrompts.includes(promptId)) {
                    likeBtn.classList.add('liked');
                }

                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleLike(promptId);
                    likeBtn.classList.toggle('liked');
                    updateLikedCount();
                    if (showOnlyLiked) {
                        filterCards();
                    }
                });
            }
        }
    });
}

// Initialize modal
function initializeModal() {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    const copyBtn = document.getElementById('modalCopyBtn');
    const shareBtn = document.getElementById('modalShareBtn');
    const likeBtn = document.getElementById('modalLikeBtn');

    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
    }

    // Copy functionality
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const text = document.getElementById('modalPromptText').textContent;
            await copyToClipboard(text);
            copyBtn.innerHTML = '✅ 복사 완료!';
            copyBtn.classList.add('copied');
            showToast('프롬프트가 클립보드에 복사되었습니다!');

            setTimeout(() => {
                copyBtn.innerHTML = '📋 프롬프트 복사하기';
                copyBtn.classList.remove('copied');
            }, 2000);
        });
    }

    // Share functionality
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const promptId = overlay.dataset.currentPromptId;
            const title = document.getElementById('modalTitle').textContent;
            const url = `${window.location.origin}${window.location.pathname}#${promptId}`;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: `AI 시대의 팀장 - ${title}`,
                        text: `실전 프롬프트: ${title}`,
                        url: url
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        await copyToClipboard(url);
                        showToast('링크가 복사되었습니다!');
                    }
                }
            } else {
                await copyToClipboard(url);
                showToast('링크가 복사되었습니다!');
            }
        });
    }

    // Like functionality in modal
    if (likeBtn) {
        likeBtn.addEventListener('click', () => {
            const promptId = overlay.dataset.currentPromptId;
            toggleLike(promptId);
            updateModalLikeButton(promptId);
            updateCardLikeButton(promptId);
            updateLikedCount();
            if (showOnlyLiked) {
                filterCards();
            }
        });
    }

    // Card click to open modal
    document.querySelectorAll('.prompt-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.action-btn')) return;
            openModal(card);
        });
    });
}

// Open modal
function openModal(card) {
    const overlay = document.getElementById('modalOverlay');
    const promptId = card.dataset.promptId;
    const title = card.querySelector('.card-title').textContent;
    const desc = card.querySelector('.card-desc').textContent;
    const text = card.querySelector('.prompt-text').textContent;

    overlay.dataset.currentPromptId = promptId;

    document.getElementById('modalId').textContent = `#${promptId}`;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalDesc').textContent = desc;
    document.getElementById('modalPromptText').textContent = text;

    updateModalLikeButton(promptId);

    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Update URL hash
    history.pushState(null, '', `#${promptId}`);
}

// Close modal
function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('show');
    document.body.style.overflow = '';

    // Remove URL hash
    history.pushState(null, '', window.location.pathname);
}

// Update modal like button
function updateModalLikeButton(promptId) {
    const likeBtn = document.getElementById('modalLikeBtn');
    if (likeBtn) {
        if (likedPrompts.includes(promptId)) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '❤️ 좋아요 취소';
        } else {
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '🤍 좋아요';
        }
    }
}

// Update card like button
function updateCardLikeButton(promptId) {
    const card = document.querySelector(`[data-prompt-id="${promptId}"]`);
    if (card) {
        const likeBtn = card.querySelector('.like-btn');
        if (likeBtn) {
            likeBtn.classList.toggle('liked', likedPrompts.includes(promptId));
        }
    }
}

// Toggle like
function toggleLike(promptId) {
    const index = likedPrompts.indexOf(promptId);
    if (index > -1) {
        likedPrompts.splice(index, 1);
    } else {
        likedPrompts.push(promptId);
    }
    localStorage.setItem('likedPrompts', JSON.stringify(likedPrompts));
}

// Update liked count in filter button
function updateLikedCount() {
    const likedFilterBtn = document.querySelector('[data-category="liked"]');
    if (likedFilterBtn) {
        const countSpan = likedFilterBtn.querySelector('.count');
        if (countSpan) {
            countSpan.textContent = likedPrompts.length;
        }
    }
}

// Initialize filters
function initializeFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;

            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            if (category === 'liked') {
                showOnlyLiked = true;
                currentFilter = 'all';
            } else {
                showOnlyLiked = false;
                currentFilter = category;
            }

            filterCards();
        });
    });
}

// Filter cards
function filterCards() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    document.querySelectorAll('.category-section').forEach(section => {
        const sectionCategory = section.dataset.category;
        let hasVisibleCards = false;

        section.querySelectorAll('.prompt-card').forEach(card => {
            const promptId = card.dataset.promptId;
            const title = card.querySelector('.card-title').textContent.toLowerCase();
            const desc = card.querySelector('.card-desc').textContent.toLowerCase();
            const prompt = card.querySelector('.prompt-text').textContent.toLowerCase();

            let visible = true;

            // Category filter
            if (currentFilter !== 'all' && sectionCategory !== currentFilter) {
                visible = false;
            }

            // Like filter
            if (showOnlyLiked && !likedPrompts.includes(promptId)) {
                visible = false;
            }

            // Search filter
            if (searchTerm && !title.includes(searchTerm) && !desc.includes(searchTerm) && !prompt.includes(searchTerm)) {
                visible = false;
            }

            card.style.display = visible ? '' : 'none';
            if (visible) hasVisibleCards = true;
        });

        // Hide section if no visible cards
        if (currentFilter === 'all' || sectionCategory === currentFilter) {
            section.style.display = hasVisibleCards ? '' : 'none';
        } else {
            section.style.display = 'none';
        }
    });
}

// Initialize search
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterCards();
        });
    }
}

// Initialize keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Escape to close modal
        if (e.key === 'Escape') {
            const overlay = document.getElementById('modalOverlay');
            if (overlay && overlay.classList.contains('show')) {
                closeModal();
            }
        }

        // '/' to focus search
        if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
            const searchInput = document.getElementById('searchInput');
            if (document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
        }
    });
}

// Check URL hash on load
function checkUrlHash() {
    const hash = window.location.hash.slice(1);
    if (hash) {
        const card = document.querySelector(`[data-prompt-id="${hash}"]`);
        if (card) {
            setTimeout(() => {
                openModal(card);
            }, 300);
        }
    }
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('복사 실패:', err);
        return false;
    }
}

// Show toast
function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = `✅ ${message}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const hash = window.location.hash.slice(1);
    const overlay = document.getElementById('modalOverlay');

    if (hash) {
        const card = document.querySelector(`[data-prompt-id="${hash}"]`);
        if (card) {
            openModal(card);
        }
    } else if (overlay && overlay.classList.contains('show')) {
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
});
