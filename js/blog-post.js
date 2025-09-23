// Blog Post Page JavaScript

class BlogPostPage {
    constructor() {
        this.post = null;
        this.categories = {};
        this.init();
    }
    
    init() {
        this.setupTheme();
        this.loadPost();
        this.setupEventListeners();
    }
    
    setupTheme() {
        // Check for saved theme preference or default to 'light'
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const isDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
    
    toggleTheme() {
        const isDarkMode = document.documentElement.classList.contains('dark');
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
    }
    
    async loadPost() {
        try {
            // Get post ID from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const postId = urlParams.get('id');
            
            if (!postId) {
                this.showError('No post ID specified');
                return;
            }
            
            console.log('Loading post:', postId);
            
            // Load blog index first
            const indexResponse = await fetch('blog-index.json');
            if (!indexResponse.ok) {
                throw new Error('Failed to load blog index');
            }
            
            const blogIndex = await indexResponse.json();
            this.categories = blogIndex.categories || {};
            
            // Find the post in the index
            const postInfo = blogIndex.posts.find(p => p.id === postId);
            if (!postInfo) {
                this.showError('Post not found in index');
                return;
            }
            
            // Load the actual post content
            const postResponse = await fetch(postInfo.file);
            if (!postResponse.ok) {
                throw new Error('Failed to load post content');
            }
            
            const markdownContent = await postResponse.text();
            const parsed = this.parseMarkdownWithFrontmatter(markdownContent);
            
            this.post = {
                id: postInfo.id,
                ...parsed.frontmatter,
                content: parsed.content,
                category: postInfo.category
            };
            
            this.renderPost();
            this.hideLoading();
            
        } catch (error) {
            console.error('Error loading post:', error);
            this.showError('Failed to load post: ' + error.message);
            this.hideLoading();
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
    
    renderPost() {
        if (!this.post) return;
        
        // Update page title and meta
        document.title = `${this.post.title} - Your Name`;
        const metaDescription = document.getElementById('post-description');
        if (metaDescription) {
            metaDescription.setAttribute('content', this.post.excerpt || this.generateExcerpt(this.post.content));
        }
        
        // Update post header
        const categoryElement = document.getElementById('post-category');
        const dateElement = document.getElementById('post-date');
        const readTimeElement = document.getElementById('post-read-time');
        const titleElement = document.getElementById('post-title-display');
        const excerptElement = document.getElementById('post-excerpt');
        
        if (categoryElement) {
            categoryElement.textContent = this.getCategoryName(this.post.category);
            categoryElement.className = `category-badge category-${this.post.category}`;
        }
        
        if (dateElement) {
            dateElement.textContent = this.formatDate(this.post.date);
        }
        
        if (readTimeElement) {
            readTimeElement.textContent = this.post.readTime || this.calculateReadingTime(this.post.content);
        }
        
        if (titleElement) {
            titleElement.textContent = this.post.title;
        }
        
        if (excerptElement) {
            excerptElement.textContent = this.post.excerpt || this.generateExcerpt(this.post.content);
        }
        
        // Render post content
        const bodyElement = document.getElementById('post-body');
        if (bodyElement) {
            bodyElement.innerHTML = this.renderMarkdownContent(this.post.content);
        }
        
        // Update footer
        const footerDateElement = document.getElementById('post-date-footer');
        if (footerDateElement) {
            footerDateElement.textContent = this.formatDate(this.post.date);
        }
        
        // Render tags
        const tagsElement = document.getElementById('post-tags');
        if (tagsElement && this.post.tags) {
            tagsElement.innerHTML = this.post.tags.map(tag => `
                <span class="text-xs px-3 py-1 bg-cream-200 dark:bg-gray-700 text-cream-700 dark:text-cream-300 rounded-full border border-cream-300 dark:border-cream-600">
                    #${tag}
                </span>
            `).join('');
        }
        
        // Initialize syntax highlighting
        if (typeof hljs !== 'undefined') {
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
        
        // Show the post content
        const contentElement = document.getElementById('post-content');
        if (contentElement) {
            contentElement.classList.remove('hidden');
        }
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
    
    generateExcerpt(content, maxLength = 200) {
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
        const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const month = shortMonths[date.getMonth()];
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month} ${day}, ${year}`;
    }
    
    calculateReadingTime(content) {
        // Remove markdown syntax and HTML tags for accurate word count
        const plainText = content
            .replace(/#{1,6}\s/g, '') // Remove markdown headers
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*([^*]+)\*/g, '$1') // Remove italic markdown
            .replace(/`([^`]+)`/g, '$1') // Remove inline code
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\n/g, ' ') // Replace newlines with spaces
            .trim();
        
        // Count words (split by whitespace and filter out empty strings)
        const words = plainText.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        
        // Average reading speed: 200-250 words per minute
        // Using 225 words per minute as a middle ground
        const wordsPerMinute = 225;
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        
        if (minutes < 1) {
            return 'Quick read';
        } else if (minutes === 1) {
            return '1 min read';
        } else {
            return `${minutes} min read`;
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
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }
    
    showError(message) {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        
        if (loading) loading.classList.add('hidden');
        if (error) {
            error.classList.remove('hidden');
            const errorText = error.querySelector('p');
            if (errorText) {
                errorText.textContent = message;
            }
        }
    }
    
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BlogPostPage();
}); 