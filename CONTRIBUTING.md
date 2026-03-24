# Contributing to UK Birding Discovery

Thank you for your interest in contributing to UK Birding Discovery! This document provides guidelines and instructions for contributing to this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [License](#license)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what's best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully

## Getting Started

### Ways to Contribute

We welcome contributions in many forms:

- 🐛 **Bug Reports** - Found a bug? Let us know!
- ✨ **Feature Requests** - Have an idea? We'd love to hear it!
- 📝 **Documentation** - Help improve our docs
- 🧪 **Testing** - Help test new features and report issues
- 💻 **Code Contributions** - Fix bugs or implement features
- 🎨 **Design** - Improve UI/UX
- 🌍 **Translations** - Help make this accessible to more people

### Before You Start

1. **Check existing issues** - Someone might already be working on it
2. **Open an issue first** - For significant changes, discuss before coding
3. **Read the docs** - Familiarize yourself with the project structure

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git
- A code editor (VS Code recommended)

### Local Setup

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/birding-3.git
   cd birding-3
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open http://localhost:3000**

### Project Structure

```
birding-3/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── PostcodeSearch.tsx
│   ├── BirdCard.tsx
│   ├── BirdList.tsx
│   ├── LocationCard.tsx
│   └── LocationList.tsx
├── lib/
│   ├── api/              # API client modules
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
└── public/               # Static assets
```

## How to Contribute

### Reporting Bugs

When reporting bugs, please include:

- **Description** - Clear description of the bug
- **Steps to Reproduce** - Numbered steps to reproduce the issue
- **Expected Behavior** - What you expected to happen
- **Actual Behavior** - What actually happened
- **Environment** - Browser, OS, Node version
- **Screenshots** - If applicable

**Template:**
```markdown
## Bug Description
[Clear description]

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Browser: Chrome 120
- OS: macOS 14
- Node: 18.17.0

## Screenshots
[If applicable]
```

### Suggesting Features

When suggesting features, please include:

- **Problem Statement** - What problem does this solve?
- **Proposed Solution** - How would you implement it?
- **Alternatives** - Other solutions you've considered
- **Use Cases** - Who would benefit and how?

### Contributing Code

1. **Create an issue** - Describe what you want to work on
2. **Wait for approval** - Maintainers will review and approve
3. **Fork and clone** - Fork the repo and clone locally
4. **Create a branch** - Use descriptive branch names
5. **Make changes** - Write clean, tested code
6. **Test thoroughly** - Ensure nothing breaks
7. **Commit** - Follow commit message guidelines
8. **Push** - Push to your fork
9. **Open PR** - Create a pull request

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid using `any` type
- Export types from `lib/types/`

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use meaningful component names
- Add JSDoc comments for complex components
- Use TypeScript interfaces for props

**Example:**
```typescript
interface BirdCardProps {
  bird: Bird;
  onSelect?: (bird: Bird) => void;
}

/**
 * Displays a single bird with image, name, and details
 */
export default function BirdCard({ bird, onSelect }: BirdCardProps) {
  // Component implementation
}
```

### Styling

- Use Tailwind CSS utility classes
- Follow the existing color scheme
- Ensure responsive design (mobile-first)
- Maintain accessibility (WCAG AA)

### File Organization

- One component per file
- Co-locate related files
- Use clear, descriptive file names
- Export types separately from implementations

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```bash
feat(search): add autocomplete for postcode input

Added autocomplete functionality to suggest UK postcodes
as users type, improving UX and reducing invalid inputs.

Closes #123
```

```bash
fix(birds): correct image URLs for bird photos

Fixed broken image URLs that were causing 404 errors
for certain bird species.

Fixes #456
```

### Best Practices

- Write clear, descriptive commit messages
- Keep commits focused and atomic
- Reference issue numbers when applicable
- Use present tense ("add feature" not "added feature")

## Pull Request Process

### Before Submitting

- [ ] Code builds without errors (`npm run build`)
- [ ] All tests pass (if applicable)
- [ ] Code follows project style guidelines
- [ ] Documentation is updated (if needed)
- [ ] No console errors or warnings
- [ ] Tested on multiple browsers
- [ ] Mobile-responsive (if UI changes)

### PR Description Template

```markdown
## Description
[Describe your changes]

## Related Issue
Fixes #[issue-number]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Tested locally
- [ ] Tested on mobile
- [ ] Tested in multiple browsers

## Screenshots
[If applicable, add screenshots]

## Checklist
- [ ] Code builds successfully
- [ ] Follows coding standards
- [ ] Documentation updated
- [ ] No breaking changes
```

### Review Process

1. **Submit PR** - Create pull request from your fork
2. **Automated checks** - CI/CD runs (if configured)
3. **Code review** - Maintainers review your code
4. **Address feedback** - Make requested changes
5. **Approval** - PR is approved by maintainer
6. **Merge** - Maintainer merges your PR

### After Your PR is Merged

- Delete your feature branch
- Pull the latest changes from main
- Celebrate! 🎉

## API Integration Guidelines

### Adding New APIs

When adding new API integrations:

1. Create a client in `lib/api/`
2. Define types in `lib/types/`
3. Add error handling
4. Include fallback/mock data
5. Document the API in README
6. Respect API rate limits
7. Cache responses when appropriate

**Example Structure:**
```typescript
// lib/api/newApiClient.ts
export async function fetchData(params: Params): Promise<Result> {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('API error');
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    return getFallbackData();
  }
}
```

## Accessibility Requirements

All contributions must maintain accessibility:

- ✅ Semantic HTML elements
- ✅ ARIA labels where needed
- ✅ Keyboard navigation support
- ✅ Color contrast ratios ≥ 4.5:1
- ✅ Alt text for images
- ✅ Focus indicators visible
- ✅ Screen reader compatible

## Testing Guidelines

### Manual Testing

Test your changes with:
- Multiple UK postcodes (SW1A 1AA, M1 1AE, EH1 1YZ)
- Invalid postcodes
- Empty inputs
- Long location names
- Slow network connections
- Different screen sizes

### Browser Testing

Test in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Documentation

When updating documentation:

- Use clear, simple language
- Include code examples
- Add screenshots for UI changes
- Keep README up to date
- Update API documentation
- Add JSDoc comments to functions

## Community

### Getting Help

- 💬 **GitHub Discussions** - Ask questions
- 🐛 **GitHub Issues** - Report bugs
- 📧 **Email** - Contact maintainers

### Stay Updated

- ⭐ Star the repository
- 👀 Watch for updates
- 📢 Follow announcements

## License Agreement

By contributing to this project, you agree that:

- Your contributions will be licensed under the same license as the project
- You have the right to contribute the code/content
- You understand the project's license terms

See [LICENSE.md](LICENSE.md) for full license details.

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes (for significant contributions)
- README acknowledgments section

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search closed issues
3. Ask in GitHub Discussions
4. Open a new issue with the "question" label

---

**Thank you for contributing to UK Birding Discovery! Together we're making birding more accessible to everyone in the UK.** 🐦

Happy coding! 🚀