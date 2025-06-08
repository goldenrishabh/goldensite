# Personal Website

A modern, minimalistic personal website built with HTML, CSS (Tailwind), and JavaScript. Features a beautiful cream color theme, dark mode support, responsive design, and a **fully dynamic markdown-powered blog system**.

## 🚀 Features

- **Clean, Modern Design**: Minimalistic aesthetic with cream color theme
- **Dark/Light Mode**: Automatic theme switching with user preference
- **Responsive**: Works perfectly on desktop, tablet, and mobile
- **Dynamic Blog System**: Automatically reads markdown files from folders - **no code editing required!**
- **Markdown Support**: Write blog posts in markdown format with frontmatter
- **Auto-Discovery**: Automatically detects new categories and posts
- **Animations**: Smooth transitions and scroll-triggered animations
- **No Backend Required**: Pure static site, perfect for GitHub Pages
- **SEO Friendly**: Semantic HTML and meta tags

## 🛠️ Setup

1. **Clone or download** this repository
2. **Customize the content** (see customization section below)
3. **Deploy to GitHub Pages** or any static hosting service

### GitHub Pages Deployment

1. Push this code to a GitHub repository
2. Go to Settings → Pages in your repository
3. Select "Deploy from a branch" and choose `main` branch
4. Your site will be available at `https://yourusername.github.io/repository-name`

## ✏️ Customization

### Personal Information

Edit `index.html` to update:
- Page title and meta description
- Your name in the navigation and hero section
- Bio and introduction text
- About section content
- Contact information (email, GitHub, LinkedIn URLs)
- Timeline in the About section

#### Example changes:
```html
<!-- Change this -->
<title>Your Name - Engineer, Writer, Thinker</title>

<!-- To this -->
<title>John Doe - Software Engineer & Tech Writer</title>
```

## 📝 Adding Blog Posts (No Code Editing Required!)

### Method 1: Quick Add (Recommended)

1. **Create a new folder** in the `blog/` directory for your category (if it doesn't exist)
2. **Add a markdown file** with frontmatter:

```markdown
---
title: "Your Post Title"
excerpt: "A brief description of your post"
category: "your-category"
date: "2024-01-20"
readTime: "5 min read"
tags: ["Tag1", "Tag2", "Tag3"]
---

# Your Post Title

Your markdown content here...
```

3. **Regenerate the index** by running:
```bash
node generate-blog-index.js
```

4. **Deploy** - your post will automatically appear on the website!

### Supported Categories

The system automatically recognizes these categories:
- `technical` - Programming, tutorials, technical insights
- `philosophical` - Deep thoughts, ethics, life reflections  
- `random` - Casual observations, personal musings
- `personal` - Personal experiences and stories
- `tutorials` - Step-by-step guides and how-tos
- `reviews` - Book reviews, tool reviews, and opinions

**Want a new category?** Just create a folder in `blog/` and it will automatically be detected!

### Frontmatter Fields

Required:
- `title`: Post title
- `date`: Publication date (YYYY-MM-DD format)

Optional:
- `excerpt`: Custom excerpt (auto-generated if not provided)
- `readTime`: Estimated reading time
- `tags`: Array of tags `["tag1", "tag2"]`
- `category`: Override auto-detected category

### Example Blog Structure

```
blog/
├── technical/
│   ├── my-awesome-tutorial.md
│   └── react-best-practices.md
├── personal/
│   ├── my-coding-journey.md
│   └── work-life-balance.md
└── reviews/
    ├── book-clean-code.md
    └── vscode-extensions.md
```

## 🔄 Updating Content

### Adding a New Post

1. Create your markdown file in the appropriate category folder
2. Run: `node generate-blog-index.js`
3. Push to your repository - done!

### Adding a New Category

1. Create a new folder in `blog/` (e.g., `blog/travel/`)
2. Add markdown files to the folder
3. Run: `node generate-blog-index.js`
4. The category will automatically appear in your navigation!

### Modifying Existing Posts

1. Edit the markdown file directly
2. No need to regenerate the index (unless you changed the filename)
3. Changes appear immediately!

## 🎨 Design Philosophy

This website embraces:
- **Minimalism**: Clean, uncluttered design
- **Typography**: Monospace font (JetBrains Mono) for a coding aesthetic
- **Cream Theme**: Warm, comfortable colors that are easy on the eyes
- **Smooth Interactions**: Subtle animations and transitions
- **Accessibility**: High contrast, semantic HTML, keyboard navigation

## 🔧 Technical Details

### Technologies Used
- **HTML5**: Semantic markup
- **Tailwind CSS**: Utility-first styling
- **Vanilla JavaScript**: No frameworks, pure ES6+
- **Marked.js**: Markdown parsing
- **Node.js**: Blog index generation (optional)

### How the Dynamic System Works

1. **Blog Index**: `blog-index.json` contains metadata about all posts
2. **Markdown Files**: Full content stored in `blog/category/post.md` files
3. **Dynamic Loading**: JavaScript fetches and parses markdown files on demand
4. **Frontmatter Parsing**: YAML-like frontmatter provides post metadata
5. **Auto-Generation**: Node.js script scans folders and creates the index

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Graceful degradation for older browsers

### Performance
- **Lazy loading**: Blog posts loaded only when needed
- **Efficient caching**: Parsed content cached in memory
- **Small initial load**: Only index file loaded initially
- **CDN-delivered dependencies**: Fast external resources

## 📱 Mobile Optimization

The website is fully responsive with:
- Mobile-first design approach
- Touch-friendly navigation
- Optimized typography for small screens
- Collapsible mobile menu

## 🌙 Dark Mode

Dark mode is automatically enabled based on:
1. User's system preference
2. Previously saved preference in localStorage
3. Manual toggle in the navigation

## 🚀 Deployment Options

### GitHub Pages (Recommended)
1. Push to GitHub repository
2. Enable Pages in repository settings
3. **Optional**: Set up GitHub Action to auto-regenerate blog index
4. Site deploys automatically

### GitHub Action for Auto-Index (Optional)

Create `.github/workflows/update-blog.yml`:

```yaml
name: Update Blog Index
on:
  push:
    paths:
      - 'blog/**'
jobs:
  update-index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: node generate-blog-index.js
      - run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add blog-index.json
          git commit -m "Auto-update blog index" || exit 0
          git push
```

### Other Static Hosts
Works with any static hosting service:
- **Netlify**: Automatic builds on push
- **Vercel**: Zero-config deployment
- **Firebase Hosting**: Simple static hosting
- **Cloudflare Pages**: Global edge deployment

## 🛠️ Advanced Customization

### Color Theme Customization

Edit the Tailwind config in `index.html`:

```javascript
colors: {
    cream: {
        50: '#fefcf3',   // Lightest
        100: '#fef7e0',
        // ... customize these values
        950: '#422d14',  // Darkest
    }
}
```

### Adding New Sections

1. Add HTML section to `index.html`
2. Add navigation link
3. Update CSS classes as needed

### Custom Category Colors

Edit `generate-blog-index.js` to add custom categories:

```javascript
const DEFAULT_CATEGORIES = {
    // Add your custom categories here
    travel: { name: 'Travel', description: 'Adventures and journeys', color: 'teal' },
    cooking: { name: 'Cooking', description: 'Recipes and food thoughts', color: 'orange' }
};
```

## 📄 File Structure

```
myWebsite/
├── index.html              # Main website
├── blog-index.json         # Auto-generated blog index
├── generate-blog-index.js  # Blog index generator
├── favicon.svg             # Website icon
├── README.md              # This file
├── js/
│   └── main.js            # Website functionality
└── blog/                  # Your content (edit these!)
    ├── technical/
    ├── philosophical/
    ├── random/
    └── [your-categories]/
```

## 🔍 Troubleshooting

### Blog Posts Not Showing
1. Check that your markdown files have proper frontmatter
2. Run `node generate-blog-index.js` to regenerate the index
3. Ensure your web server can serve `.json` files

### Images in Blog Posts
Place images in a `blog/images/` folder and reference them:
```markdown
![Alt text](../images/my-image.jpg)
```

### Code Syntax Highlighting
Use fenced code blocks with language specification:
````markdown
```javascript
function hello() {
    console.log('Hello, world!');
}
```
````

## 📄 License

This project is open source. Feel free to use it as a template for your own personal website.

## 🤝 Contributing

Improvements are welcome:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

**Happy blogging!** ✍️✨

*Now you can focus on writing great content instead of managing code!* 