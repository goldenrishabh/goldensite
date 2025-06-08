#!/usr/bin/env node

/**
 * Blog Index Generator
 * 
 * This script automatically generates blog-index.json by scanning the blog/ directory
 * Run this whenever you add new blog posts or categories
 * 
 * Usage: node generate-blog-index.js
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = './blog';
const OUTPUT_FILE = './blog-index.json';

// Default category configurations
const DEFAULT_CATEGORIES = {
    technical: { name: 'Technical', description: 'Programming, tutorials, technical insights', color: 'blue' },
    philosophical: { name: 'Philosophical', description: 'Deep thoughts, ethics, life reflections', color: 'purple' },
    random: { name: 'Random Thoughts', description: 'Casual observations, personal musings', color: 'green' },
    personal: { name: 'Personal', description: 'Personal experiences and stories', color: 'pink' },
    tutorials: { name: 'Tutorials', description: 'Step-by-step guides and how-tos', color: 'indigo' },
    reviews: { name: 'Reviews', description: 'Book reviews, tool reviews, and opinions', color: 'yellow' }
};

function parseMarkdownFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { frontmatter: {}, content };
    }
    
    const frontmatterText = match[1];
    const markdownContent = match[2];
    
    const frontmatter = {};
    frontmatterText.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Remove quotes
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            
            // Parse arrays
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(item => 
                    item.trim().replace(/['"]/g, '')
                );
            }
            
            frontmatter[key] = value;
        }
    });
    
    return { frontmatter, content: markdownContent };
}

function scanBlogDirectory() {
    if (!fs.existsSync(BLOG_DIR)) {
        console.error(`Blog directory ${BLOG_DIR} does not exist!`);
        process.exit(1);
    }
    
    const categories = {};
    const posts = [];
    
    const categoryDirs = fs.readdirSync(BLOG_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    console.log(`Found categories: ${categoryDirs.join(', ')}`);
    
    categoryDirs.forEach(categoryDir => {
        const categoryPath = path.join(BLOG_DIR, categoryDir);
        
        // Set up category configuration
        categories[categoryDir] = DEFAULT_CATEGORIES[categoryDir] || {
            name: categoryDir.charAt(0).toUpperCase() + categoryDir.slice(1),
            description: `Posts about ${categoryDir}`,
            color: 'gray'
        };
        
        // Scan for markdown files
        const files = fs.readdirSync(categoryPath)
            .filter(file => file.endsWith('.md'));
        
        console.log(`  ${categoryDir}: ${files.length} post(s)`);
        
        files.forEach(file => {
            const filePath = path.join(categoryPath, file);
            const relativePath = './' + path.join('blog', categoryDir, file).replace(/\\/g, '/');
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const { frontmatter } = parseMarkdownFrontmatter(content);
                
                const postId = path.basename(file, '.md');
                
                posts.push({
                    id: postId,
                    category: categoryDir,
                    file: relativePath,
                    // Include metadata for easier debugging
                    title: frontmatter.title || postId,
                    date: frontmatter.date || new Date().toISOString().split('T')[0]
                });
                
                console.log(`    ✓ ${file} (${frontmatter.title || 'No title'})`);
            } catch (error) {
                console.warn(`    ⚠ Failed to parse ${file}: ${error.message}`);
            }
        });
    });
    
    // Sort posts by date (newest first)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { categories, posts };
}

function generateBlogIndex() {
    console.log('🔍 Scanning blog directory...');
    const { categories, posts } = scanBlogDirectory();
    
    const blogIndex = {
        categories,
        posts: posts.map(({ title, date, ...post }) => post) // Remove metadata
    };
    
    console.log(`\n📝 Generated index with ${Object.keys(categories).length} categories and ${posts.length} posts`);
    
    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(blogIndex, null, 2));
    console.log(`✅ Blog index written to ${OUTPUT_FILE}`);
    
    // Show summary
    console.log('\n📊 Summary:');
    Object.entries(categories).forEach(([key, category]) => {
        const count = posts.filter(p => p.category === key).length;
        console.log(`  ${category.name}: ${count} post(s)`);
    });
}

// Run if called directly
if (require.main === module) {
    try {
        generateBlogIndex();
    } catch (error) {
        console.error('❌ Error generating blog index:', error.message);
        process.exit(1);
    }
}

module.exports = { generateBlogIndex, parseMarkdownFrontmatter }; 