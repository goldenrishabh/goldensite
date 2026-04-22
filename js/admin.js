// ============================================================
// Configuration
// ============================================================
const ADMIN_CONFIG = {
    repoOwner: 'goldenrishabh',
    repoName: 'goldensite',
    branch: 'main',
    allowedUsers: ['goldenrishabh'],
    imageMaxWidth: 1200,
    imageQuality: 0.85,
};

// ============================================================
// Utility Functions
// ============================================================

function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(base64) {
    return decodeURIComponent(escape(atob(base64)));
}

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
}

function calculateReadingTime(content) {
    const plain = content
        .replace(/^---[\s\S]*?\n---\n/m, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\n/g, ' ')
        .trim();
    const words = plain.split(/\s+/).filter(Boolean);
    const minutes = Math.ceil(words.length / 225);
    if (minutes < 1) return 'Quick read';
    if (minutes === 1) return '1 min read';
    return `${minutes} min read`;
}

function parseFrontmatter(markdown) {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, content: markdown };

    const frontmatter = {};
    match[1].split('\n').forEach(line => {
        const i = line.indexOf(':');
        if (i <= 0) return;
        const key = line.substring(0, i).trim();
        let value = line.substring(i + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(s => s.trim().replace(/["']/g, ''));
        }
        frontmatter[key] = value;
    });
    return { frontmatter, content: match[2] };
}

function stringifyFrontmatter(fm) {
    const lines = Object.entries(fm).map(([key, value]) => {
        if (Array.isArray(value)) {
            return `${key}: [${value.map(v => `'${String(v).replace(/'/g, "\\'")}'`).join(', ')}]`;
        }
        if (value === undefined || value === null) return `${key}:`;
        const str = String(value);
        const needsQuotes = /[#:>\[\]{},]|^\s|\s$/.test(str) || str.includes(' ');
        return `${key}: ${needsQuotes ? '"' + str.replace(/"/g, '\\"') + '"' : str}`;
    });
    return `---\n${lines.join('\n')}\n---\n`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// GitHub API Client
// ============================================================

class GitHubAPI {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'https://api.github.com';
    }

    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message || `GitHub API error ${response.status}`);
        }
        if (response.status === 204) return null;
        return response.json();
    }

    async getUser() {
        return this.request('/user');
    }

    async getContents(path) {
        const repo = `${ADMIN_CONFIG.repoOwner}/${ADMIN_CONFIG.repoName}`;
        const encoded = path.split('/').map(s => encodeURIComponent(s)).join('/');
        return this.request(`/repos/${repo}/contents/${encoded}?ref=${ADMIN_CONFIG.branch}`);
    }

    async commitFiles(files, message) {
        const repo = `${ADMIN_CONFIG.repoOwner}/${ADMIN_CONFIG.repoName}`;

        const ref = await this.request(`/repos/${repo}/git/ref/heads/${ADMIN_CONFIG.branch}`);
        const latestSha = ref.object.sha;

        const commit = await this.request(`/repos/${repo}/git/commits/${latestSha}`);
        const baseTreeSha = commit.tree.sha;

        const treeItems = [];
        for (const file of files) {
            if (file.delete) {
                treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
            } else {
                const blob = await this.request(`/repos/${repo}/git/blobs`, {
                    method: 'POST',
                    body: JSON.stringify({
                        content: file.content,
                        encoding: file.encoding || 'utf-8',
                    }),
                });
                treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
            }
        }

        const newTree = await this.request(`/repos/${repo}/git/trees`, {
            method: 'POST',
            body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
        });

        const newCommit = await this.request(`/repos/${repo}/git/commits`, {
            method: 'POST',
            body: JSON.stringify({ message, tree: newTree.sha, parents: [latestSha] }),
        });

        await this.request(`/repos/${repo}/git/refs/heads/${ADMIN_CONFIG.branch}`, {
            method: 'PATCH',
            body: JSON.stringify({ sha: newCommit.sha }),
        });

        return newCommit;
    }
}

// ============================================================
// Admin Application
// ============================================================

class AdminApp {
    constructor() {
        this.github = null;
        this.user = null;
        this.posts = [];
        this.blogIndex = null;
        this.editingPost = null;
        this.editor = null;
        this.pendingImageFile = null;
        this.pendingImageDataUrl = null;
        this.pendingAnimationFile = null;
        this.deleteTargetId = null;
        this.saving = false;

        this.init();
    }

    async init() {
        this.setupTheme();
        this.bindEvents();

        const token = localStorage.getItem('admin_github_token');
        if (token) {
            try {
                await this.authenticateWithToken(token);
            } catch (_) {
                this.showView('login');
            }
        }
    }

    // ---- Auth ----

    async authenticateWithToken(token) {
        this.showLoading('Authenticating...');
        try {
            this.github = new GitHubAPI(token);
            this.user = await this.github.getUser();

            if (!ADMIN_CONFIG.allowedUsers.includes(this.user.login)) {
                throw new Error(`User "${this.user.login}" is not authorized`);
            }

            localStorage.setItem('admin_github_token', token);
            this.hideLoading();
            await this.showDashboard();
        } catch (err) {
            localStorage.removeItem('admin_github_token');
            this.github = null;
            this.user = null;
            this.hideLoading();
            throw err;
        }
    }

    logout() {
        localStorage.removeItem('admin_github_token');
        this.github = null;
        this.user = null;
        this.posts = [];
        this.blogIndex = null;
        this.destroyEditor();
        this.showView('login');
    }

    // ---- Views ----

    showView(name) {
        ['login', 'dashboard', 'editor'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.toggle('hidden', v !== name);
        });
    }

    // ---- Dashboard ----

    async showDashboard() {
        this.showView('dashboard');
        this.updateUserInfo();
        await this.loadPosts();
        this.renderPosts();
        this.updateStats();
        this.populateCategoryFilter();
    }

    updateUserInfo() {
        const avatar = document.getElementById('user-avatar');
        const name = document.getElementById('user-name');
        if (avatar) avatar.src = this.user.avatar_url;
        if (name) name.textContent = this.user.login;
    }

    async loadPosts() {
        this.showLoading('Loading posts...');
        try {
            const contents = await this.github.getContents('blog-index.json');
            const raw = base64ToUtf8(contents.content.replace(/\s/g, ''));
            this.blogIndex = JSON.parse(raw);

            this.posts = [];
            for (const entry of this.blogIndex.posts) {
                try {
                    const file = await this.github.getContents(entry.file);
                    const md = base64ToUtf8(file.content.replace(/\s/g, ''));
                    const parsed = parseFrontmatter(md);
                    this.posts.push({
                        id: entry.id,
                        category: entry.category,
                        file: entry.file,
                        sha: file.sha,
                        ...parsed.frontmatter,
                        content: parsed.content,
                    });
                } catch (err) {
                    console.warn(`Could not load ${entry.file}:`, err.message);
                    this.posts.push({
                        id: entry.id,
                        category: entry.category,
                        file: entry.file,
                        title: entry.id,
                        date: '',
                        content: '',
                        _loadError: true,
                    });
                }
            }
            this.hideLoading();
        } catch (err) {
            this.hideLoading();
            if (err.message && (err.message.includes('Not Found') || err.message.includes('404'))) {
                this.blogIndex = { categories: {}, posts: [] };
                this.posts = [];
            } else {
                this.showToast('Failed to load posts: ' + err.message, 'error');
            }
        }
    }

    renderPosts() {
        const tbody = document.getElementById('posts-table-body');
        const empty = document.getElementById('posts-empty');
        const search = (document.getElementById('dashboard-search').value || '').toLowerCase().trim();
        const catFilter = document.getElementById('dashboard-filter').value;

        let filtered = this.posts;
        if (catFilter && catFilter !== 'all') {
            filtered = filtered.filter(p => p.category === catFilter);
        }
        if (search) {
            filtered = filtered.filter(p =>
                (p.title || '').toLowerCase().includes(search) ||
                (p.excerpt || '').toLowerCase().includes(search) ||
                (p.category || '').toLowerCase().includes(search)
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = filtered.map(post => `
            <tr class="border-b border-cream-100 dark:border-[#242630] hover:bg-cream-50 dark:hover:bg-[#16171c] transition">
                <td class="px-6 py-4">
                    <div class="font-medium">${escapeHtml(post.title || post.id)}</div>
                    ${post.excerpt ? `<div class="text-sm text-gray-500 dark:text-[#8a857e] mt-0.5 truncate max-w-xs">${escapeHtml(post.excerpt)}</div>` : ''}
                </td>
                <td class="px-6 py-4 hidden sm:table-cell">
                    <span class="text-xs px-2.5 py-1 bg-cream-100 dark:bg-[#242630] text-cream-700 dark:text-[#a09a92] rounded-full">${escapeHtml(post.category)}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-[#8a857e] hidden md:table-cell">${formatDate(post.date)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-[#8a857e] hidden md:table-cell">${escapeHtml(post.readTime || '')}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button class="btn-edit p-2 rounded-lg hover:bg-cream-100 dark:hover:bg-[#242630] transition text-gray-500 hover:text-cream-700 dark:hover:text-[#d4b86a]" data-id="${post.id}" title="Edit">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button class="btn-delete p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition text-gray-500 hover:text-red-600" data-id="${post.id}" title="Delete">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => this.showEditor(btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDelete(btn.dataset.id));
        });
    }

    updateStats() {
        document.getElementById('stat-posts').textContent = this.posts.length;
        const categories = new Set(this.posts.map(p => p.category));
        document.getElementById('stat-categories').textContent = categories.size;
        if (this.posts.length > 0) {
            const sorted = [...this.posts].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            document.getElementById('stat-latest').textContent = sorted[0].title || sorted[0].id;
        } else {
            document.getElementById('stat-latest').textContent = '--';
        }
    }

    populateCategoryFilter() {
        const select = document.getElementById('dashboard-filter');
        const cats = [...new Set(this.posts.map(p => p.category))].sort();
        select.innerHTML = '<option value="all">All Categories</option>' +
            cats.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('');
    }

    // ---- Editor ----

    showEditor(postId = null) {
        this.showView('editor');

        if (postId) {
            this.editingPost = this.posts.find(p => p.id === postId) || null;
            document.getElementById('editor-status').textContent = 'Editing';
            if (this.editingPost) this.populateEditor(this.editingPost);
        } else {
            this.editingPost = null;
            document.getElementById('editor-status').textContent = 'New Post';
            this.clearEditor();
        }

        this.initEasyMDE();
    }

    populateEditor(post) {
        document.getElementById('editor-title').value = post.title || '';
        document.getElementById('editor-date').value = post.date || '';
        document.getElementById('editor-tags').value = Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || '');
        document.getElementById('editor-excerpt').value = post.excerpt || '';

        const catSelect = document.getElementById('editor-category');
        const existing = Array.from(catSelect.options).map(o => o.value);
        if (existing.includes(post.category)) {
            catSelect.value = post.category;
        } else if (post.category) {
            const opt = document.createElement('option');
            opt.value = post.category;
            opt.textContent = post.category.charAt(0).toUpperCase() + post.category.slice(1);
            catSelect.insertBefore(opt, catSelect.querySelector('[value="__new__"]'));
            catSelect.value = post.category;
        }
        document.getElementById('editor-new-category').classList.add('hidden');
    }

    clearEditor() {
        document.getElementById('editor-title').value = '';
        document.getElementById('editor-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('editor-tags').value = '';
        document.getElementById('editor-excerpt').value = '';
        document.getElementById('editor-category').value = '';
        document.getElementById('editor-new-category').value = '';
        document.getElementById('editor-new-category').classList.add('hidden');
    }

    initEasyMDE() {
        this.destroyEditor();

        const self = this;
        this.editor = new EasyMDE({
            element: document.getElementById('editor-content'),
            spellChecker: false,
            autosave: { enabled: true, uniqueId: 'admin-blog-editor', delay: 5000 },
            placeholder: 'Write your blog post here...\n\nYou can drag & drop images directly into the editor.',
            uploadImage: true,
            imageUploadFunction: function (file, onSuccess, onError) {
                self.processAndUploadImage(file, file.name)
                    .then(url => onSuccess(url))
                    .catch(err => onError(err.message));
            },
            imageAccept: 'image/png, image/jpeg, image/gif, image/webp',
            imageMaxSize: 10 * 1024 * 1024,
            toolbar: [
                'bold', 'italic', 'heading', '|',
                'quote', 'unordered-list', 'ordered-list', '|',
                'link', 'image', 'table', 'horizontal-rule', '|',
                'preview', 'side-by-side', 'fullscreen', '|',
                'guide',
            ],
            status: ['lines', 'words'],
            minHeight: '300px',
            renderingConfig: { codeSyntaxHighlighting: true },
        });

        if (this.editingPost && this.editingPost.content) {
            this.editor.value(this.editingPost.content.trim());
        }
    }

    destroyEditor() {
        if (this.editor) {
            this.editor.toTextArea();
            this.editor = null;
        }
    }

    // ---- Save ----

    async savePost() {
        if (this.saving) return;

        const title = document.getElementById('editor-title').value.trim();
        let category = document.getElementById('editor-category').value;
        const excerpt = document.getElementById('editor-excerpt').value.trim();
        const date = document.getElementById('editor-date').value;
        const tagsStr = document.getElementById('editor-tags').value;
        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
        const content = this.editor ? this.editor.value() : '';

        if (category === '__new__') {
            category = document.getElementById('editor-new-category').value.trim().toLowerCase();
        }

        if (!title) { this.showToast('Title is required', 'error'); return; }
        if (!category) { this.showToast('Category is required', 'error'); return; }
        if (!content.trim()) { this.showToast('Content is required', 'error'); return; }

        const slug = this.editingPost ? this.editingPost.id : slugify(title);
        const readTime = calculateReadingTime(content);

        const fm = { title, excerpt, category: category.charAt(0).toUpperCase() + category.slice(1), date, readTime, tags };
        const fullContent = stringifyFrontmatter(fm) + '\n' + content.trim() + '\n';
        const filePath = `static-blog/${category}/${slug}.txt`;

        this.saving = true;
        this.showLoading('Publishing...');

        try {
            const files = [{ path: filePath, content: fullContent }];

            if (this.editingPost && this.editingPost.file !== filePath) {
                files.push({ path: this.editingPost.file, delete: true });
            }

            const updatedIndex = this.buildUpdatedIndex(slug, category, filePath);
            files.push({ path: 'blog-index.json', content: JSON.stringify(updatedIndex, null, 2) });

            const msg = this.editingPost
                ? `Update blog post: ${title}`
                : `Add blog post: ${title}`;

            await this.github.commitFiles(files, msg);

            this.hideLoading();
            this.showToast('Post published! Site will update in ~1 min.', 'success');

            this.destroyEditor();
            localStorage.removeItem('smde_admin-blog-editor');

            await this.showDashboard();
        } catch (err) {
            this.hideLoading();
            this.showToast('Publish failed: ' + err.message, 'error');
        } finally {
            this.saving = false;
        }
    }

    buildUpdatedIndex(slug, category, filePath) {
        const index = this.blogIndex
            ? JSON.parse(JSON.stringify(this.blogIndex))
            : { categories: {}, posts: [] };

        index.posts = index.posts.filter(p => p.id !== slug);
        index.posts.unshift({ id: slug, category, file: filePath });

        if (!index.categories[category]) {
            index.categories[category] = {
                name: category.charAt(0).toUpperCase() + category.slice(1),
                description: `Posts about ${category}`,
                color: 'gray',
            };
        }

        return index;
    }

    // ---- Delete ----

    confirmDelete(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        this.deleteTargetId = postId;
        document.getElementById('delete-post-title').textContent = `"${post.title || post.id}"?`;
        document.getElementById('modal-delete').classList.remove('hidden');
    }

    async executeDelete() {
        const post = this.posts.find(p => p.id === this.deleteTargetId);
        if (!post) return;

        document.getElementById('modal-delete').classList.add('hidden');
        this.showLoading('Deleting post...');

        try {
            const updatedIndex = JSON.parse(JSON.stringify(this.blogIndex));
            updatedIndex.posts = updatedIndex.posts.filter(p => p.id !== post.id);

            const catStillUsed = updatedIndex.posts.some(p => p.category === post.category);
            if (!catStillUsed) {
                delete updatedIndex.categories[post.category];
            }

            await this.github.commitFiles([
                { path: post.file, delete: true },
                { path: 'blog-index.json', content: JSON.stringify(updatedIndex, null, 2) },
            ], `Delete blog post: ${post.title || post.id}`);

            this.hideLoading();
            this.showToast('Post deleted. Site will update in ~1 min.', 'success');
            await this.showDashboard();
        } catch (err) {
            this.hideLoading();
            this.showToast('Delete failed: ' + err.message, 'error');
        }
    }

    // ---- Image Upload ----

    handleImageFiles(fileList) {
        const files = [...fileList].filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;

        const file = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            this.pendingImageFile = file;
            this.pendingImageDataUrl = e.target.result;
            document.getElementById('image-alt-preview').src = e.target.result;
            document.getElementById('image-alt-input').value =
                file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            document.getElementById('modal-image-alt').classList.remove('hidden');
            setTimeout(() => document.getElementById('image-alt-input').focus(), 100);
        };
        reader.readAsDataURL(file);
    }

    async insertImageWithAlt() {
        const altText = document.getElementById('image-alt-input').value.trim() || 'image';
        document.getElementById('modal-image-alt').classList.add('hidden');

        if (!this.pendingImageFile) return;

        try {
            const url = await this.processAndUploadImage(this.pendingImageFile, altText);
            if (this.editor) {
                const cm = this.editor.codemirror;
                cm.replaceSelection(`![${altText}](${url})`);
                cm.focus();
            }
        } catch (err) {
            this.showToast('Image upload failed: ' + err.message, 'error');
        }

        this.pendingImageFile = null;
        this.pendingImageDataUrl = null;
    }

    async processAndUploadImage(file, altText) {
        this.showLoading('Uploading image...');

        try {
            const dataUrl = await this.resizeImage(file);
            const base64Content = dataUrl.split(',')[1];

            const ts = Date.now();
            const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
            const filename = `${ts}-${safeName}`;
            const path = `blog-images/${filename}`;

            await this.github.commitFiles(
                [{ path, content: base64Content, encoding: 'base64' }],
                `Upload image: ${file.name}`
            );

            this.hideLoading();
            this.showToast('Image uploaded!', 'success');
            return path;
        } catch (err) {
            this.hideLoading();
            throw err;
        }
    }

    resizeImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                let { width, height } = img;
                const max = ADMIN_CONFIG.imageMaxWidth;

                if (width <= max) {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                    return;
                }

                const ratio = max / width;
                width = max;
                height = Math.round(height * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const quality = mime === 'image/jpeg' ? ADMIN_CONFIG.imageQuality : undefined;
                resolve(canvas.toDataURL(mime, quality));
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    // ---- Animation Upload ----

    handleAnimationFile(file) {
        if (!file) return;
        const isHtml = file.type === 'text/html' || /\.html?$/i.test(file.name);
        if (!isHtml) {
            this.showToast('Animation must be an .html file', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('Animation file too large (max 5MB)', 'error');
            return;
        }
        this.pendingAnimationFile = file;
        document.getElementById('animation-filename').textContent = file.name;
        document.getElementById('animation-label-input').value = 'Tap to interact';
        document.getElementById('animation-height-input').value = '420';
        document.getElementById('modal-animation').classList.remove('hidden');
        setTimeout(() => document.getElementById('animation-label-input').focus(), 100);
    }

    async insertAnimation() {
        const file = this.pendingAnimationFile;
        if (!file) return;

        const label = (document.getElementById('animation-label-input').value || 'Tap to interact').trim();
        let height = parseInt(document.getElementById('animation-height-input').value, 10);
        if (!height || height < 120) height = 420;
        if (height > 1200) height = 1200;

        document.getElementById('modal-animation').classList.add('hidden');
        this.showLoading('Uploading animation...');

        try {
            const text = await file.text();
            const base64 = utf8ToBase64(text);

            const ts = Date.now();
            const safeName = file.name.toLowerCase().replace(/\.html?$/i, '').replace(/[^a-z0-9.-]/g, '-');
            const path = `blog-animations/${ts}-${safeName}.html`;

            await this.github.commitFiles(
                [{ path, content: base64, encoding: 'base64' }],
                `Upload animation: ${file.name}`
            );

            const snippet = this.buildAnimationSnippet(path, label, height);
            if (this.editor) {
                const cm = this.editor.codemirror;
                cm.replaceSelection(`\n\n${snippet}\n\n`);
                cm.focus();
            }

            this.hideLoading();
            this.showToast('Animation uploaded!', 'success');
        } catch (err) {
            this.hideLoading();
            this.showToast('Animation upload failed: ' + err.message, 'error');
        } finally {
            this.pendingAnimationFile = null;
        }
    }

    buildAnimationSnippet(path, label, height) {
        const safeLabel = escapeHtml(label);
        const safePath = escapeHtml(path);
        return `<div class="animation-embed" data-anim-label="${safeLabel}" style="position:relative;margin:2rem 0;border-radius:10px;overflow:hidden;border:1px solid rgba(160,125,46,0.2);">
  <iframe src="${safePath}" loading="lazy" style="width:100%;height:${height}px;border:0;display:block;background:#0f1014;"></iframe>
</div>`;
    }

    // ---- Preview ----

    showPreview() {
        const content = this.editor ? this.editor.value() : '';
        const title = document.getElementById('editor-title').value;
        const repoBase = `https://raw.githubusercontent.com/${ADMIN_CONFIG.repoOwner}/${ADMIN_CONFIG.repoName}/${ADMIN_CONFIG.branch}/`;

        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true, gfm: true, headerIds: false, mangle: false,
                highlight: (code, lang) => {
                    if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                        try { return hljs.highlight(code, { language: lang }).value; } catch (_) { /* noop */ }
                    }
                    return code;
                },
            });

            let html = `<h1>${escapeHtml(title)}</h1>` + marked.parse(content.trim());
            html = html.replace(/src="blog-images\//g, `src="${repoBase}blog-images/`);
            const previewBody = document.getElementById('preview-body');
            previewBody.innerHTML = html;
            this.enhanceAnimations(previewBody);
        }

        document.getElementById('modal-preview').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    enhanceAnimations(root) {
        root.querySelectorAll('.animation-embed').forEach(embed => {
            if (embed.dataset.enhanced === '1') return;
            embed.dataset.enhanced = '1';

            const label = embed.dataset.animLabel || 'Tap to interact';

            const shield = document.createElement('div');
            shield.className = 'animation-shield';
            shield.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg><span>${escapeHtml(label)}</span>`;

            const release = document.createElement('button');
            release.type = 'button';
            release.className = 'animation-release';
            release.setAttribute('aria-label', 'Release animation');
            release.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Done</span>`;

            shield.addEventListener('click', () => embed.classList.add('is-active'));
            release.addEventListener('click', (e) => { e.stopPropagation(); embed.classList.remove('is-active'); });

            embed.appendChild(shield);
            embed.appendChild(release);
        });
    }

    hidePreview() {
        document.getElementById('modal-preview').classList.add('hidden');
        document.body.style.overflow = '';
    }

    // ---- UI Helpers ----

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const bg = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-cream-700 dark:bg-[#c4a96e]' };
        toast.className = `${bg[type] || bg.info} text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto toast-in`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('toast-in');
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    showLoading(message = 'Loading...') {
        document.getElementById('loading-message').textContent = message;
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    setupTheme() {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (saved === 'dark' || (!saved && prefersDark)) {
            document.documentElement.classList.add('dark');
        }
    }

    toggleTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    }

    // ---- Event Binding ----

    bindEvents() {
        // Login
        document.getElementById('btn-login').addEventListener('click', async () => {
            const pat = document.getElementById('input-pat').value.trim();
            if (!pat) { this.showToast('Please enter a token', 'error'); return; }
            try { await this.authenticateWithToken(pat); }
            catch (err) { this.showToast(err.message, 'error'); }
        });
        document.getElementById('input-pat').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('btn-login').click();
        });

        // Dashboard
        document.getElementById('btn-logout').addEventListener('click', () => this.logout());
        document.getElementById('btn-new-post').addEventListener('click', () => this.showEditor());
        document.getElementById('btn-theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('dashboard-search').addEventListener('input', () => this.renderPosts());
        document.getElementById('dashboard-filter').addEventListener('change', () => this.renderPosts());

        // Editor navigation
        document.getElementById('btn-back').addEventListener('click', async () => {
            this.destroyEditor();
            await this.showDashboard();
        });
        document.getElementById('btn-save').addEventListener('click', () => this.savePost());
        document.getElementById('btn-preview').addEventListener('click', () => this.showPreview());

        // Category new toggle
        document.getElementById('editor-category').addEventListener('change', (e) => {
            const newInput = document.getElementById('editor-new-category');
            const isNew = e.target.value === '__new__';
            newInput.classList.toggle('hidden', !isNew);
            if (isNew) newInput.focus();
        });

        // Image upload area
        const uploadArea = document.getElementById('image-upload-area');
        const imageInput = document.getElementById('image-file-input');

        uploadArea.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', (e) => {
            this.handleImageFiles(e.target.files);
            imageInput.value = '';
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-cream-400', 'dark:border-[#c4a96e]');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-cream-400', 'dark:border-[#c4a96e]');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-cream-400', 'dark:border-[#c4a96e]');
            this.handleImageFiles(e.dataTransfer.files);
        });

        // Animation upload area
        const animArea = document.getElementById('animation-upload-area');
        const animInput = document.getElementById('animation-file-input');

        animArea.addEventListener('click', () => animInput.click());
        animInput.addEventListener('change', (e) => {
            this.handleAnimationFile(e.target.files[0]);
            animInput.value = '';
        });

        animArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            animArea.classList.add('border-cream-400', 'dark:border-[#c4a96e]');
        });
        animArea.addEventListener('dragleave', () => {
            animArea.classList.remove('border-cream-400', 'dark:border-[#c4a96e]');
        });
        animArea.addEventListener('drop', (e) => {
            e.preventDefault();
            animArea.classList.remove('border-cream-400', 'dark:border-[#c4a96e]');
            this.handleAnimationFile(e.dataTransfer.files[0]);
        });

        // Animation embed modal
        document.getElementById('btn-insert-animation').addEventListener('click', () => this.insertAnimation());
        document.getElementById('btn-cancel-animation').addEventListener('click', () => {
            document.getElementById('modal-animation').classList.add('hidden');
            this.pendingAnimationFile = null;
        });

        // Image alt-text modal
        document.getElementById('btn-insert-image').addEventListener('click', () => this.insertImageWithAlt());
        document.getElementById('btn-cancel-image').addEventListener('click', () => {
            document.getElementById('modal-image-alt').classList.add('hidden');
            this.pendingImageFile = null;
            this.pendingImageDataUrl = null;
        });
        document.getElementById('image-alt-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('btn-insert-image').click();
        });

        // Preview modal
        document.getElementById('btn-close-preview').addEventListener('click', () => this.hidePreview());
        document.getElementById('modal-preview').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-preview')) this.hidePreview();
        });

        // Delete modal
        document.getElementById('btn-confirm-delete').addEventListener('click', () => this.executeDelete());
        document.getElementById('btn-cancel-delete').addEventListener('click', () => {
            document.getElementById('modal-delete').classList.add('hidden');
            this.deleteTargetId = null;
        });

        // Global escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hidePreview();
                document.getElementById('modal-delete').classList.add('hidden');
                document.getElementById('modal-image-alt').classList.add('hidden');
                document.getElementById('modal-animation').classList.add('hidden');
            }
        });
    }
}

// ============================================================
// Initialize
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
});
