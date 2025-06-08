---
title: "Modern Async/Await Patterns in JavaScript"
excerpt: "Exploring advanced patterns for handling asynchronous operations in modern JavaScript applications."
category: "technical"
date: "2024-01-15"
readTime: "8 min read"
tags: ["JavaScript", "Async", "Programming"]
---

# Modern Async/Await Patterns in JavaScript

Asynchronous programming has evolved significantly in JavaScript. Here are some advanced patterns I've found useful in building robust applications.

## Error Handling Patterns

One of the most crucial aspects of async programming is proper error handling:

```javascript
async function safeFetch(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    return null;
  }
}
```

## Parallel Execution

When you need to run multiple async operations in parallel:

```javascript
async function fetchMultipleResources() {
  const [users, posts, comments] = await Promise.all([
    fetch('/api/users').then(r => r.json()),
    fetch('/api/posts').then(r => r.json()),
    fetch('/api/comments').then(r => r.json())
  ]);
  
  return { users, posts, comments };
}
```

## Sequential with Results

Sometimes you need the result of one operation for the next:

```javascript
async function processUserData(userId) {
  const user = await fetchUser(userId);
  const preferences = await fetchUserPreferences(user.id);
  const recommendations = await generateRecommendations(user, preferences);
  
  return {
    user,
    preferences,
    recommendations
  };
}
```

## Retry Logic

Implementing retry logic for unreliable operations:

```javascript
async function retryOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Timeout Handling

Adding timeouts to async operations:

```javascript
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out')), ms)
  );
  
  return Promise.race([promise, timeout]);
}

// Usage
const result = await withTimeout(
  fetch('/api/slow-endpoint'),
  5000 // 5 second timeout
);
```

These patterns have saved me countless hours of debugging and have made my applications much more resilient. The key is to always think about what can go wrong and handle those cases gracefully.

---

*What async patterns do you find most useful? I'd love to hear about your experiences with asynchronous JavaScript!* 