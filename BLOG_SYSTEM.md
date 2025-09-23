# Blog Publishing System

A complete automated blog publishing system for your personal website.

## Quick Start

### Using npm scripts (recommended):
```bash
npm run blog:generate  # Process raw blogs and generate files
npm run blog:publish   # Generate files and publish to GitHub
npm run blog:help      # Show help and usage information
```

### Using direct commands:
```bash
node blog-cli.js generate  # Process raw blogs and generate files
node blog-cli.js publish   # Generate files and publish to GitHub
```

## How It Works

### 1. Write Your Blog
- Create a `.md` file in the `raw/` directory
- Include proper frontmatter with required fields

### 2. Generate Files
- Run `npm run blog:generate` or `node blog-cli.js generate`
- The system will:
  - Calculate reading time automatically
  - Move the blog to the appropriate category directory
  - Generate the blog index
  - Create static files for the website

### 3. Publish to GitHub
- Run `npm run blog:publish` or `node blog-cli.js publish`
- The system will:
  - Run the generate command
  - Commit all changes
  - Push to GitHub

## Blog File Format

Your blog files in `raw/` must have this frontmatter structure:

```markdown
---
title: "Your Blog Title"
excerpt: "Brief description of your post"
category: "Business"  # or Technical, Philosophical, etc.
date: "2024-12-19"
readTime:             # Optional - will be calculated automatically
tags: ["Tag1", "Tag2"] # Optional
---

# Your Blog Title

Your markdown content here...
```

## Required Fields

- `title`: The blog post title
- `category`: The category (case-insensitive)
- `date`: Publication date (YYYY-MM-DD format)

## Optional Fields

- `excerpt`: Custom excerpt (auto-generated if not provided)
- `readTime`: Reading time (calculated automatically if not provided)
- `tags`: Array of tags
- `slug`: Custom URL slug (generated from title if not provided)

## Supported Categories

- `technical` - Programming, tutorials, technical insights
- `philosophical` - Deep thoughts, ethics, life reflections
- `business` - Startup insights, product strategy, business philosophy
- `personal` - Personal experiences and stories
- `tutorials` - Step-by-step guides and how-tos
- `reviews` - Book reviews, tool reviews, and opinions
- `adventure` - Travel stories, outdoor adventures, and explorations
- `random` - Casual observations, personal musings

## Features

- ✅ **Automatic read time calculation** - Based on word count and average reading speed
- ✅ **Case-insensitive categories** - "Business" and "business" both work
- ✅ **URL-friendly slugs** - Generated automatically from titles
- ✅ **GitHub integration** - Automatic commit and push
- ✅ **Static file generation** - Creates both markdown and text versions
- ✅ **Image support** - Copies image directories automatically
- ✅ **Error handling** - Validates required fields and provides helpful error messages

## File Structure

```
raw/                           # Your draft blog files go here
├── blog1.md
└── blog2.md

blog/                          # Generated blog files (organized by category)
├── business/
│   └── your-blog-slug.md
└── technical/
    └── another-blog-slug.md

static-blog/                   # Static files for the website
├── business/
│   └── your-blog-slug.txt
└── technical/
    └── another-blog-slug.txt

blog-index.json               # Generated blog index
```

## Workflow

1. **Write**: Create your blog in `raw/your-blog.md`
2. **Generate**: Run `npm run blog:generate`
3. **Publish**: Run `npm run blog:publish`
4. **Done**: Your blog is live on your website!

## Tips

- The system automatically removes processed files from `raw/` after moving them
- Reading time is calculated based on 225 words per minute
- Categories are normalized to lowercase for directory structure
- All changes are automatically committed and pushed to GitHub
- The system preserves your original frontmatter while adding calculated fields
