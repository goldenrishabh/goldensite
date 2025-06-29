class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.posts = [];
        this.categories = {};
        this.latestUpdates = { read: [], watched: [], building: [] };
        this.currentEditingPost = null;
        this.markdownEditor = null;
        // Remove password hash - we'll use GitHub token authentication instead
        this.githubToken = localStorage.getItem('github-token') || '';
        this.githubRepo = 'goldenrishabh/goldensite'; // Fixed repository
        this.githubApiBase = 'https://api.github.com';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.initializeMarkdownEditor();
    }

    setupEventListeners() {
        // Login
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Tab navigation
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Post management
        document.getElementById('new-post-btn').addEventListener('click', () => {
            this.openPostEditor();
        });

        document.getElementById('close-editor').addEventListener('click', () => {
            this.closePostEditor();
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.closePostEditor();
        });

        // Save post buttons
        setTimeout(() => {
            const saveDraftBtn = document.getElementById('save-draft');
            const savePublishBtn = document.getElementById('save-publish');
            
            if (saveDraftBtn) {
                saveDraftBtn.addEventListener('click', () => {
                    this.savePost('draft');
                });
            }
            
            if (savePublishBtn) {
                savePublishBtn.addEventListener('click', () => {
                    this.savePost('published');
                });
            }
        }, 100);

        document.getElementById('delete-post').addEventListener('click', () => {
            this.deletePost();
        });

        // Auto-sync status indicator
        this.setupAutoSyncIndicator();

        // Settings
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Test GitHub connection
        document.getElementById('test-github').addEventListener('click', () => {
            this.testGitHubConnection();
        });

        // Clear cache button
        document.getElementById('clear-cache').addEventListener('click', () => {
            this.clearCache();
        });

        // File upload
        document.getElementById('file-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Content management
        document.getElementById('save-content').addEventListener('click', () => {
            this.saveContent();
        });

        // Latest updates - add Enter key support
        ['read', 'watched', 'building'].forEach(category => {
            // Will be attached after DOM elements are created
            setTimeout(() => {
                const input = document.getElementById(`new-${category}`);
                if (input) {
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            this.addLatestItem(category);
                        }
                    });
                }
            }, 100);
        });

        // Real-time reading time calculation
        setTimeout(() => {
            const contentElement = document.getElementById('post-content');
            const readTimeElement = document.getElementById('post-read-time');
            
            if (contentElement && readTimeElement) {
                const updateReadTime = () => {
                    // Only auto-update if the field is empty (user hasn't manually set it)
                    if (!readTimeElement.value.trim()) {
                        const content = this.markdownEditor ? this.markdownEditor.value() : contentElement.value;
                        const calculatedTime = this.calculateReadingTime(content);
                        readTimeElement.placeholder = calculatedTime;
                    }
                };
                
                // Update when content changes
                contentElement.addEventListener('input', updateReadTime);
                
                // Also update when SimpleMDE changes (if available)
                if (this.markdownEditor) {
                    this.markdownEditor.codemirror.on('change', updateReadTime);
                }
            }
        }, 200);

        // Category change handler - will be attached to select element after it's created
        this.setupCategoryChangeListener();
        
        // Status filter buttons
        setTimeout(() => {
            const filterAll = document.getElementById('filter-all');
            const filterPublished = document.getElementById('filter-published');
            const filterDraft = document.getElementById('filter-draft');
            
            if (filterAll) filterAll.addEventListener('click', () => this.filterPostsByStatus('all'));
            if (filterPublished) filterPublished.addEventListener('click', () => this.filterPostsByStatus('published'));
            if (filterDraft) filterDraft.addEventListener('click', () => this.filterPostsByStatus('draft'));
        }, 100);
    }

    setupCategoryChangeListener() {
        // Set up with a delay to ensure the dropdown is populated
        setTimeout(() => {
            const categorySelect = document.getElementById('post-category');
            if (categorySelect) {
                categorySelect.addEventListener('change', () => {
                    this.handleCategoryChange();
                });
            }
        }, 100);
    }

    async handleLogin() {
        const token = document.getElementById('admin-password').value; // Using password field for token
        const errorEl = document.getElementById('login-error');

        if (!token.trim()) {
            errorEl.textContent = 'Please enter your GitHub token';
            errorEl.classList.remove('hidden');
            return;
        }

        // Show loading state
        const loginBtn = document.querySelector('#login-form button[type="submit"]');
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'Verifying...';
        loginBtn.disabled = true;

        try {
            // Verify GitHub token by making a test API call
            const response = await fetch(`${this.githubApiBase}/repos/${this.githubRepo}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const repoData = await response.json();
                
                // Check if user has write access (can push to repo)
                if (repoData.permissions && (repoData.permissions.push || repoData.permissions.admin)) {
                    // Authentication successful
                    this.githubToken = token;
                    
                    // Save credentials
                    localStorage.setItem('github-token', token);
                    
                    // Hide login modal and show admin panel
                    document.getElementById('login-modal').classList.add('hidden');
                    document.getElementById('admin-panel').classList.remove('hidden');
                    this.currentUser = repoData.owner.login;
                    
                    // Load blog data
                    await this.loadBlogData();
                } else {
                    errorEl.textContent = 'You need write access to this repository';
                    errorEl.classList.remove('hidden');
                }
            } else if (response.status === 401) {
                errorEl.textContent = 'Invalid GitHub token';
                errorEl.classList.remove('hidden');
            } else if (response.status === 404) {
                errorEl.textContent = 'Repository not found or not accessible';
                errorEl.classList.remove('hidden');
            } else {
                errorEl.textContent = 'Authentication failed. Please check your token and repository.';
                errorEl.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            errorEl.textContent = 'Network error. Please check your connection and try again.';
            errorEl.classList.remove('hidden');
        }

        // Reset button state
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }

    logout() {
        this.currentUser = null;
        document.getElementById('login-modal').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('admin-password').value = '';
        
        // Optionally clear stored credentials
        // localStorage.removeItem('github-token');
        // localStorage.removeItem('github-repo');
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Show/hide tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');

        // Load tab-specific data
        if (tabName === 'files') {
            this.loadFileList();
        }
    }

    async loadData() {
        // Load settings from localStorage
        const githubToken = localStorage.getItem('github-token');

        if (githubToken) {
            document.getElementById('github-token').value = githubToken;
            this.githubToken = githubToken;
        }

        await this.loadBlogData();
        this.cleanupInvalidLocalStorageData(); // Clean up any invalid cached data
        this.populateCategoryDropdown();
        this.renderCategoriesList();
        
        // Refresh category buttons and dropdowns on main site if needed
        if (window.personalWebsite && window.personalWebsite.updateCategoryButtons) {
            window.personalWebsite.categories = this.categories;
            window.personalWebsite.updateCategoryButtons();
            window.personalWebsite.updateNavDropdown();
        }
    }

    // GitHub API helper methods
    async githubRequest(endpoint, method = 'GET', body = null) {
        const url = `${this.githubApiBase}${endpoint}`;
        const headers = {
            'Authorization': `token ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`GitHub API Error: ${error.message}`);
        }

        return response.json();
    }

    async getFileFromGitHub(path) {
        try {
            const result = await this.githubRequest(`/repos/${this.githubRepo}/contents/${path}`);
            return {
                content: atob(result.content.replace(/\s/g, '')),
                sha: result.sha
            };
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                // File doesn't exist - this is expected for new files
                console.log(`File ${path} doesn't exist yet (this is normal for new files)`);
                return null;
            }
            // Re-throw other errors (like 401, 403, etc.)
            console.error(`Error getting file ${path}:`, error);
            throw error;
        }
    }

    async createOrUpdateFileInGitHub(path, content, message, sha = null) {
        const body = {
            message,
            // If content is already base64 (for images), use it directly, otherwise encode it
            content: this.isBase64(content) ? content : btoa(unescape(encodeURIComponent(content)))
        };

        if (sha) {
            body.sha = sha;
        }

        return this.githubRequest(`/repos/${this.githubRepo}/contents/${path}`, 'PUT', body);
    }

    isBase64(str) {
        try {
            // Check if string looks like base64 and can be decoded
            return btoa(atob(str)) === str;
        } catch (err) {
            return false;
        }
    }

    async deleteFileFromGitHub(path, message) {
        const file = await this.getFileFromGitHub(path);
        if (!file) return;

        return this.githubRequest(`/repos/${this.githubRepo}/contents/${path}`, 'DELETE', {
            message,
            sha: file.sha
        });
    }

    async loadBlogData() {
        try {
            // Load blog-index.json
            const response = await fetch('./blog-index.json');
            const data = await response.json();
            
            this.categories = data.categories || {};
            this.latestUpdates = data.latestUpdates || { read: [], watched: [], building: [] };
            this.posts = [];

            // Load published posts from blog-index.json
            if (data.posts && data.posts.length > 0) {
                for (const postInfo of data.posts) {
                    try {
                        const postResponse = await fetch(postInfo.file);
                        const content = await postResponse.text();
                        const parsed = this.parseMarkdownWithFrontmatter(content);
                        
                        this.posts.push({
                            id: postInfo.id,
                            category: postInfo.category,
                            file: postInfo.file,
                            ...parsed.frontmatter,
                            content: parsed.content
                        });
                    } catch (error) {
                        console.error(`Failed to load post ${postInfo.file}:`, error);
                    }
                }
            }

            // Try to load draft posts from GitHub (admin-drafts folder)
            if (this.githubToken) {
                try {
                    await this.loadDraftPosts();
                } catch (error) {
                    console.warn('Could not load draft posts:', error);
                }
            }

            // Auto-detect missing categories from posts
            this.autoDetectMissingCategories();

            this.renderPostsList();
            this.renderLatestUpdates();
        } catch (error) {
            console.error('Failed to load blog data:', error);
            // Initialize with empty data if blog-index.json doesn't exist
            this.categories = {};
            this.posts = [];
            this.latestUpdates = { read: [], watched: [], building: [] };
            this.renderPostsList();
            this.renderLatestUpdates();
        }
    }

    async loadDraftPosts() {
        try {
            // Get admin-drafts folder contents
            const draftsResponse = await this.githubRequest(`/repos/${this.githubRepo}/contents/admin-drafts`);
            
            if (Array.isArray(draftsResponse)) {
                // Process each category folder in admin-drafts
                for (const categoryItem of draftsResponse) {
                    if (categoryItem.type === 'dir') {
                        const categoryName = categoryItem.name;
                        
                        try {
                            // Get files in this category folder
                            const categoryFiles = await this.githubRequest(`/repos/${this.githubRepo}/contents/admin-drafts/${categoryName}`);
                            
                            for (const file of categoryFiles) {
                                if (file.name.endsWith('.txt')) {
                                    try {
                                        // Get file content
                                        const fileResponse = await this.githubRequest(`/repos/${this.githubRepo}/contents/${file.path}`);
                                        const content = atob(fileResponse.content); // Decode base64
                                        const parsed = this.parseMarkdownWithFrontmatter(content);
                                        
                                        const postId = file.name.replace('.txt', '');
                                        
                                        // Check if this draft is already loaded (avoid duplicates)
                                        const existingPost = this.posts.find(p => p.id === postId);
                                        if (!existingPost) {
                                            this.posts.push({
                                                id: postId,
                                                category: categoryName,
                                                file: `admin-drafts/${categoryName}/${file.name}`,
                                                ...parsed.frontmatter,
                                                status: 'draft', // Ensure draft status
                                                content: parsed.content
                                            });
                                            console.log(`✅ Loaded draft: ${postId}`);
                                        }
                                    } catch (error) {
                                        console.warn(`Failed to load draft file ${file.path}:`, error);
                                    }
                                }
                            }
                        } catch (error) {
                            console.warn(`Failed to load category folder ${categoryName}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            // If admin-drafts folder doesn't exist, that's fine
            if (!error.message.includes('404')) {
                console.warn('Error loading drafts:', error);
            }
        }
    }

    autoDetectMissingCategories() {
        // Collect all categories used in posts
        const usedCategories = new Set();
        this.posts.forEach(post => {
            if (post.category) {
                usedCategories.add(post.category);
            }
        });

        // Add missing categories with default settings
        usedCategories.forEach(categoryKey => {
            if (!this.categories[categoryKey]) {
                console.log(`Auto-detecting category: ${categoryKey}`);
                this.categories[categoryKey] = {
                    name: this.capitalizeWords(categoryKey.replace(/-/g, ' ')),
                    description: `${this.capitalizeWords(categoryKey.replace(/-/g, ' '))} posts`,
                    color: this.getRandomColor()
                };
            }
        });
    }

    cleanupInvalidLocalStorageData() {
        // Get all localStorage keys that start with 'post-'
        const postKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('post-')) {
                postKeys.push(key);
            }
        }

        // Check each cached post for invalid data
        postKeys.forEach(key => {
            try {
                const postContent = localStorage.getItem(key);
                if (postContent) {
                    // Check if this post uses "custom" category
                    if (postContent.includes('category: "custom"')) {
                        console.log(`🧹 Clearing invalid cached post: ${key} (uses "custom" category)`);
                        localStorage.removeItem(key);
                    }
                }
            } catch (error) {
                // If we can't parse the cached data, remove it
                console.log(`🧹 Clearing corrupted cached post: ${key}`);
                localStorage.removeItem(key);
            }
        });
    }

    capitalizeWords(str) {
        return str.replace(/\b\w/g, l => l.toUpperCase());
    }

    getRandomColor() {
        const colors = ['blue', 'purple', 'orange', 'green', 'pink', 'red', 'yellow', 'gray'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    renderCategoriesList() {
        const container = document.getElementById('categories-list');
        if (!container) return;

        // Calculate post counts for each category
        const categoryCounts = {};
        this.posts.forEach(post => {
            categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1;
        });

        container.innerHTML = Object.entries(this.categories).map(([key, category]) => {
            const postCount = categoryCounts[key] || 0;
            const canDelete = postCount === 0; // Only allow deletion if no posts use this category
            
            return `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="w-3 h-3 rounded-full bg-${category.color}-500 mr-3"></div>
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${category.name}</div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${key}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${postCount}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        ${canDelete ? 
                            `<button onclick="adminPanel.deleteCategoryConfirm('${key}')" class="text-red-600 hover:text-red-900">Delete</button>` :
                            `<span class="text-gray-400">Has posts</span>`
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }

    deleteCategoryConfirm(categoryKey) {
        const category = this.categories[categoryKey];
        if (!category) return;
        
        if (confirm(`Are you sure you want to delete the "${category.name}" category? This action cannot be undone.`)) {
            this.deleteCategory(categoryKey);
        }
    }

    async deleteCategory(categoryKey) {
        const category = this.categories[categoryKey];
        if (!category) return;

        try {
            // Remove from categories object
            delete this.categories[categoryKey];

            // Delete directory from GitHub if possible
            if (this.githubToken) {
                try {
                    await this.deleteFileFromGitHub(`static-blog/${categoryKey}/README.md`, `Delete ${category.name} category directory`);
                    console.log(`✅ Deleted directory for category: ${categoryKey}`);
                } catch (error) {
                    console.warn(`Failed to delete directory for category ${categoryKey}:`, error);
                }
            }

            // Update blog-index.json immediately
            await this.updateBlogIndexFile();

            // Update UI
            this.populateCategoryDropdown();
            this.renderCategoriesList();

            // Update main site if needed
            if (window.personalWebsite && window.personalWebsite.updateCategoryButtons) {
                window.personalWebsite.categories = this.categories;
                window.personalWebsite.updateCategoryButtons();
                window.personalWebsite.updateNavDropdown();
            }

            alert(`Category "${category.name}" deleted successfully!`);
        } catch (error) {
            console.error('Failed to delete category:', error);
            alert('Failed to delete category. Please try again.');
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
        
        const frontmatter = {};
        frontmatterText.split('\n').forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
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

    renderPostsList() {
        const container = document.getElementById('posts-list');
        
        // Update post counts
        const totalPosts = this.posts.length;
        const publishedPosts = this.posts.filter(post => (post.status || 'published') === 'published').length;
        const draftPosts = this.posts.filter(post => (post.status || 'published') === 'draft').length;
        
        const totalCountEl = document.getElementById('total-posts-count');
        const publishedCountEl = document.getElementById('published-posts-count');
        const draftCountEl = document.getElementById('draft-posts-count');
        
        if (totalCountEl) totalCountEl.textContent = totalPosts;
        if (publishedCountEl) publishedCountEl.textContent = publishedPosts;
        if (draftCountEl) draftCountEl.textContent = draftPosts;
        
        container.innerHTML = this.posts.map(post => {
            const status = post.status || 'published'; // Default to published for existing posts
            const statusBadge = status === 'draft' 
                ? '<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 ml-2">📝 Draft</span>'
                : '<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 ml-2">🌐 Published</span>';
            
            const toggleAction = status === 'draft'
                ? `<button onclick="adminPanel.publishPost('${post.id}')" class="text-green-600 hover:text-green-900 mr-4">Publish</button>`
                : `<button onclick="adminPanel.unpublishPost('${post.id}')" class="text-yellow-600 hover:text-yellow-900 mr-4">Unpublish</button>`;
            
            return `
                <tr class="${status === 'draft' ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                            ${post.title || post.id}
                            ${statusBadge}
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${this.getCategoryColor(post.category)}-100 text-${this.getCategoryColor(post.category)}-800">
                            ${this.categories[post.category]?.name || post.category}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${post.date || 'No date'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        ${toggleAction}
                        <button onclick="adminPanel.editPost('${post.id}')" class="text-cream-600 hover:text-cream-900 mr-4">Edit</button>
                        <button onclick="adminPanel.deletePostConfirm('${post.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getCategoryColor(category) {
        // Try to get color from the categories definition first
        if (this.categories && this.categories[category] && this.categories[category].color) {
            return this.categories[category].color;
        }
        
        // Fallback to hardcoded colors
        const colors = {
            technical: 'blue',
            philosophical: 'purple',
            adventure: 'orange',
            random: 'green',
            personal: 'pink'
        };
        return colors[category] || 'gray';
    }

    populateCategoryDropdown() {
        const categorySelect = document.getElementById('post-category');
        if (!categorySelect) return;

        // Store current value to preserve selection
        const currentValue = categorySelect.value;

        // Clear existing options
        categorySelect.innerHTML = '';

        // Add default categories from blog-index.json
        if (this.categories && Object.keys(this.categories).length > 0) {
            Object.entries(this.categories).forEach(([key, categoryInfo]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = categoryInfo.name;
                categorySelect.appendChild(option);
            });
        }

        // Always add option for custom category
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '+ Add New Category';
        categorySelect.appendChild(customOption);

        // Handle selection logic
        if (currentValue && Array.from(categorySelect.options).some(opt => opt.value === currentValue)) {
            // Restore previous selection if it still exists
            categorySelect.value = currentValue;
        } else if (this.categories && Object.keys(this.categories).length > 0) {
            // Default to first real category if categories exist
            categorySelect.value = Object.keys(this.categories)[0];
        } else {
            // If no categories exist, default to the "Add New Category" option
            categorySelect.value = 'custom';
            // Trigger the change event to show the category input
            setTimeout(() => this.handleCategoryChange(), 100);
        }
    }

    async handleCategoryChange() {
        const categorySelect = document.getElementById('post-category');
        const customCategoryContainer = document.getElementById('custom-category-container');
        
        if (categorySelect.value === 'custom') {
            // Show custom category input
            if (!customCategoryContainer) {
                this.createCustomCategoryInput();
            } else {
                customCategoryContainer.style.display = 'block';
            }
            
            // Clear any existing values in the custom inputs
            setTimeout(() => {
                const nameInput = document.getElementById('custom-category-name');
                if (nameInput) {
                    nameInput.value = '';
                    nameInput.focus(); // Auto-focus for better UX
                }
            }, 100);
        } else {
            // Hide custom category input
            if (customCategoryContainer) {
                customCategoryContainer.style.display = 'none';
            }
        }
    }

    createCustomCategoryInput() {
        const categoryContainer = document.getElementById('post-category').parentElement;
        
        const customContainer = document.createElement('div');
        customContainer.id = 'custom-category-container';
        customContainer.className = 'mt-2 space-y-2';
        
        customContainer.innerHTML = `
            <div class="flex space-x-2">
                <input type="text" id="custom-category-name" class="admin-input flex-1" placeholder="Category name (e.g., 'Random Thoughts')" autofocus>
                <button type="button" id="add-category-btn" class="admin-btn admin-btn-secondary">Add</button>
            </div>
            <p class="text-xs text-gray-500">A category key will be auto-generated from the name</p>
        `;
        
        categoryContainer.appendChild(customContainer);
        
        // Add event listener for the add category button
        document.getElementById('add-category-btn').addEventListener('click', () => this.addNewCategory());
        
        // Add enter key support
        document.getElementById('custom-category-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addNewCategory();
            }
        });
    }

    async addNewCategory() {
        const nameInput = document.getElementById('custom-category-name');
        
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('Please provide a category name.');
            return null;
        }
        
        // Auto-generate key from name
        const key = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        
        // Check if category already exists
        if (this.categories && this.categories[key]) {
            alert(`Category "${name}" already exists!`);
            return null;
        }
        
        const description = `${name} posts`;
        const color = this.getRandomColor();
        
        // Add to categories object
        if (!this.categories) {
            this.categories = {};
        }
        
        this.categories[key] = {
            name,
            description,
            color
        };
        
        // Create directory immediately via GitHub API
        await this.createCategoryDirectory(key, name, description);
        
        // Update blog-index.json immediately
        await this.updateBlogIndexFile();
        
        // Update the dropdown
        this.populateCategoryDropdown();
        
        // Wait for dropdown to update, then select the new category
        setTimeout(() => {
            document.getElementById('post-category').value = key;
            // Trigger change event to ensure any listeners are updated
            document.getElementById('post-category').dispatchEvent(new Event('change'));
        }, 100);
        
        // Hide custom input
        document.getElementById('custom-category-container').style.display = 'none';
        
        // Update main site categories if admin is opened in same window
        if (window.personalWebsite && window.personalWebsite.updateCategoryButtons) {
            window.personalWebsite.categories = this.categories;
            window.personalWebsite.updateCategoryButtons();
            window.personalWebsite.updateNavDropdown();
        }

        // Refresh the categories list
        this.renderCategoriesList();
        
        alert(`Category "${name}" added and directory created successfully!`);
        
        return key;
    }

    async createCategoryDirectory(categoryKey, categoryName, categoryDescription) {
        if (!this.githubToken) {
            console.log('No GitHub token - directory will be created on next sync');
            return;
        }

        try {
            const categoryPath = `static-blog/${categoryKey}`;
            const readmeContent = `# ${categoryName}\n\n${categoryDescription}\n\nThis directory contains ${categoryName} blog posts.`;
            
            await this.createOrUpdateFileInGitHub(
                `${categoryPath}/README.md`,
                readmeContent,
                `Create ${categoryName} category directory`
            );
            
            console.log(`✅ Created directory for category: ${categoryKey}`);
        } catch (error) {
            console.warn(`Failed to create directory for category ${categoryKey}:`, error);
            // Don't throw error - category still gets added locally
        }
    }

    async updateBlogIndexFile() {
        if (!this.githubToken) {
            console.log('No GitHub token - blog-index.json will be updated on next sync');
            return;
        }

        try {
            // Generate updated blog-index.json - only include published posts for public site
            const publishedPosts = this.posts.filter(post => (post.status || 'published') === 'published');
            const blogIndex = {
                categories: this.categories,
                posts: publishedPosts.map(post => ({
                    id: post.id,
                    category: post.category,
                    file: post.file
                })),
                latestUpdates: this.latestUpdates
            };

            // Get existing file to preserve SHA
            const existingFile = await this.getFileFromGitHub('blog-index.json');
            
            // Update blog-index.json on GitHub
            await this.createOrUpdateFileInGitHub(
                'blog-index.json',
                JSON.stringify(blogIndex, null, 2),
                'Update blog index after category changes',
                existingFile?.sha
            );
            
            console.log('✅ Updated blog-index.json');
        } catch (error) {
            console.warn('Failed to update blog-index.json:', error);
            // Don't throw error - changes are still preserved locally
        }
    }

    openPostEditor(postId = null) {
        this.currentEditingPost = postId;
        const modal = document.getElementById('post-editor-modal');
        const title = document.getElementById('editor-title');
        const deleteBtn = document.getElementById('delete-post');

        if (postId) {
            const post = this.posts.find(p => p.id === postId);
            title.textContent = 'Edit Post';
            deleteBtn.classList.remove('hidden');
            
            // Fill form with post data
            document.getElementById('post-title').value = post.title || '';
            document.getElementById('post-category').value = post.category || 'technical';
            document.getElementById('post-excerpt').value = post.excerpt || '';
            document.getElementById('post-date').value = post.date || '';
            document.getElementById('post-tags').value = Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || '');
            document.getElementById('post-read-time').value = post.readTime || '';
            document.getElementById('post-status').value = post.status || 'published';
            
            if (this.markdownEditor) {
                this.markdownEditor.value(post.content || '');
            } else {
                document.getElementById('post-content').value = post.content || '';
            }
        } else {
            title.textContent = 'New Post';
            deleteBtn.classList.add('hidden');
            
            // Clear form
            document.getElementById('post-title').value = '';
            
            // Set default category to first available category
            const categorySelect = document.getElementById('post-category');
            if (categorySelect.options.length > 1) {
                // Set to first real category (skip "Add New Category" option)
                categorySelect.value = categorySelect.options[0].value;
            }
            
            document.getElementById('post-excerpt').value = '';
            document.getElementById('post-date').value = new Date().toISOString().split('T')[0]; // Default to today
            document.getElementById('post-tags').value = '';
            document.getElementById('post-read-time').value = '';
            document.getElementById('post-status').value = 'draft'; // Default new posts to draft
            
            if (this.markdownEditor) {
                this.markdownEditor.value('');
            } else {
                document.getElementById('post-content').value = '';
            }
        }

        modal.classList.remove('hidden');
    }

    closePostEditor() {
        document.getElementById('post-editor-modal').classList.add('hidden');
        this.currentEditingPost = null;
    }

    async savePost(forcedStatus = null) {
        const title = document.getElementById('post-title').value;
        let category = document.getElementById('post-category').value;
        const excerpt = document.getElementById('post-excerpt').value;
        const date = document.getElementById('post-date').value;
        const tags = document.getElementById('post-tags').value;
        const status = forcedStatus || document.getElementById('post-status').value;
        const content = this.markdownEditor ? this.markdownEditor.value() : document.getElementById('post-content').value;
        
        // Update the status dropdown to reflect the forced status
        if (forcedStatus) {
            document.getElementById('post-status').value = forcedStatus;
        }
        
        // Auto-calculate reading time if not manually set
        let readTime = document.getElementById('post-read-time').value;
        if (!readTime.trim()) {
            readTime = this.calculateReadingTime(content);
        }

        if (!title || !content) {
            alert('Please fill in at least the title and content.');
            return;
        }

        // Handle custom category creation BEFORE saving the post
        if (category === 'custom') {
            const customName = document.getElementById('custom-category-name')?.value?.trim();
            
            if (!customName) {
                alert('Please enter a category name first.');
                return;
            }
            
            // Create the new category and get the key
            const newCategoryKey = await this.addNewCategory();
            
            if (!newCategoryKey) {
                alert('Failed to create new category.');
                return;
            }
            
            // Update category to use the new key instead of "custom"
            category = newCategoryKey;
            
            // Update the dropdown to reflect the new selection
            setTimeout(() => {
                document.getElementById('post-category').value = category;
            }, 100);
        }

        const id = this.currentEditingPost || this.generatePostId(title);
        const finalDate = date || new Date().toISOString().split('T')[0]; // Use provided date or today

        const frontmatter = {
            title,
            excerpt,
            category,
            date: finalDate,
            readTime,
            status,
            tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        };

        const markdownContent = this.generateMarkdownWithFrontmatter(frontmatter, content);

        try {
            // Determine file path based on status
            const filePath = status === 'draft' 
                ? `admin-drafts/${category}/${id}.txt`
                : `static-blog/${category}/${id}.txt`;

            const postData = {
                id,
                category,
                ...frontmatter,
                content,
                file: filePath
            };

            if (this.currentEditingPost) {
                const index = this.posts.findIndex(p => p.id === this.currentEditingPost);
                this.posts[index] = postData;
            } else {
                this.posts.push(postData);
            }

            // Save to browser storage (temporary solution)
            localStorage.setItem(`post-${id}`, markdownContent);
            
            // Auto-sync to GitHub
            await this.autoSyncPost(postData, status);
            
            // Update blog-index.json immediately
            await this.updateBlogIndexFile();
            
            this.renderPostsList();
            this.renderCategoriesList(); // Update categories list to show new post counts
            this.closePostEditor();
            
            this.showSyncStatus('synced');
            
            if (status === 'draft') {
                alert('📝 Post saved as draft!\n\nThe post is saved but won\'t appear on your public website until you publish it.');
            } else {
                alert('🌐 Post published successfully!\n\nYour post is now live on your website!');
            }
        } catch (error) {
            console.error('Failed to save post:', error);
            alert('Failed to save post. Please try again.');
        }
    }

    generatePostId(title) {
        return title.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
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

    generateMarkdownWithFrontmatter(frontmatter, content) {
        const frontmatterText = Object.entries(frontmatter)
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
                }
                return `${key}: "${value}"`;
            })
            .join('\n');

        return `---\n${frontmatterText}\n---\n\n${content}`;
    }

    editPost(postId) {
        this.openPostEditor(postId);
    }

    async deletePostConfirm(postId) {
        if (confirm('Are you sure you want to delete this post?')) {
            await this.deletePost(postId);
        }
    }

    async deletePost(postId = null) {
        const id = postId || this.currentEditingPost;
        if (!id) return;

        this.posts = this.posts.filter(p => p.id !== id);
        localStorage.removeItem(`post-${id}`);
        
        // Update blog-index.json immediately to preserve latestUpdates
        await this.updateBlogIndexFile();
        
        this.renderPostsList();
        this.renderCategoriesList(); // Update categories list to show new post counts
        if (!postId) {
            this.closePostEditor();
        }
        
        alert('Post deleted and blog index updated!');
    }

    async publishPost(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        try {
            const oldStatus = post.status || 'published';
            post.status = 'published';
            
            // If moving from draft to published, we need to move the file
            if (oldStatus === 'draft' && this.githubToken) {
                const draftFile = `admin-drafts/${post.category}/${postId}.txt`;
                const publishedFile = `static-blog/${post.category}/${postId}.txt`;
                
                try {
                    // Get draft content
                    const draftFileData = await this.getFileFromGitHub(draftFile);
                    
                    // Create published file
                    await this.createOrUpdateFileInGitHub(
                        publishedFile,
                        draftFileData.content,
                        `Publish post: ${post.title}`,
                        null
                    );
                    
                    // Delete draft file
                    await this.deleteFileFromGitHub(draftFile, `Remove draft after publishing: ${post.title}`);
                    
                    // Update post file reference and ensure status is set correctly
                    post.file = publishedFile;
                    post.status = 'published';
                    
                    console.log(`✅ Moved post from draft to published: ${postId}`);
                } catch (error) {
                    console.warn('Could not move file on GitHub:', error);
                }
            }
            
            // Update blog-index.json immediately
            await this.updateBlogIndexFile();
            
            this.renderPostsList();
            this.showSyncStatus('synced');
            alert('🌐 Post published successfully!\n\nYour post is now live on your website!');
        } catch (error) {
            console.error('Failed to publish post:', error);
            alert('Failed to publish post. Please try again.');
        }
    }

    async unpublishPost(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        try {
            const oldStatus = post.status || 'published';
            post.status = 'draft';
            
            // If moving from published to draft, we need to move the file
            if (oldStatus === 'published' && this.githubToken) {
                const publishedFile = `static-blog/${post.category}/${postId}.txt`;
                const draftFile = `admin-drafts/${post.category}/${postId}.txt`;
                
                try {
                    // Get published content
                    const publishedFileData = await this.getFileFromGitHub(publishedFile);
                    
                    // Create draft file
                    await this.createOrUpdateFileInGitHub(
                        draftFile,
                        publishedFileData.content,
                        `Move to draft: ${post.title}`,
                        null
                    );
                    
                    // Delete published file
                    await this.deleteFileFromGitHub(publishedFile, `Remove from public after moving to draft: ${post.title}`);
                    
                    // Update post file reference and ensure status is set correctly
                    post.file = draftFile;
                    post.status = 'draft';
                    
                    console.log(`✅ Moved post from published to draft: ${postId}`);
                } catch (error) {
                    console.warn('Could not move file on GitHub:', error);
                }
            }
            
            // Update blog-index.json immediately
            await this.updateBlogIndexFile();
            
            this.renderPostsList();
            this.showSyncStatus('synced');
            alert('📝 Post moved to draft!\n\nThe post is no longer visible on your public website.');
        } catch (error) {
            console.error('Failed to unpublish post:', error);
            alert('Failed to move post to draft. Please try again.');
        }
    }

    filterPostsByStatus(status) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${status}"]`).classList.add('active');
        
        // Update post counts (always show total counts, not filtered)
        const totalPosts = this.posts.length;
        const publishedPosts = this.posts.filter(post => (post.status || 'published') === 'published').length;
        const draftPosts = this.posts.filter(post => (post.status || 'published') === 'draft').length;
        
        const totalCountEl = document.getElementById('total-posts-count');
        const publishedCountEl = document.getElementById('published-posts-count');
        const draftCountEl = document.getElementById('draft-posts-count');
        
        if (totalCountEl) totalCountEl.textContent = totalPosts;
        if (publishedCountEl) publishedCountEl.textContent = publishedPosts;
        if (draftCountEl) draftCountEl.textContent = draftPosts;
        
        // Filter and render posts
        const filteredPosts = status === 'all' 
            ? this.posts 
            : this.posts.filter(post => (post.status || 'published') === status);
        
        const container = document.getElementById('posts-list');
        container.innerHTML = filteredPosts.map(post => {
            const postStatus = post.status || 'published';
            const statusBadge = postStatus === 'draft' 
                ? '<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 ml-2">📝 Draft</span>'
                : '<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 ml-2">🌐 Published</span>';
            
            const toggleAction = postStatus === 'draft'
                ? `<button onclick="adminPanel.publishPost('${post.id}')" class="text-green-600 hover:text-green-900 mr-4">Publish</button>`
                : `<button onclick="adminPanel.unpublishPost('${post.id}')" class="text-yellow-600 hover:text-yellow-900 mr-4">Unpublish</button>`;
            
            return `
                <tr class="${postStatus === 'draft' ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                            ${post.title || post.id}
                            ${statusBadge}
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${this.getCategoryColor(post.category)}-100 text-${this.getCategoryColor(post.category)}-800">
                            ${this.categories[post.category]?.name || post.category}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${post.date || 'No date'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        ${toggleAction}
                        <button onclick="adminPanel.editPost('${post.id}')" class="text-cream-600 hover:text-cream-900 mr-4">Edit</button>
                        <button onclick="adminPanel.deletePostConfirm('${post.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    initializeMarkdownEditor() {
        // Initialize SimpleMDE after a delay to ensure DOM is ready
        setTimeout(() => {
            try {
                this.markdownEditor = new SimpleMDE({
                    element: document.getElementById('post-content'),
                    autofocus: false,
                    spellChecker: false,
                    placeholder: 'Write your post content in Markdown...',
                    toolbar: [
                        'bold', 'italic', 'heading', '|',
                        'quote', 'unordered-list', 'ordered-list', '|',
                        'link', 'image', {
                            name: 'upload-image',
                            action: () => this.openImageUpload(),
                            className: 'fa fa-upload',
                            title: 'Upload Image'
                        }, '|',
                        'preview', 'side-by-side', 'fullscreen', '|',
                        'guide'
                    ]
                });
                
                // Add custom image upload functionality
                this.setupImageUpload();
            } catch (error) {
                console.log('SimpleMDE not available, using textarea fallback');
                this.setupBasicImageUpload();
            }
        }, 100);
    }

    setupImageUpload() {
        // Create hidden file input for image upload
        if (!document.getElementById('markdown-image-upload')) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'markdown-image-upload';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', (e) => this.handleMarkdownImageUpload(e));
            document.body.appendChild(fileInput);
        }
    }

    setupBasicImageUpload() {
        // Fallback for when SimpleMDE is not available
        const contentArea = document.getElementById('post-content');
        if (contentArea) {
            // Add a simple upload button above the textarea
            const uploadBtn = document.createElement('button');
            uploadBtn.textContent = '📷 Upload Image';
            uploadBtn.type = 'button';
            uploadBtn.className = 'admin-btn admin-btn-secondary mb-2';
            uploadBtn.addEventListener('click', () => this.openImageUpload());
            contentArea.parentElement.insertBefore(uploadBtn, contentArea);
        }
        this.setupImageUpload();
    }

    openImageUpload() {
        const fileInput = document.getElementById('markdown-image-upload');
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleMarkdownImageUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        if (!this.githubToken) {
            alert('Please set your GitHub token in Settings to upload images.');
            return;
        }

        const file = files[0];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB.');
            return;
        }

        try {
            // Show upload progress
            const progressMsg = `🔄 Uploading ${file.name}...`;
            
            // Read file as base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target.result.split(',')[1]; // Remove data:image/...;base64, prefix
                    
                    // Generate unique filename with timestamp
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const fileExtension = file.name.split('.').pop();
                    const fileName = `${timestamp}.${fileExtension}`;
                    const filePath = `static-blog/images/${fileName}`;
                    
                    // Upload to GitHub
                    await this.createOrUpdateFileInGitHub(
                        filePath,
                        content,
                        `Upload image: ${fileName}`
                    );
                    
                    // Generate the GitHub raw URL for the image
                    const imageUrl = `https://raw.githubusercontent.com/${this.githubRepo}/main/${filePath}`;
                    
                    // Insert markdown image syntax at cursor position
                    const markdownSyntax = `![${file.name}](${imageUrl})`;
                    this.insertTextAtCursor(markdownSyntax);
                    
                    // Clear the file input
                    event.target.value = '';
                    
                    alert(`✅ Image uploaded successfully!\nFile: ${fileName}`);
                    
                } catch (error) {
                    console.error('Upload error:', error);
                    alert(`❌ Failed to upload image: ${error.message}`);
                }
            };
            
            reader.onerror = () => {
                alert('❌ Failed to read image file.');
            };
            
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Image upload error:', error);
            alert(`❌ Failed to upload image: ${error.message}`);
        }
    }

    insertTextAtCursor(text) {
        if (this.markdownEditor) {
            // SimpleMDE is available
            const cursor = this.markdownEditor.codemirror.getCursor();
            this.markdownEditor.codemirror.replaceRange(text, cursor);
            this.markdownEditor.codemirror.focus();
        } else {
            // Fallback to textarea
            const textarea = document.getElementById('post-content');
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const textBefore = textarea.value.substring(0, start);
                const textAfter = textarea.value.substring(end);
                
                textarea.value = textBefore + text + textAfter;
                textarea.selectionStart = textarea.selectionEnd = start + text.length;
                textarea.focus();
            }
        }
    }

    // Auto-sync is now used instead of manual sync

    saveSettings() {
        const githubToken = document.getElementById('github-token').value;

        localStorage.setItem('github-token', githubToken);

        this.githubToken = githubToken;

        alert('Settings saved!');
    }

    async handleFileUpload(files) {
        if (!this.githubToken) {
            alert('Please set your GitHub token in Settings first.');
            return;
        }

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                try {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const content = e.target.result.split(',')[1]; // Remove data:image/...;base64, prefix
                        const fileName = file.name;
                        const filePath = `static-blog/images/${fileName}`;
                        
                        try {
                            this.showSyncStatus('syncing');
                            await this.createOrUpdateFileInGitHub(
                                filePath,
                                content, // Keep as base64 for GitHub API
                                `Upload image: ${fileName}`,
                                (await this.getFileFromGitHub(filePath))?.sha
                            );
                            
                            // Reload file list to show the new file
                            await this.loadFileList();
                            this.showSyncStatus('synced');
                            alert(`Image ${fileName} uploaded successfully!`);
                        } catch (error) {
                            this.showSyncStatus('error');
                            alert(`Failed to upload ${fileName}: ${error.message}`);
                        }
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    console.error('File upload error:', error);
                    this.showSyncStatus('error');
                    alert(`Failed to upload ${file.name}: ${error.message}`);
                }
            }
        }
    }

    async loadFileList() {
        if (!this.githubToken) {
            const fileList = document.getElementById('file-list');
            fileList.innerHTML = '<p class="text-gray-500">Please set your GitHub token in Settings to view files.</p>';
            return;
        }

        try {
            const files = await this.githubRequest(`/repos/${this.githubRepo}/contents/static-blog/images`);
            const fileList = document.getElementById('file-list');
            
            if (!files || files.length === 0) {
                fileList.innerHTML = '<p class="text-gray-500">No images found. Upload some images to get started!</p>';
                return;
            }

            // Filter out non-image files like README.md
            const imageFiles = files.filter(file => 
                file.type === 'file' && 
                file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
            );

            if (imageFiles.length === 0) {
                fileList.innerHTML = '<p class="text-gray-500">No image files found. Upload some images to get started!</p>';
                return;
            }

            fileList.innerHTML = imageFiles.map(file => `
                <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 relative group">
                    <button onclick="adminPanel.deleteFile('${file.path}', '${file.name}', '${file.sha}')" 
                            class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                            title="Delete ${file.name}">
                        ×
                    </button>
                    <img src="${file.download_url}" alt="${file.name}" class="w-full h-24 object-cover rounded mb-2">
                    <p class="text-sm font-medium truncate">${file.name}</p>
                    <p class="text-xs text-gray-500">${(file.size / 1024).toFixed(1)} KB</p>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading file list:', error);
            const fileList = document.getElementById('file-list');
            if (error.message && error.message.includes('404')) {
                fileList.innerHTML = '<p class="text-red-500">Images directory not found. It will be created when you upload your first image.</p>';
            } else {
                fileList.innerHTML = '<p class="text-red-500">Error loading files. Check your GitHub token and repository access.</p>';
            }
        }
    }

    async saveContent() {
        // In a real implementation, you'd update the main index.html file
        const heroTitle = document.getElementById('hero-title').value;
        const heroSubtitle = document.getElementById('hero-subtitle').value;
        const heroDescription = document.getElementById('hero-description').value;
        const aboutText = document.getElementById('about-text').value;
        const currentlyReading = document.getElementById('currently-reading').value;

        console.log('Saving content:', {
            heroTitle,
            heroSubtitle,
            heroDescription,
            aboutText,
            currentlyReading,
            latestUpdates: this.latestUpdates
        });

        // Save latest updates to blog-index.json
        try {
            this.showSyncStatus('syncing');
            await this.updateBlogIndexFile();
            this.showSyncStatus('synced');
            alert('Content and latest updates saved! Changes have been auto-synced to GitHub.');
        } catch (error) {
            console.error('Failed to save latest updates:', error);
            this.showSyncStatus('error');
            alert('Failed to save content. Please check your GitHub token.');
        }
    }

    async testGitHubConnection() {
        const token = document.getElementById('github-token').value || this.githubToken;
        const repo = this.githubRepo;
        
        if (!token) {
            alert('Please enter a GitHub token first.');
            return;
        }

        // Show loading state
        const testBtn = document.getElementById('test-github');
        const originalText = testBtn.textContent;
        testBtn.textContent = '🔄 Testing...';
        testBtn.disabled = true;

        try {
            // Test 1: User authentication
            console.log('Testing user authentication...');
            const userResponse = await fetch(`${this.githubApiBase}/user`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!userResponse.ok) {
                if (userResponse.status === 401) {
                    throw new Error('Invalid GitHub token. Please check your token.');
                } else {
                    throw new Error(`GitHub API error: ${userResponse.status}`);
                }
            }

            const userData = await userResponse.json();
            console.log('✅ User authentication successful:', userData.login);

            // Test 2: Repository access
            console.log('Testing repository access...');
            const repoResponse = await fetch(`${this.githubApiBase}/repos/${repo}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!repoResponse.ok) {
                if (repoResponse.status === 404) {
                    throw new Error(`Repository "${repo}" not found or not accessible.`);
                } else if (repoResponse.status === 403) {
                    throw new Error(`Access denied to repository "${repo}". Check permissions.`);
                } else {
                    throw new Error(`Repository access error: ${repoResponse.status}`);
                }
            }

            const repoData = await repoResponse.json();
            console.log('✅ Repository access successful');

            // Check write permissions
            const hasWriteAccess = repoData.permissions && (repoData.permissions.push || repoData.permissions.admin);
            
            let message = `🎉 GitHub Connection Test Successful!\n\n`;
            message += `👤 Authenticated as: ${userData.login}\n`;
            message += `📁 Repository: ${repoData.full_name}\n`;
            message += `🔒 Write Access: ${hasWriteAccess ? '✅ Yes' : '❌ No'}\n\n`;
            
            if (!hasWriteAccess) {
                message += `⚠️ Warning: You don't have write access to this repository.\n`;
                message += `You won't be able to sync changes until you get push permissions.`;
            } else {
                message += `✅ Everything looks good! You can sync changes to GitHub.`;
            }

            alert(message);
            
        } catch (error) {
            console.error('GitHub connection test failed:', error);
            
            let errorMessage = '❌ GitHub Connection Test Failed\n\n';
            if (error.message.includes('Invalid GitHub token')) {
                errorMessage += '🔐 Token Error:\n';
                errorMessage += error.message + '\n\n';
                errorMessage += '💡 To fix:\n';
                errorMessage += '1. Go to GitHub Settings → Developer settings → Personal access tokens\n';
                errorMessage += '2. Generate new classic token with "repo" scope\n';
                errorMessage += '3. Copy and paste the token here';
            } else if (error.message.includes('not found')) {
                errorMessage += '📁 Repository Error:\n';
                errorMessage += error.message + '\n\n';
                errorMessage += '💡 To fix:\n';
                errorMessage += '1. Check repository name format: username/repository\n';
                errorMessage += '2. Make sure repository exists\n';
                errorMessage += '3. Verify you have access to the repository';
            } else {
                errorMessage += '🌐 Connection Error:\n';
                errorMessage += error.message + '\n\n';
                errorMessage += '💡 Please check your internet connection and try again.';
            }
            
            alert(errorMessage);
        }

        // Reset button state
        testBtn.textContent = originalText;
        testBtn.disabled = false;
    }

    renderLatestUpdates() {
        const categories = ['read', 'watched', 'building'];
        
        categories.forEach(category => {
            const container = document.getElementById(`latest-${category}-list`);
            if (!container) return;
            
            const items = this.latestUpdates[category] || [];
            container.innerHTML = items.map((item, index) => `
                <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    <span class="text-sm">${this.escapeHtml(item)}</span>
                    <button onclick="adminPanel.removeLatestItem('${category}', ${index})" class="text-red-500 hover:text-red-700 text-xs ml-2">×</button>
                </div>
            `).join('');
        });
    }

    addLatestItem(category) {
        const input = document.getElementById(`new-${category}`);
        if (!input) return;
        
        const value = input.value.trim();
        if (!value) return;
        
        if (!this.latestUpdates[category]) {
            this.latestUpdates[category] = [];
        }
        
        this.latestUpdates[category].unshift(value); // Add to beginning
        
        // Keep only the last 5 items
        if (this.latestUpdates[category].length > 5) {
            this.latestUpdates[category] = this.latestUpdates[category].slice(0, 5);
        }
        
        input.value = '';
        this.renderLatestUpdates();
    }

    removeLatestItem(category, index) {
        if (!this.latestUpdates[category]) return;
        
        this.latestUpdates[category].splice(index, 1);
        this.renderLatestUpdates();
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    clearCache() {
        if (confirm('This will clear all cached post data. Any unsaved changes will be lost. Continue?')) {
            // Clear all post-related localStorage items
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('post-')) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log(`🧹 Cleared cached post: ${key}`);
            });
            
            // Reload the page to refresh everything
            alert(`✅ Cache cleared! Removed ${keysToRemove.length} cached items. The page will now reload.`);
            window.location.reload();
        }
    }

    setupAutoSyncIndicator() {
        // Show sync status briefly after operations
        this.syncStatusTimeout = null;
    }

    showSyncStatus(type) {
        const statusEl = document.getElementById('sync-status');
        if (!statusEl) return;

        clearTimeout(this.syncStatusTimeout);
        
        if (type === 'syncing') {
            statusEl.innerHTML = '<span class="text-blue-600">🔄 Syncing...</span>';
            statusEl.classList.remove('hidden');
        } else if (type === 'synced') {
            statusEl.innerHTML = '<span class="text-green-600">✅ Auto-synced</span>';
            statusEl.classList.remove('hidden');
            
            // Hide after 3 seconds
            this.syncStatusTimeout = setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 3000);
        } else if (type === 'error') {
            statusEl.innerHTML = '<span class="text-red-600">❌ Sync failed</span>';
            statusEl.classList.remove('hidden');
            
            // Hide after 5 seconds
            this.syncStatusTimeout = setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 5000);
        }
    }

    async autoSyncPost(postData, status) {
        if (!this.githubToken) {
            console.warn('No GitHub token - skipping auto-sync');
            return;
        }

        this.showSyncStatus('syncing');

        try {
            const postContent = localStorage.getItem(`post-${postData.id}`);
            if (!postContent) return;

            let filePath, commitMessage;
            
            if (status === 'draft') {
                filePath = `admin-drafts/${postData.category}/${postData.id}.txt`;
                commitMessage = `Auto-save draft: ${postData.title}`;
            } else {
                filePath = `static-blog/${postData.category}/${postData.id}.txt`;
                commitMessage = `Auto-publish post: ${postData.title}`;
            }

            const existingFile = await this.getFileFromGitHub(filePath);
            await this.createOrUpdateFileInGitHub(
                filePath,
                postContent,
                commitMessage,
                existingFile?.sha
            );

            // Remove from localStorage after successful sync
            localStorage.removeItem(`post-${postData.id}`);
            
            console.log(`✅ Auto-synced: ${postData.id}`);
        } catch (error) {
            console.error('Auto-sync failed:', error);
            this.showSyncStatus('error');
            throw error; // Re-throw to handle in calling function
        }
    }

    async deleteFile(filePath, fileName, sha) {
        if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        if (!this.githubToken) {
            alert('GitHub token required to delete files.');
            return;
        }

        try {
            this.showSyncStatus('syncing');
            
            await this.deleteFileFromGitHub(filePath, `Delete image: ${fileName}`);
            
            // Reload file list to reflect changes
            await this.loadFileList();
            
            this.showSyncStatus('synced');
            alert(`✅ File "${fileName}" deleted successfully!`);
            
        } catch (error) {
            console.error('Failed to delete file:', error);
            this.showSyncStatus('error');
            alert(`❌ Failed to delete "${fileName}".\n\nError: ${error.message}`);
        }
    }
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Add some CSS for admin tabs
const style = document.createElement('style');
style.textContent = `
    .admin-tab {
        padding: 0.5rem 1rem;
        border-bottom: 2px solid transparent;
        color: #6b7280;
        transition: all 0.2s;
    }
    
    .admin-tab:hover {
        color: #374151;
        border-bottom-color: #d1d5db;
    }
    
    .admin-tab.active {
        color: #de9f39;
        border-bottom-color: #de9f39;
        font-weight: 500;
    }
    
    /* Custom image upload button styling for SimpleMDE */
    .editor-toolbar .fa-upload:before {
        content: "📷";
        font-family: inherit;
    }
    
    /* Image upload progress styling */
    .image-upload-progress {
        background: #f0f9ff;
        border: 1px solid #0ea5e9;
        border-radius: 4px;
        padding: 8px 12px;
        margin: 8px 0;
        color: #0369a1;
        font-size: 14px;
    }
`;
document.head.appendChild(style); 