# Admin Panel Guide

## Overview

Your website now includes a powerful admin panel that allows you to manage your blog content, edit site information, and sync changes to GitHub directly from a web interface with **full GitHub API integration**.

## Accessing the Admin Panel

1. **From your website**: Click the small ⚙️ icon in the footer
2. **Direct URL**: Visit `yoursite.com/admin.html`
3. **Authentication**: Use your GitHub Personal Access Token (much more secure than passwords!)

## 🔒 Security Features

- **GitHub Token Authentication**: Uses your actual GitHub credentials for authentication
- **Repository Permission Verification**: Checks that you have write access to the repository
- **No Client-Side Secrets**: No hardcoded passwords visible in browser code
- **Admin-Only Access**: Public site remains completely read-only for visitors
- **Session Management**: Secure token-based session handling

## Authentication Setup

### Getting Your GitHub Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a descriptive name: "Website Admin Panel"
4. Select scopes:
   - ✅ **repo** (Full control of private repositories)
   - ✅ **public_repo** (Access public repositories) 
5. Set expiration as needed (recommend: 90 days for security)
6. Click **Generate token**
7. **Copy the token immediately** (you won't see it again)

### Logging In

1. Open the admin panel (`yoursite.com/admin.html`)
2. Enter your GitHub Personal Access Token in the first field
3. Enter your repository name (`username/repository`) or leave the default
4. Click **Verify & Access**

The system will:
- Verify your token with GitHub's API
- Check that you have write access to the repository
- Authenticate you if everything is valid

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
- **Token-based authentication** for maximum security
- **Automatic file creation/updates** on GitHub
- **One-click sync** to publish all changes
- **Error handling** with detailed messages

## ✨ Draft/Publish System

### 📝 **Smart Status Management**
- **Draft Posts**: Saved privately in `admin-drafts/` folder on GitHub
- **Published Posts**: Live in `static-blog/` folder and appear on your website
- **Automatic File Management**: Posts move between folders when status changes
- **No Data Loss**: All drafts are safely stored in your GitHub repository

### 🎯 **How It Works**

#### **Creating Posts**
1. Click "New Post" - defaults to Draft status
2. Write your content and click "📝 Save Draft"
3. Post is saved to `admin-drafts/{category}/{post-id}.txt` on GitHub
4. Completely private - won't appear on your website

#### **Publishing Posts**
1. When ready, click "🌐 Save & Publish" or "Publish" button
2. Post moves from `admin-drafts/` to `static-blog/` folder
3. Appears in `blog-index.json` for public consumption
4. Goes live on your website immediately

#### **Managing Status**
- **Quick Toggle**: Use Publish/Unpublish buttons in the post list
- **Bulk View**: Filter by "All Posts", "Published", or "Drafts"
- **Visual Feedback**: Draft posts have yellow highlighting
- **Real-time Counts**: Dashboard shows total, published, and draft counts

### 🔒 **Privacy & Security**

#### **Draft Protection**
- Drafts stored in `admin-drafts/` folder (not in public `static-blog/`)
- Never included in `blog-index.json`
- GitHub repository keeps them, but they're not web-accessible
- Only you (with admin access) can see drafts

#### **Published Content**
- Lives in `static-blog/` folder
- Included in public `blog-index.json`
- Automatically appears on your website
- Visible to all website visitors

### 📁 **File Structure**

```
├── admin-drafts/           # Private drafts (GitHub only)
│   ├── technical/
│   │   ├── my-draft-post.txt
│   │   └── work-in-progress.txt
│   ├── personal/
│   └── ...
├── static-blog/            # Published content (public)
│   ├── technical/
│   │   ├── published-post.txt
│   │   └── live-tutorial.txt
│   ├── images/
│   └── ...
└── blog-index.json         # Only includes published posts
```

### 🔄 **Sync Behavior**

#### **What Gets Synced**
- **Published Posts**: Synced to `static-blog/` → appear on website
- **Draft Posts**: Synced to `admin-drafts/` → kept private
- **Status Changes**: Files automatically move between folders

#### **Sync Process**
1. Published posts → `static-blog/` folder
2. Draft posts → `admin-drafts/` folder  
3. `blog-index.json` updated with only published posts
4. Your website shows only published content

### 💡 **Workflow Examples**

#### **Writing a New Post**
1. Click "New Post" 
2. Write content, save as draft multiple times
3. Preview locally if needed
4. When satisfied, click "Save & Publish"
5. Post goes live immediately

#### **Unpublishing a Post**
1. Find published post in list
2. Click "Unpublish" 
3. Post moves to drafts, disappears from website
4. Edit and republish when ready

#### **Managing Multiple Drafts**
1. Use "📝 Drafts" filter to see all work-in-progress
2. Edit and save drafts as many times as needed
3. Publish individual posts when ready
4. Keep others as drafts for future work

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
2. Click **🔄 Sync with GitHub** in the header
3. **Real GitHub API calls** will update your repository
4. Changes will be live within minutes

## GitHub Integration Details

### What Actually Happens When You Sync:

1. **Authentication Check**: Verifies your token and repository access
2. **Blog Index Update**: Updates `blog-index.json` on GitHub
3. **Post Files**: Creates/updates `.txt` files in `static-blog/` directory
4. **Image Uploads**: Uploads images to `static-blog/images/`
5. **Commit Messages**: Automatic descriptive commit messages
6. **Error Handling**: Detailed error messages if something fails

### API Endpoints Used:
- `GET /repos/{owner}/{repo}` - Verify repository access
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

## Troubleshooting

### Authentication Issues

**"Invalid GitHub token"**
- Your token may be expired or incorrect
- Generate a new classic token with 'repo' scope

**"You need write access to this repository"**
- Your token doesn't have push permissions to the repository
- Make sure you own the repository or have collaborator access
- Regenerate token with 'repo' scope

**"Repository not found or not accessible"**
- Check that the repository name is correct (`username/repository`)
- Repository might be private and your token doesn't have access
- Make sure the repository exists

### GitHub Sync Fails
- ✅ Check your token hasn't expired
- ✅ Verify repository name is correct (`username/repo`)
- ✅ Ensure you have write access to the repository
- ✅ Check browser console for detailed error messages

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

## Security Best Practices

### Token Management
- **Set expiration dates** for your tokens (recommend: 90 days)
- **Regenerate tokens periodically** for better security
- **Never share your token** with others
- **Use descriptive names** when creating tokens
- **Delete unused tokens** from GitHub settings

### Repository Access
- **Only use tokens with necessary permissions** (repo scope)
- **Verify repository ownership** before entering credentials
- **Use private repositories** for sensitive content
- **Monitor repository access logs** in GitHub

## Tips

- **Save frequently** while writing long posts
- **Use preview mode** to check formatting before syncing
- **Sync regularly** to backup your work to GitHub
- **Keep your GitHub token secure** and don't share it
- **Set reasonable token expiration** based on your security requirements
- **Test with a draft post** before publishing important content
- **Monitor your GitHub notifications** for any unexpected activity

---

🎉 **You now have a fully functional CMS with secure GitHub token authentication!** 🚀 