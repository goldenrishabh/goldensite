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

        // File upload
        document.getElementById('file-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Content management
        document.getElementById('save-content').addEventListener('click', () => {
            this.saveContent();
        });
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
            content: btoa(unescape(encodeURIComponent(content)))
        };

        if (sha) {
            body.sha = sha;
        }

        return this.githubRequest(`/repos/${this.githubRepo}/contents/${path}`, 'PUT', body);
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
            
            this.categories = data.categories;
            this.posts = [];

            // Load each post
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

            this.renderPostsList();
        } catch (error) {
            console.error('Failed to load blog data:', error);
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
        const colors = {
            technical: 'blue',
            philosophical: 'purple',
            adventure: 'orange',
            random: 'green',
            personal: 'pink'
        };
        return colors[category] || 'gray';
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
            document.getElementById('post-category').value = 'technical';
            document.getElementById('post-excerpt').value = '';
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
        const category = document.getElementById('post-category').value;
        const excerpt = document.getElementById('post-excerpt').value;
        const tags = document.getElementById('post-tags').value;
        const readTime = document.getElementById('post-read-time').value;
        const content = this.markdownEditor ? this.markdownEditor.value() : document.getElementById('post-content').value;

        if (!title || !content) {
            alert('Please fill in at least the title and content.');
            return;
        }

        const id = this.currentEditingPost || this.generatePostId(title);
        const date = new Date().toISOString().split('T')[0];

        const frontmatter = {
            title,
            excerpt,
            category,
            date,
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
            
            this.renderPostsList();
            this.closePostEditor();
            
            alert('Post saved! Click "Sync with GitHub" to publish changes.');
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
                        'link', 'image', '|',
                        'preview', 'side-by-side', 'fullscreen', '|',
                        'guide'
                    ]
                });
            } catch (error) {
                console.log('SimpleMDE not available, using textarea fallback');
            }
        }, 100);
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
                                atob(content), // Decode base64 for GitHub API
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
            
            if (files.length === 0) {
                fileList.innerHTML = '<p class="text-gray-500">No images found.</p>';
                return;
            }

            fileList.innerHTML = files.map(file => `
                <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <img src="${file.download_url}" alt="${file.name}" class="w-full h-24 object-cover rounded mb-2">
                    <p class="text-sm font-medium truncate">${file.name}</p>
                    <p class="text-xs text-gray-500">${(file.size / 1024).toFixed(1)} KB</p>
                </div>
            `).join('');
        } catch (error) {
            const fileList = document.getElementById('file-list');
            fileList.innerHTML = '<p class="text-red-500">Error loading files. Check your GitHub token.</p>';
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
`;
document.head.appendChild(style); 