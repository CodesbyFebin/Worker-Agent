# Contributing to Worker Agent.Cloud

Thank you for your interest in contributing to Worker Agent.Cloud! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

Please be respectful and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Find a bug? Report it via GitHub Issues with:
- A clear description
- Steps to reproduce
- Expected vs actual behavior
- Your environment details

### Suggesting Features

Have an idea? Open an issue with:
- A clear feature description
- The problem it solves
- Any implementation thoughts

### Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run validate`
5. Submit pull request

## Development Setup

```bash
# Clone
git clone https://github.com/Cyberteckmaster/Worker-Agent.git
cd Worker-Agent

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start services
npm run local:infra
npm run dev

# The app is now running at:
# Client: http://localhost:5173
# API: http://localhost:4000
```

## Coding Standards

- TypeScript strict mode enabled
- Use Zod for input validation
- Follow existing code patterns
- Write unit tests for new functionality
- Document complex logic with comments

## Commit Guidelines

- Use clear, descriptive commit messages
- Reference issues in commit messages (`Fix #123`)
- Keep commits atomic and focused

Example:
```
Add MCP server registration endpoint

- Add /trpc/tools/registerMcpServer mutation
- Validate transport type and endpoint format
- Add integration tests

Closes #456
