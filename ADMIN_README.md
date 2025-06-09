# Admin Panel Guide

## Overview

Your website now includes a powerful admin panel that allows you to manage your blog content, edit site information, and sync changes to GitHub directly from a web interface.

## Accessing the Admin Panel

1. **From your website**: Click the small ⚙️ icon in the footer
2. **Direct URL**: Visit `yoursite.com/admin.html`
3. **Password**: `golden2025` (you can change this in `js/admin.js`)

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
- **Upload images** directly from the interface
- **Manage media files** for blog posts
- **Automatic organization** by category

### ⚙️ Settings & GitHub Integration
- **Set GitHub token** for automatic publishing
- **Configure repository** settings
- **One-click sync** to publish changes
- **Secure token storage** in browser

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
6. Click **🔄 Sync with GitHub** to publish

### Editing Existing Posts

1. In the **Blog Posts** tab, find your post
2. Click **Edit** next to the post
3. Make your changes
4. Click **Save Post**
5. Sync with GitHub to publish changes

### Publishing Changes

1. Make your changes (posts, content, etc.)
2. Go to **Settings** and ensure your GitHub token is set
3. Click **🔄 Sync with GitHub** in the header
4. Changes will be live within minutes

## GitHub Integration Setup

### Creating a GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate a new token with these permissions:
   - `repo` (Full control of repositories)
   - `workflow` (If you have GitHub Actions)
3. Copy the token and paste it in **Admin Panel → Settings**

### Repository Configuration

- Set your repository in format: `username/repository-name`
- Example: `goldenrishabh/goldensite`

## File Structure

The admin system works with your existing file structure:

```
├── admin.html              # Admin panel interface
├── js/admin.js             # Admin functionality
├── blog/                   # Source markdown files (local only)
│   ├── technical/
│   ├── philosophical/
│   ├── adventure/
│   └── ...
├── static-blog/            # Published files (GitHub)
│   ├── technical/
│   ├── philosophical/
│   └── ...
└── blog-index.json         # Blog metadata (auto-generated)
```

## Workflow

### Adding New Categories

1. Edit `js/admin.js` and add your category to the dropdown
2. Update `generate-blog-index.js` to include the new category
3. Add CSS styling in `index.html` for the category

### Content Creation Workflow

1. **Write** your post in the admin panel
2. **Preview** using the markdown editor
3. **Save** to store locally
4. **Sync** to publish to GitHub
5. **View** live on your website

## Security Features

- **Password protection** for admin access
- **Local storage** for drafts and settings
- **Secure token handling** for GitHub
- **Public site remains read-only** for visitors

## Customization

### Changing Admin Password

Edit the password in `js/admin.js`:
```javascript
this.adminPassword = 'your-new-password';
```

### Adding New Categories

1. Update the category options in `admin.html`
2. Add the category to `generate-blog-index.js`
3. Add styling in `index.html`

### Custom Styling

Modify the CSS in `admin.html` to match your preferences.

## Troubleshooting

### Admin Panel Won't Load
- Check browser console for errors
- Ensure all files are uploaded correctly
- Verify network connectivity

### GitHub Sync Fails
- Check your GitHub token permissions
- Verify repository name is correct
- Ensure you have write access to the repo

### Posts Not Appearing
- Run the blog index generator: `node generate-blog-index.js`
- Check that files are in the correct format
- Verify frontmatter syntax

## Tips

- **Save frequently** while writing long posts
- **Use preview mode** to check formatting
- **Sync regularly** to backup your work
- **Keep your GitHub token secure**

---

Enjoy your new admin system! 🚀 