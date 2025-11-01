# 🤝 Contributing to StoreSync

Thank you for your interest in contributing to StoreSync! This guide will help you get started with contributing to our cross-platform e-commerce management system.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [AI-Assisted Development](#ai-assisted-development)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 15+ (or Neon account)
- Clerk account for authentication
- Git for version control

### First Time Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/storesync.git
   cd storesync
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/original-owner/storesync.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Set up environment** (see [README.md](README.md#quick-start))

## 🛠️ Development Setup

### Environment Configuration

Copy the example environment file and configure:
```bash
cp .env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk authentication
- `CLERK_SECRET_KEY` - Clerk authentication
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - 32+ character encryption key

### Database Setup

```bash
# Run database migrations
npm run db:migrate

# Open database studio (optional)
npm run db:studio
```

### Development Server

```bash
# Start development server (optimized)
npm run dev:light

# Or standard development server
npm run dev
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Protected dashboard pages
│   └── (auth)/           # Authentication pages
├── components/            # React components
│   ├── stores/           # Store-related components
│   └── ui/               # UI components (shadcn)
├── lib/                  # Utilities and configurations
│   ├── db/               # Database schemas and operations
│   ├── services/         # Business logic services
│   └── shopee/           # Shopee integration logic
└── types/                # TypeScript type definitions

docs/                     # Documentation
├── development/          # Development guides
└── database/            # Database documentation

scripts/                 # Utility scripts
```

## 🔄 Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/feature-name` - Feature development
- `fix/issue-description` - Bug fixes
- `docs/update-description` - Documentation updates

### Typical Workflow

1. **Sync with upstream**:
   ```bash
   git checkout main
   git pull upstream main
   ```

2. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes** and commit regularly:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request** on GitHub

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```bash
git commit -m "feat: add Shopee product sync functionality"
git commit -m "fix: resolve OAuth callback error handling"
git commit -m "docs: update API integration guide"
```

## 📝 Coding Standards

### TypeScript

- **Strict mode enabled** - All code must pass TypeScript strict checks
- **Explicit types** - Prefer explicit types over `any`
- **Interface over type** - Use interfaces for object shapes
- **Consistent naming** - Use camelCase for variables, PascalCase for components

### Code Style

- **ESLint + Prettier** - Automated formatting and linting
- **Import organization** - Group imports logically
- **Component structure** - Follow established patterns
- **Error handling** - Comprehensive error handling with user-friendly messages

### File Organization

- **Barrel exports** - Use index.ts files for clean imports
- **Colocation** - Keep related files together
- **Naming conventions** - Descriptive, consistent file names
- **Component structure** - One component per file (except small utilities)

## 🧪 Testing Guidelines

### Testing Strategy

- **Unit Tests** - Service layer and utility functions
- **Integration Tests** - API endpoints and database operations
- **Component Tests** - React component behavior
- **E2E Tests** - Critical user journeys (planned)

### Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- **Test behavior, not implementation**
- **Use descriptive test names**
- **Follow AAA pattern** (Arrange, Act, Assert)
- **Mock external dependencies**
- **Test error scenarios**

Example:
```typescript
describe('ShopeeOAuth', () => {
  it('should generate valid authorization URL', () => {
    // Arrange
    const oauth = new ShopeeOAuth(mockConfig);
    
    // Act
    const url = oauth.getAuthorizationUrl();
    
    // Assert
    expect(url).toContain('https://partner.shopeemobile.com');
    expect(url).toContain('client_id=');
  });
});
```

## 📤 Submitting Changes

### Pull Request Process

1. **Ensure tests pass**:
   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```

2. **Update documentation** if needed

3. **Create Pull Request** with:
   - Clear title and description
   - Reference related issues
   - Screenshots for UI changes
   - Testing instructions

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added tests for new functionality
- [ ] Manual testing completed

## Screenshots (if applicable)

## Related Issues
Fixes #123
```

### Review Process

- **Automated checks** must pass
- **At least one reviewer** approval required
- **Address feedback** promptly
- **Squash commits** before merge (if requested)

## 🤖 AI-Assisted Development

This project is optimized for AI-assisted development:

### Documentation Structure

- **Comprehensive context** in each document
- **Current status** clearly indicated
- **Next steps** prioritized and actionable
- **Technical details** for implementation guidance

### AI Development Guidelines

1. **Read documentation first** - Check current status and architecture
2. **Follow established patterns** - Use existing code patterns and structures
3. **Update documentation** - Keep status and progress current
4. **Test thoroughly** - Ensure changes work with existing functionality

### Useful Commands for AI Tools

```bash
# System health check
npm run diagnose

# Check current implementation status
cat docs/development/current-status.md

# View next priorities
cat docs/development/next-steps.md

# Check for issues
npm run troubleshoot
```

## 🎯 Current Development Priorities

### High Priority
1. Complete Shopee sandbox testing
2. Implement basic product synchronization
3. Enhance error handling and user feedback
4. Optimize API call patterns

### Medium Priority
1. Add TikTok Shop integration research
2. Implement advanced sync features
3. Add comprehensive analytics
4. Performance optimization

### Low Priority
1. UI/UX improvements
2. Additional platform integrations
3. Advanced automation features
4. Mobile app development

## 📞 Getting Help

### Resources

- **Documentation**: [`docs/`](docs/) folder
- **Architecture**: [`docs/development/architecture.md`](docs/development/architecture.md)
- **Troubleshooting**: [`docs/development/troubleshooting.md`](docs/development/troubleshooting.md)
- **Current Status**: [`docs/development/current-status.md`](docs/development/current-status.md)

### Communication

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and ideas
- **Pull Request Comments** - Code-specific discussions

## 🏆 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- GitHub contributor graphs

## 📄 License

By contributing to StoreSync, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to StoreSync! Your efforts help build a better e-commerce management platform for everyone.** 🚀