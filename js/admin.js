class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.posts = [];
        this.categories = {};
        this.currentEditingPost = null;
        this.markdownEditor = null;
        // Remove password hash - we'll use GitHub token authentication instead
        this.githubToken = localStorage.getItem('github-token') || '';
        this.githubRepo = localStorage.getItem('github-repo') || 'goldenrishabh/goldensite';
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

        document.getElementById('save-post').addEventListener('click', () => {
            this.savePost();
        });

        document.getElementById('delete-post').addEventListener('click', () => {
            this.deletePost();
        });

        // GitHub sync
        document.getElementById('sync-github').addEventListener('click', () => {
            this.syncWithGitHub();
        });

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

        // Category change handler - will be attached to select element after it's created
        this.setupCategoryChangeListener();
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
        const repoInput = document.getElementById('admin-repo').value || this.githubRepo;
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
            const response = await fetch(`${this.githubApiBase}/repos/${repoInput}`, {
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
                    this.githubRepo = repoInput;
                    
                    // Save credentials
                    localStorage.setItem('github-token', token);
                    localStorage.setItem('github-repo', repoInput);
                    
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
        document.getElementById('admin-repo').value = '';
        
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
        const githubRepo = localStorage.getItem('github-repo');

        if (githubToken) {
            document.getElementById('github-token').value = githubToken;
            this.githubToken = githubToken;
        }

        if (githubRepo) {
            document.getElementById('github-repo').value = githubRepo;
            this.githubRepo = githubRepo;
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
            this.posts = [];

            // Load each post
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

            // Auto-detect missing categories from posts
            this.autoDetectMissingCategories();

            this.renderPostsList();
        } catch (error) {
            console.error('Failed to load blog data:', error);
            // Initialize with empty data if blog-index.json doesn't exist
            this.categories = {};
            this.posts = [];
            this.renderPostsList();
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
        
        container.innerHTML = this.posts.map(post => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${post.title || post.id}</div>
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
                    <button onclick="adminPanel.editPost('${post.id}')" class="text-cream-600 hover:text-cream-900 mr-4">Edit</button>
                    <button onclick="adminPanel.deletePostConfirm('${post.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            </tr>
        `).join('');
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
            // Generate updated blog-index.json
            const blogIndex = {
                categories: this.categories,
                posts: this.posts.map(post => ({
                    id: post.id,
                    category: post.category,
                    file: post.file
                }))
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

    async savePost() {
        const title = document.getElementById('post-title').value;
        let category = document.getElementById('post-category').value;
        const excerpt = document.getElementById('post-excerpt').value;
        const date = document.getElementById('post-date').value;
        const tags = document.getElementById('post-tags').value;
        const readTime = document.getElementById('post-read-time').value;
        const content = this.markdownEditor ? this.markdownEditor.value() : document.getElementById('post-content').value;

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
            tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        };

        const markdownContent = this.generateMarkdownWithFrontmatter(frontmatter, content);

        try {
            // Save to localStorage for now (in real implementation, you'd save to filesystem)
            const postData = {
                id,
                category,
                ...frontmatter,
                content,
                file: `static-blog/${category}/${id}.txt`
            };

            if (this.currentEditingPost) {
                const index = this.posts.findIndex(p => p.id === this.currentEditingPost);
                this.posts[index] = postData;
            } else {
                this.posts.push(postData);
            }

            // Save to browser storage (temporary solution)
            localStorage.setItem(`post-${id}`, markdownContent);
            
            // Update blog-index.json immediately
            await this.updateBlogIndexFile();
            
            this.renderPostsList();
            this.renderCategoriesList(); // Update categories list to show new post counts
            this.closePostEditor();
            
            alert('Post saved and blog index updated!');
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

    deletePostConfirm(postId) {
        if (confirm('Are you sure you want to delete this post?')) {
            this.deletePost(postId);
        }
    }

    deletePost(postId = null) {
        const id = postId || this.currentEditingPost;
        if (!id) return;

        this.posts = this.posts.filter(p => p.id !== id);
        localStorage.removeItem(`post-${id}`);
        
        this.renderPostsList();
        if (!postId) {
            this.closePostEditor();
        }
        
        alert('Post deleted! Click "Sync with GitHub" to publish changes.');
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

    async syncWithGitHub() {
        if (!this.githubToken) {
            alert('Please set your GitHub token in Settings first.');
            return;
        }

        try {
            // Update sync button to show loading
            const syncBtn = document.getElementById('sync-github');
            const originalText = syncBtn.textContent;
            syncBtn.textContent = '🔄 Syncing...';
            syncBtn.disabled = true;

            // First, test authentication by checking repository access
            console.log('Testing GitHub authentication...');
            try {
                await this.githubRequest(`/repos/${this.githubRepo}`);
                console.log('✅ Authentication successful');
            } catch (authError) {
                if (authError.message.includes('401')) {
                    throw new Error('Invalid GitHub token. Please check your token in Settings and make sure it has "repo" permissions.');
                } else if (authError.message.includes('404')) {
                    throw new Error(`Repository "${this.githubRepo}" not found. Please check the repository name in Settings.`);
                } else {
                    throw new Error(`Authentication failed: ${authError.message}`);
                }
            }

            // Generate new blog-index.json
            const blogIndex = {
                categories: this.categories,
                posts: this.posts.map(post => ({
                    id: post.id,
                    category: post.category,
                    file: post.file
                }))
            };

            // Update blog-index.json on GitHub
            console.log('Updating blog-index.json...');
            try {
                const existingFile = await this.getFileFromGitHub('blog-index.json');
                await this.createOrUpdateFileInGitHub(
                    'blog-index.json',
                    JSON.stringify(blogIndex, null, 2),
                    'Update blog index via admin panel',
                    existingFile?.sha
                );
                console.log('✅ Blog index updated');
            } catch (error) {
                console.error('Failed to update blog-index.json:', error);
                throw new Error(`Failed to update blog index: ${error.message}`);
            }

            // Create category directories if needed
            console.log('Checking category directories...');
            for (const [categoryKey, categoryInfo] of Object.entries(this.categories)) {
                try {
                    const categoryPath = `static-blog/${categoryKey}`;
                    // Try to get the directory - if it fails, we'll create a README to establish it
                    try {
                        await this.githubRequest(`/repos/${this.githubRepo}/contents/${categoryPath}`);
                        console.log(`✅ Category directory exists: ${categoryKey}`);
                    } catch (error) {
                        if (error.message.includes('404')) {
                            // Directory doesn't exist, create it with a README
                            console.log(`Creating directory for category: ${categoryKey}`);
                            const readmeContent = `# ${categoryInfo.name}\n\n${categoryInfo.description}\n\nThis directory contains ${categoryInfo.name} blog posts.`;
                            await this.createOrUpdateFileInGitHub(
                                `${categoryPath}/README.md`,
                                readmeContent,
                                `Create ${categoryInfo.name} category directory`
                            );
                            console.log(`✅ Created directory: ${categoryKey}`);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to create directory for category ${categoryKey}:`, error);
                }
            }

            // Sync all posts that have been modified
            let syncedPosts = 0;
            let failedPosts = 0;
            
            for (const post of this.posts) {
                const postContent = localStorage.getItem(`post-${post.id}`);
                if (postContent) {
                    try {
                        console.log(`Syncing post: ${post.id}`);
                        const existingFile = await this.getFileFromGitHub(post.file);
                        await this.createOrUpdateFileInGitHub(
                            post.file,
                            postContent,
                            `Update post: ${post.title}`,
                            existingFile?.sha
                        );
                        // Remove from localStorage after successful sync
                        localStorage.removeItem(`post-${post.id}`);
                        syncedPosts++;
                        console.log(`✅ Synced: ${post.id}`);
                    } catch (error) {
                        console.error(`Failed to sync post ${post.id}:`, error);
                        failedPosts++;
                    }
                }
            }

            // Show success message with details
            let message = 'Successfully synced with GitHub!';
            if (syncedPosts > 0) {
                message += `\n\n📝 ${syncedPosts} post(s) synced`;
            }
            if (failedPosts > 0) {
                message += `\n⚠️ ${failedPosts} post(s) failed to sync`;
            }
            message += '\n\n🚀 Changes are now live on your website!';
            
            alert(message);
            
            syncBtn.textContent = originalText;
            syncBtn.disabled = false;
        } catch (error) {
            console.error('Failed to sync with GitHub:', error);
            
            // Provide helpful error messages based on the error type
            let errorMessage = 'Failed to sync with GitHub:\n\n';
            
            if (error.message.includes('Invalid GitHub token')) {
                errorMessage += '🔐 Authentication Error:\n';
                errorMessage += error.message + '\n\n';
                errorMessage += '💡 To fix this:\n';
                errorMessage += '1. Go to GitHub Settings → Developer settings → Personal access tokens\n';
                errorMessage += '2. Generate a new classic token with "repo" scope\n';
                errorMessage += '3. Update your token in the Settings tab';
            } else if (error.message.includes('not found')) {
                errorMessage += '📁 Repository Error:\n';
                errorMessage += error.message + '\n\n';
                errorMessage += '💡 To fix this:\n';
                errorMessage += '1. Check the repository name in Settings\n';
                errorMessage += '2. Make sure the repository exists\n';
                errorMessage += '3. Ensure your token has access to this repository';
            } else if (error.message.includes('403')) {
                errorMessage += '🚫 Permission Error:\n';
                errorMessage += 'You don\'t have write access to this repository.\n\n';
                errorMessage += '💡 To fix this:\n';
                errorMessage += '1. Make sure you own the repository\n';
                errorMessage += '2. Or ask the owner to add you as a collaborator\n';
                errorMessage += '3. Regenerate your token with "repo" scope';
            } else {
                errorMessage += '❌ Sync Error:\n';
                errorMessage += error.message + '\n\n';
                errorMessage += '💡 Please check:\n';
                errorMessage += '1. Your internet connection\n';
                errorMessage += '2. GitHub token permissions\n';
                errorMessage += '3. Repository settings';
            }
            
            alert(errorMessage);
            
            const syncBtn = document.getElementById('sync-github');
            syncBtn.textContent = '🔄 Sync with GitHub';
            syncBtn.disabled = false;
        }
    }

    saveSettings() {
        const githubToken = document.getElementById('github-token').value;
        const githubRepo = document.getElementById('github-repo').value;

        localStorage.setItem('github-token', githubToken);
        localStorage.setItem('github-repo', githubRepo);

        this.githubToken = githubToken;
        this.githubRepo = githubRepo;

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
                            await this.createOrUpdateFileInGitHub(
                                filePath,
                                content, // Keep as base64 for GitHub API
                                `Upload image: ${fileName}`,
                                (await this.getFileFromGitHub(filePath))?.sha
                            );
                            alert(`Image ${fileName} uploaded successfully!`);
                        } catch (error) {
                            alert(`Failed to upload ${fileName}: ${error.message}`);
                        }
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    console.error('File upload error:', error);
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
                <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
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

    saveContent() {
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
            currentlyReading
        });

        alert('Content saved! Click "Sync with GitHub" to publish changes.');
    }

    async testGitHubConnection() {
        const token = document.getElementById('github-token').value || this.githubToken;
        const repo = document.getElementById('github-repo').value || this.githubRepo;
        
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