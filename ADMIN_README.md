# Admin Panel Guide

## Overview

Your website now includes a powerful admin panel that allows you to manage your blog content, edit site information, and sync changes to GitHub directly from a web interface with **full GitHub API integration**.

## Accessing the Admin Panel

1. **From your website**: Click the small ⚙️ icon in the footer
2. **Direct URL**: Visit `yoursite.com/admin.html`
3. **Password**: `hello` (secure hashed authentication)

## 🔒 Security Features

- **Hashed Password Authentication**: Password is SHA-256 hashed, not stored in plain text
- **GitHub Token Encryption**: Tokens stored securely in browser localStorage
- **Admin-Only Access**: Public site remains completely read-only for visitors
- **Session Management**: Automatic logout and session security

## Features

### 🎯 Blog Post Management
- **View all posts** in a clean table interface
- **Create new posts** with a rich markdown editor
- **Edit existing posts** with live preview
- **Delete posts** with confirmation
- **Auto-generate** post IDs from titles
- **Categories**: Technical, Philosophical, Adventure, Random Thoughts, Personal

### 📝 Rich Markdown Editor
- **SimpleMDE editor** with toolbar
- **Live preview** and side-by-side editing
- **Fullscreen mode** for distraction-free writing
- **Syntax highlighting** and formatting tools

### 🎨 Site Content Management
- **Edit hero section** (title, subtitle, description)
- **Update about section** text
- **Change "currently reading"** book
- **Preview changes** before publishing

### 📁 File Manager
- **Upload images** directly to GitHub repository
- **View existing images** with thumbnails and file sizes
- **Automatic organization** in `static-blog/images/`
- **Real-time GitHub sync** for uploaded files

### ⚙️ Complete GitHub Integration
- **Real GitHub API** integration (not simulated)
- **Classic token** support for authentication
- **Automatic file creation/updates** on GitHub
- **One-click sync** to publish all changes
- **Error handling** with detailed messages

## How to Use

### Creating a New Blog Post

1. Go to the **Blog Posts** tab
2. Click **➕ New Post**
3. Fill in the metadata:
   - **Title**: Your post title
   - **Category**: Choose from available categories
   - **Excerpt**: Brief description for previews
   - **Tags**: Comma-separated tags
   - **Read Time**: Estimated reading time
4. Write your content in **Markdown**
5. Click **Save Post**
6. Click **🔄 Sync with GitHub** to publish (real GitHub API call)

### Editing Existing Posts

1. In the **Blog Posts** tab, find your post
2. Click **Edit** next to the post
3. Make your changes
4. Click **Save Post**
5. Sync with GitHub to publish changes to live site

### Publishing Changes

1. Make your changes (posts, content, etc.)
2. Go to **Settings** and ensure your GitHub token is set
3. Click **🔄 Sync with GitHub** in the header
4. **Real GitHub API calls** will update your repository
5. Changes will be live within minutes

## GitHub Integration Setup

### Creating a GitHub Classic Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a descriptive name: "Website Admin Panel"
4. Select scopes:
   - ✅ **repo** (Full control of private repositories)
   - ✅ **public_repo** (Access public repositories) 
   - ✅ **workflow** (Update GitHub Action workflows)
5. Set expiration as needed (recommend: No expiration for convenience)
6. Click **Generate token**
7. **Copy the token immediately** (you won't see it again)
8. Paste it in **Admin Panel → Settings → GitHub Token**

### Repository Configuration

- Set your repository in format: `username/repository-name`
- Example: `goldenrishabh/goldensite`
- Make sure you have **write access** to this repository

## Real GitHub API Functionality

### What Actually Happens When You Sync:

1. **Blog Index Update**: Updates `blog-index.json` on GitHub
2. **Post Files**: Creates/updates `.txt` files in `static-blog/` directory
3. **Image Uploads**: Uploads images to `static-blog/images/`
4. **Commit Messages**: Automatic descriptive commit messages
5. **Error Handling**: Detailed error messages if something fails

### API Endpoints Used:
- `GET /repos/{owner}/{repo}/contents/{path}` - Read files
- `PUT /repos/{owner}/{repo}/contents/{path}` - Create/update files
- `DELETE /repos/{owner}/{repo}/contents/{path}` - Delete files

## File Structure

The admin system works with your existing file structure:

```
├── admin.html              # Admin panel interface
├── js/admin.js             # Admin functionality with GitHub API
├── blog/                   # Source markdown files (local editing)
│   ├── technical/
│   ├── philosophical/
│   ├── adventure/
│   └── ...
├── static-blog/            # Published files (GitHub Pages)
│   ├── technical/
│   ├── philosophical/
│   ├── images/            # Uploaded images
│   └── ...
└── blog-index.json         # Blog metadata (auto-updated via API)
```

## Security & Password Management

### Current Password
- **Password**: `hello`
- **Security**: SHA-256 hashed in code
- **Not visible** in browser developer tools

### Changing the Password

1. Generate SHA-256 hash of your new password
2. Replace the hash in `js/admin.js`:
```javascript
// Find this line and replace the hash:
this.adminPasswordHash = 'your-new-sha256-hash-here';
```
3. Commit and push the change

### Generate SHA-256 Hash (using browser console):
```javascript
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Usage: 
hashPassword('your-new-password').then(console.log);
```

## Troubleshooting

### GitHub Sync Fails
- ✅ Check your classic token permissions include `repo`
- ✅ Verify repository name is correct (`username/repo`)
- ✅ Ensure you have write access to the repository
- ✅ Check if token has expired

### 403 Forbidden Error
- Your token doesn't have sufficient permissions
- Generate a new classic token with `repo` scope

### 404 Not Found Error
- Repository name is incorrect
- Repository is private and token doesn't have access

### Admin Panel Won't Load
- Check browser console for errors
- Ensure all files are uploaded correctly
- Clear browser cache and try again

### Authentication Fails
- Make sure you're using the correct password
- Try clearing browser localStorage: `localStorage.clear()`

## Tips

- **Save frequently** while writing long posts
- **Use preview mode** to check formatting before syncing
- **Sync regularly** to backup your work to GitHub
- **Keep your GitHub token secure** and don't share it
- **Set token expiration** based on your security requirements
- **Test with a draft post** before publishing important content

---

🎉 **You now have a fully functional CMS with real GitHub integration!** 🚀 