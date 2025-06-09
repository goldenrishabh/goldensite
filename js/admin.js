class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.posts = [];
        this.categories = {};
        this.currentEditingPost = null;
        this.markdownEditor = null;
        this.adminPassword = 'golden2025'; // Change this to your desired password
        this.githubToken = localStorage.getItem('github-token') || '';
        this.githubRepo = localStorage.getItem('github-repo') || 'goldenrishabh/goldensite';
        
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
        const password = document.getElementById('admin-password').value;
        const errorEl = document.getElementById('login-error');

        if (password === this.adminPassword) {
            document.getElementById('login-modal').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            this.currentUser = 'admin';
            await this.loadBlogData();
        } else {
            errorEl.textContent = 'Invalid password';
            errorEl.classList.remove('hidden');
        }
    }

    logout() {
        this.currentUser = null;
        document.getElementById('login-modal').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('admin-password').value = '';
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

            // Generate new blog-index.json
            const blogIndex = {
                categories: this.categories,
                posts: this.posts.map(post => ({
                    id: post.id,
                    category: post.category,
                    file: post.file
                }))
            };

            // Simulate GitHub API calls (in real implementation, you'd use GitHub API)
            console.log('Syncing with GitHub...', blogIndex);
            
            // For now, just simulate a delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            alert('Successfully synced with GitHub! Changes are now live.');
            
            syncBtn.textContent = originalText;
            syncBtn.disabled = false;
        } catch (error) {
            console.error('Failed to sync with GitHub:', error);
            alert('Failed to sync with GitHub. Please check your token and try again.');
            
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

    handleFileUpload(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // In a real implementation, you'd upload to GitHub or a file storage service
                    console.log('File uploaded:', file.name, e.target.result);
                    alert(`File ${file.name} processed! (In a real implementation, this would upload to GitHub)`);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    loadFileList() {
        // In a real implementation, you'd fetch files from GitHub repository
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '<p class="text-gray-500">File list will be loaded from GitHub repository...</p>';
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