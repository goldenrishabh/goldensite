// Main JavaScript file for the personal website

class PersonalWebsite {
    constructor() {
        this.currentCategory = 'all';
        this.blogPosts = [];
        this.categories = {};
        this.isDarkMode = false;
        
        this.init();
    }
    
    init() {
        this.setupTheme();
        this.setupNavigation();
        this.setupBlog();
        this.setupAnimations();
        this.setupEventListeners();
    }
    
    // Theme Management
    setupTheme() {
        // Check for saved theme preference or default to 'light'
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        this.isDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);
        this.updateTheme();
    }
    
    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        this.updateTheme();
        localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    }
    
    updateTheme() {
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
    
    // Navigation
    setupNavigation() {
        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    const offsetTop = target.offsetTop - 100; // Account for fixed nav
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
        
        // Active section highlighting
        this.setupActiveSection();
    }
    
    setupActiveSection() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('text-cream-600', 'dark:text-cream-400');
                        link.classList.add('hover:text-cream-600', 'dark:hover:text-cream-400', 'transition-colors');
                        
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('text-cream-600', 'dark:text-cream-400');
                            link.classList.remove('hover:text-cream-600', 'dark:hover:text-cream-400');
                        }
                    });
                }
            });
        }, {
            threshold: 0.3,
            rootMargin: '-100px 0px -100px 0px'
        });
        
        sections.forEach(section => observer.observe(section));
    }
    
    // Blog System - Dynamic Loading
    setupBlog() {
        this.loadBlogPosts();
    }
    
    async loadBlogPosts() {
        try {
            // Load the blog index
            const response = await fetch('blog-index.json');
            if (!response.ok) {
                console.warn('Blog index not found, falling back to auto-discovery');
                await this.autoDiscoverPosts();
                return;
            }
            
            const blogIndex = await response.json();
            this.categories = blogIndex.categories || {};
            
            // Load each blog post
            const postsPromises = blogIndex.posts.map(postInfo => this.loadSinglePost(postInfo));
            const loadedPosts = await Promise.all(postsPromises);
            
            // Filter out failed loads
            this.blogPosts = loadedPosts.filter(post => post !== null);
            
            // Sort by date (newest first)
            this.blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Update categories in UI
            this.updateCategoryButtons();
            this.updateNavDropdown();
            
            this.renderBlogPosts();
            this.hideLoading();
            
        } catch (error) {
            console.error('Failed to load blog posts:', error);
            this.showError('Failed to load blog posts');
            this.hideLoading();
        }
    }
    
    async loadSinglePost(postInfo) {
        try {
            const response = await fetch(postInfo.file);
            if (!response.ok) {
                console.warn(`Failed to load post: ${postInfo.file}`);
                return null;
            }
            
            const markdownContent = await response.text();
            const parsed = this.parseMarkdownWithFrontmatter(markdownContent);
            
            return {
                id: postInfo.id,
                ...parsed.frontmatter,
                content: parsed.content,
                category: postInfo.category
            };
        } catch (error) {
            console.error(`Error loading post ${postInfo.file}:`, error);
            return null;
        }
    }
    
    parseMarkdownWithFrontmatter(markdown) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
        const match = markdown.match(frontmatterRegex);
        
        if (!match) {
            return {
                frontmatter: {},
                content: markdown
            };
        }
        
        const frontmatterText = match[1];
        const content = match[2];
        
        // Parse YAML-like frontmatter
        const frontmatter = {};
        frontmatterText.split('\n').forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                // Parse arrays (tags)
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1).split(',').map(item => 
                        item.trim().replace(/['"]/g, '')
                    );
                }
                
                frontmatter[key] = value;
            }
        });
        
        return { frontmatter, content };
    }
    
    // Auto-discovery fallback for when blog-index.json doesn't exist
    async autoDiscoverPosts() {
        // This is a fallback - for full auto-discovery, you'd need a server-side component
        // For now, we'll use a basic structure
        console.warn('Auto-discovery not fully implemented. Please create blog-index.json');
        this.blogPosts = [];
        this.hideLoading();
        this.showEmptyState();
    }
    
    updateCategoryButtons() {
        const categoryContainer = document.getElementById('blog-categories');
        if (!categoryContainer) return;
        
        // Clear existing buttons except "All Posts"
        const allButton = categoryContainer.querySelector('[data-category="all"]');
        categoryContainer.innerHTML = '';
        if (allButton) {
            categoryContainer.appendChild(allButton);
        }
        
        // Add dynamic category buttons
        Object.entries(this.categories).forEach(([key, category]) => {
            const button = document.createElement('button');
            button.className = 'blog-category-btn';
            button.setAttribute('data-category', key);
            button.textContent = category.name;
            categoryContainer.appendChild(button);
        });
        
        // Re-attach event listeners
        this.setupCategoryFilters();
    }
    
    updateNavDropdown() {
        const dropdown = document.getElementById('blog-categories-dropdown');
        const mobileDropdown = document.getElementById('mobile-blog-categories');
        
        // Calculate post counts for each category
        const categoryCounts = {};
        this.blogPosts.forEach(post => {
            categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1;
        });
        
        const totalPosts = this.blogPosts.length;
        
        // Create dropdown items for desktop
        if (dropdown) {
            let dropdownHTML = `
                <div class="blog-dropdown-item all-posts" data-category="all">
                    <div class="category-icon all"></div>
                    <span>All Posts</span>
                    <span class="category-count">${totalPosts}</span>
                </div>
            `;
            
            // Add category items
            Object.entries(this.categories).forEach(([key, category]) => {
                const count = categoryCounts[key] || 0;
                if (count > 0) {
                    dropdownHTML += `
                        <div class="blog-dropdown-item" data-category="${key}">
                            <div class="category-icon ${key}"></div>
                            <span>${category.name}</span>
                            <span class="category-count">${count}</span>
                        </div>
                    `;
                }
            });
            
            dropdown.innerHTML = dropdownHTML;
            
            // Add click handlers for desktop
            dropdown.querySelectorAll('.blog-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const category = item.dataset.category;
                    this.filterBlogsByCategory(category);
                    this.scrollToBlogSection();
                });
            });
        }
        
        // Create mobile dropdown items
        if (mobileDropdown) {
            let mobileHTML = `
                <a href="#blog" class="block px-3 py-2 text-gray-600 dark:text-cream-400 hover:text-cream-600 dark:hover:text-cream-400 transition-colors" data-category="all">
                    <div class="flex items-center">
                        <div class="category-icon all mr-2"></div>
                        <span>All Posts</span>
                        <span class="ml-auto text-xs bg-cream-200 dark:bg-gray-700 text-cream-700 dark:text-cream-300 px-2 py-1 rounded-full">${totalPosts}</span>
                    </div>
                </a>
            `;
            
            Object.entries(this.categories).forEach(([key, category]) => {
                const count = categoryCounts[key] || 0;
                if (count > 0) {
                    mobileHTML += `
                        <a href="#blog" class="block px-3 py-2 text-gray-600 dark:text-cream-400 hover:text-cream-600 dark:hover:text-cream-400 transition-colors" data-category="${key}">
                            <div class="flex items-center">
                                <div class="category-icon ${key} mr-2"></div>
                                <span>${category.name}</span>
                                <span class="ml-auto text-xs bg-cream-200 dark:bg-gray-700 text-cream-700 dark:text-cream-300 px-2 py-1 rounded-full">${count}</span>
                            </div>
                        </a>
                    `;
                }
            });
            
            mobileDropdown.innerHTML = mobileHTML;
            
            // Add click handlers for mobile
            mobileDropdown.querySelectorAll('a').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const category = item.dataset.category;
                    this.filterBlogsByCategory(category);
                    
                    // Close mobile menu
                    const mobileMenu = document.getElementById('mobile-menu');
                    if (mobileMenu) {
                        mobileMenu.classList.add('hidden');
                    }
                    
                    this.scrollToBlogSection();
                });
            });
        }
    }
    
    setupMobileBlogToggle() {
        const mobileToggle = document.getElementById('mobile-blog-toggle');
        const mobileCategories = document.getElementById('mobile-blog-categories');
        const mobileArrow = document.getElementById('mobile-blog-arrow');
        
        if (mobileToggle && mobileCategories && mobileArrow) {
            mobileToggle.addEventListener('click', () => {
                const isHidden = mobileCategories.classList.contains('hidden');
                
                if (isHidden) {
                    mobileCategories.classList.remove('hidden');
                    mobileArrow.style.transform = 'rotate(180deg)';
                } else {
                    mobileCategories.classList.add('hidden');
                    mobileArrow.style.transform = 'rotate(0deg)';
                }
            });
        }
    }
    
    filterBlogsByCategory(category) {
        console.log(`Filtering blogs by category: ${category}`);
        
        // Update current category
        this.currentCategory = category;
        
        // Update active button in blog section
        document.querySelectorAll('.blog-category-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });
        
        // Render filtered posts
        this.renderBlogPosts(category);
        
        // Update URL hash if needed (optional)
        if (category !== 'all') {
            window.history.pushState(null, null, `#blog-${category}`);
        } else {
            window.history.pushState(null, null, '#blog');
        }
    }
    
    scrollToBlogSection() {
        const blogSection = document.getElementById('blog');
        if (blogSection) {
            const offsetTop = blogSection.offsetTop - 100; // Account for fixed nav
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    }
    
    renderBlogPosts(category = 'all') {
        const container = document.getElementById('blog-posts');
        const filteredPosts = category === 'all' 
            ? this.blogPosts 
            : this.blogPosts.filter(post => post.category === category);
        
        console.log(`Rendering ${filteredPosts.length} posts for category: ${category}`);
        
        if (filteredPosts.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideEmptyState();
        
        container.innerHTML = filteredPosts.map(post => `
            <article class="blog-post-card group cursor-pointer" data-post-id="${post.id}">
                <div class="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-cream-200 dark:border-cream-600 overflow-hidden hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-4">
                            <span class="category-badge category-${post.category}">${this.getCategoryName(post.category)}</span>
                            <span class="text-sm text-gray-500 dark:text-cream-400">${post.readTime || 'Quick read'}</span>
                        </div>
                        
                        <h3 class="text-xl font-bold mb-3 group-hover:text-cream-600 dark:group-hover:text-cream-400 transition-colors">
                            ${post.title}
                        </h3>
                        
                        <p class="text-gray-600 dark:text-cream-300 mb-4 leading-relaxed">
                            ${post.excerpt || this.generateExcerpt(post.content)}
                        </p>
                        
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-500 dark:text-cream-400">
                                ${this.formatDate(post.date)}
                            </span>
                            <div class="flex flex-wrap gap-2">
                                ${(post.tags || []).slice(0, 2).map(tag => `
                                    <span class="text-xs px-2 py-1 bg-cream-100 dark:bg-[#1a1a1a] text-cream-700 dark:text-cream-400 rounded-full dark:border dark:border-cream-600">
                                        ${tag}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Debug info -->
                        <div class="mt-2 text-xs text-gray-400 opacity-50">
                            Post ID: ${post.id} | Content length: ${post.content ? post.content.length : 0} chars
                        </div>
                    </div>
                </div>
            </article>
        `).join('');
        
        // Add click handlers for blog posts
        container.querySelectorAll('.blog-post-card').forEach(card => {
            card.addEventListener('click', () => {
                const postId = card.dataset.postId;
                console.log(`Clicked on post card with ID: ${postId}`);
                this.openBlogPost(postId);
            });
        });
        
        console.log(`Added click handlers to ${container.querySelectorAll('.blog-post-card').length} blog cards`);
    }
    
    generateExcerpt(content, maxLength = 150) {
        // Remove markdown headers and formatting for excerpt
        const plainText = content
            .replace(/^#+\s+/gm, '') // Remove headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`(.*?)`/g, '$1') // Remove inline code
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/\n/g, ' ') // Replace newlines with spaces
            .trim();
        
        return plainText.length > maxLength 
            ? plainText.substring(0, maxLength) + '...'
            : plainText;
    }
    
    getCategoryName(category) {
        return this.categories[category]?.name || category.charAt(0).toUpperCase() + category.slice(1);
    }
    
    formatDate(dateString) {
        if (!dateString) return 'Recently';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    openBlogPost(postId) {
        const post = this.blogPosts.find(p => p.id === postId);
        if (!post) {
            console.error(`Post not found: ${postId}`);
            return;
        }

        console.log('Opening post:', post.title);
        
        // Navigate to the dedicated blog post page
        window.location.href = `blog-post.html?id=${postId}`;
    }
    
    renderMarkdownContent(content) {
        if (!content) {
            return '<p class="text-gray-500 italic">No content available.</p>';
        }
        
        try {
            // Configure marked for better rendering
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    sanitize: false,
                    smartypants: false,
                    headerIds: false,
                    mangle: false,
                    highlight: function(code, lang) {
                        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                            try {
                                return hljs.highlight(code, { language: lang }).value;
                            } catch (err) {
                                console.warn('Syntax highlighting failed:', err);
                            }
                        }
                        return code;
                    }
                });
                
                // Clean the content first to prevent rendering issues
                const cleanContent = content
                    .replace(/^\s+/gm, '') // Remove leading whitespace that might cause issues
                    .replace(/\r\n/g, '\n') // Normalize line endings
                    .trim();
                
                return marked.parse(cleanContent);
            } else {
                console.warn('Marked.js not loaded, displaying raw content');
                return `<pre class="whitespace-pre-wrap">${this.escapeHtml(content)}</pre>`;
            }
        } catch (error) {
            console.error('Error rendering markdown:', error);
            return `<div class="text-red-500">Error rendering content: ${error.message}</div>`;
        }
    }
    
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    hideLoading() {
        const loading = document.getElementById('blog-loading');
        if (loading) loading.style.display = 'none';
    }
    
    showEmptyState() {
        const empty = document.getElementById('blog-empty');
        if (empty) empty.classList.remove('hidden');
    }
    
    hideEmptyState() {
        const empty = document.getElementById('blog-empty');
        if (empty) empty.classList.add('hidden');
    }
    
    showError(message) {
        const container = document.getElementById('blog-posts');
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-red-500 mb-4">
                    <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                </div>
                <p class="text-gray-600 dark:text-gray-400">${message}</p>
            </div>
        `;
    }
    
    // Animations
    setupAnimations() {
        // Intersection Observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);
        
        // Observe elements for animation
        document.querySelectorAll('section, .blog-post-card, .contact-card').forEach(el => {
            observer.observe(el);
        });
        
        // Parallax effect for floating elements
        this.setupParallax();
    }
    
    setupParallax() {
        let ticking = false;
        
        const updateParallax = () => {
            const scrolled = window.pageYOffset;
            const parallax = document.querySelectorAll('.animate-float');
            
            parallax.forEach((element, index) => {
                const speed = 0.1 + (index * 0.05);
                const yPos = -(scrolled * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
            
            ticking = false;
        };
        
        const requestTick = () => {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        };
        
        window.addEventListener('scroll', requestTick);
    }
    
    // Event Listeners
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (mobileMenuToggle && mobileMenu) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }
        
        // Mobile blog dropdown toggle
        this.setupMobileBlogToggle();
        
        // Blog category filters
        this.setupCategoryFilters();
        
        // Smooth scroll to top on logo click
        document.querySelector('nav .text-xl').addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    setupCategoryFilters() {
        document.querySelectorAll('.blog-category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.blog-category-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                
                // Filter posts
                const category = btn.dataset.category;
                this.currentCategory = category;
                this.renderBlogPosts(category);
            });
        });
    }
}

// Initialize the website when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.personalWebsite = new PersonalWebsite();
});

// Handle page reload/refresh state
window.addEventListener('beforeunload', () => {
    // Save any necessary state
    localStorage.setItem('lastVisit', new Date().toISOString());
}); 