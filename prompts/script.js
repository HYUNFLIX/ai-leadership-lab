// Copy functionality
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        const promptText = this.closest('.prompt-card').querySelector('.prompt-text').textContent;

        try {
            await navigator.clipboard.writeText(promptText);

            // Button feedback
            this.textContent = '✅ 복사 완료!';
            this.classList.add('copied');

            // Toast
            const toast = document.getElementById('toast');
            toast.classList.add('show');

            setTimeout(() => {
                this.textContent = '📋 프롬프트 복사하기';
                this.classList.remove('copied');
                toast.classList.remove('show');
            }, 2000);
        } catch (err) {
            console.error('복사 실패:', err);
        }
    });
});

// Category filter
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const category = this.dataset.category;

        // Update active button
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Filter sections
        document.querySelectorAll('.category-section').forEach(section => {
            if (category === 'all' || section.dataset.category === category) {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
    });
});

// Search functionality
document.getElementById('searchInput').addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();

    document.querySelectorAll('.prompt-card').forEach(card => {
        const title = card.querySelector('.card-title').textContent.toLowerCase();
        const desc = card.querySelector('.card-desc').textContent.toLowerCase();
        const prompt = card.querySelector('.prompt-text').textContent.toLowerCase();

        if (title.includes(searchTerm) || desc.includes(searchTerm) || prompt.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });

    // Show/hide category sections based on visible cards
    document.querySelectorAll('.category-section').forEach(section => {
        const visibleCards = section.querySelectorAll('.prompt-card[style="display: block"], .prompt-card:not([style*="display"])');
        let hasVisible = false;
        visibleCards.forEach(card => {
            if (card.style.display !== 'none') hasVisible = true;
        });

        if (searchTerm === '') {
            section.style.display = 'block';
            section.querySelectorAll('.prompt-card').forEach(card => card.style.display = 'block');
        }
    });
});
