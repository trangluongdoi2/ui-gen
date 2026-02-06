# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. It allows users to describe React components they want to create, and uses Claude AI (or a mock provider when no API key is configured) to generate the components in real-time with instant preview capabilities.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Prisma with SQLite
- **AI**: Anthropic Claude API via Vercel AI SDK
- **Testing**: Vitest with React Testing Library
- **Code Editor**: Monaco Editor

## Development Commands

### Setup
```bash
npm run setup              # Install dependencies, generate Prisma client, run migrations
```

### Development
```bash
npm run dev                # Start dev server with Turbopack (http://localhost:3000)
npm run dev:daemon         # Start dev server in background, logs to logs.txt
```

### Build & Deploy
```bash
npm run build             # Production build
npm start                 # Start production server
```

### Testing
```bash
npm test                  # Run all tests with Vitest
npm run lint              # Run ESLint
```

### Database
```bash
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma migrate dev    # Create and apply new migration
npm run db:reset          # Reset database (WARNING: deletes all data)
npx prisma studio         # Open Prisma Studio for database inspection
```

## Architecture Overview

### Virtual File System (VFS)

The core architecture centers around a **VirtualFileSystem** (`src/lib/file-system.ts`) that maintains an in-memory representation of project files. This is critical to understand:

- Files exist **only in memory** during editing - nothing is written to disk
- The VFS uses a tree structure with `FileNode` objects (files and directories)
- Each node tracks its type, name, path, content, and children
- Serialization/deserialization enables persistence to the database as JSON
- The VFS is shared with the AI via tools, allowing it to create/edit files

**Key Methods:**
- `createFile()`, `updateFile()`, `deleteFile()` - Basic file operations
- `serialize()` / `deserialize()` - Convert to/from JSON for database storage
- `viewFile()`, `replaceInFile()`, `insertInFile()` - Editor-style operations

### AI Tool Integration

The AI interacts with the VFS through two main tools (`src/lib/tools/`):

1. **str_replace_editor** (`str-replace.ts`): Text editing operations
   - `view`: View file contents with line numbers
   - `create`: Create new files
   - `str_replace`: Find and replace text in files
   - `insert`: Insert text at specific line numbers

2. **file_manager** (`file-manager.ts`): File system operations
   - `rename`: Rename or move files/folders
   - `delete`: Delete files or folders

These tools are bound to a VirtualFileSystem instance in `/api/chat/route.ts` and passed to the AI SDK's `streamText()` function.

### Live Preview System

The preview system (`src/lib/transform/jsx-transformer.ts`) performs real-time JSX/TSX transpilation:

1. **Transform Pipeline:**
   - Babel transforms JSX/TSX to plain JavaScript
   - CSS imports are extracted and collected
   - Import paths are resolved (supports `@/` alias for root)
   - Missing imports generate placeholder modules

2. **Import Map Generation:**
   - Creates an ES Module import map for the browser
   - Maps local files to blob URLs
   - Maps third-party packages to esm.sh CDN
   - Handles path aliases (`@/` → `/`)

3. **Preview HTML:**
   - Generates a complete HTML document with import maps
   - Includes Tailwind CSS via CDN
   - Embeds error boundaries for runtime errors
   - Shows syntax errors with formatted display

### Data Flow

```
User Message
  → /api/chat/route.ts (POST)
  → streamText() with VFS-bound tools
  → AI makes tool calls to modify VFS
  → VFS state serialized to database (on completion)
  → Client receives streaming response
  → UI updates with new files
  → JSX transformer creates preview HTML
  → Preview iframe renders live component
```

### Database Schema

The database schema is defined in `prisma/schema.prisma`. Reference it anytime you need to understand the structure of data stored in the database.

Two main models:

- **User**: Email/password authentication (bcrypt)
- **Project**: Belongs to User (or anonymous if userId is null)
  - `messages`: JSON-serialized chat history
  - `data`: JSON-serialized VFS state (all files)

Projects are persisted only for authenticated users. Anonymous users work with ephemeral VFS instances.

### Authentication

JWT-based authentication (`src/lib/auth.ts`):
- Uses `jose` library for JWT signing/verification
- Session stored in HTTP-only cookie
- Middleware (`src/middleware.ts`) protects project routes
- Anonymous mode supported for quick testing

### Context Providers

Two main React contexts manage application state:

1. **FileSystemContext** (`src/lib/contexts/file-system-context.tsx`):
   - Manages VFS instance on client
   - Syncs with server state
   - Triggers preview regeneration on file changes

2. **ChatContext** (`src/lib/contexts/chat-context.tsx`):
   - Manages chat messages
   - Handles streaming AI responses
   - Coordinates VFS updates from AI tool calls

### Component Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [projectId]/       # Dynamic project route
│   ├── api/chat/          # AI streaming endpoint
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Home page (project selection)
├── components/
│   ├── chat/              # Chat UI components
│   ├── editor/            # File tree & code editor
│   ├── preview/           # Live preview iframe
│   ├── auth/              # Authentication forms
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── file-system.ts     # VirtualFileSystem class
│   ├── transform/         # JSX transformation & preview
│   ├── tools/             # AI tool definitions
│   ├── contexts/          # React context providers
│   ├── auth.ts            # JWT authentication
│   ├── provider.ts        # AI model provider (Claude or Mock)
│   └── prisma.ts          # Prisma client singleton
└── actions/               # Server actions for CRUD
```

## Mock Provider

When `ANTHROPIC_API_KEY` is not set, the system uses a **MockLanguageModel** (`src/lib/provider.ts`) that:
- Simulates streaming responses with delays
- Generates predefined components (counter, form, card)
- Makes deterministic tool calls based on conversation state
- Useful for development without API costs

The mock provider is configured to use fewer steps (4 vs 40) to prevent repetitive responses.

## Key Development Patterns

### File Path Conventions
- All VFS paths start with `/` (absolute from virtual root)
- `@/` alias maps to root directory
- Extensions can be omitted in imports (resolved automatically)

### Testing
- Tests use Vitest with jsdom environment
- React Testing Library for component tests
- Tests located in `__tests__` directories alongside source

### AI Prompt Caching
The system prompt (`src/lib/prompts/generation.tsx`) uses Anthropic's prompt caching via:
```typescript
providerOptions: {
  anthropic: { cacheControl: { type: "ephemeral" } }
}
```
This reduces costs and latency for repeated conversations.

### Environment Variables
- `ANTHROPIC_API_KEY`: Claude API key (optional, falls back to mock)
- `JWT_SECRET`: JWT signing secret (auto-generated if not set)

## Code Style Guidelines

### Comments
Use comments sparingly. Only comment complex code where the logic isn't self-evident. Prefer clear variable names and simple logic over explanatory comments.

## Common Patterns

### Adding a New AI Tool
1. Create tool in `src/lib/tools/` with Zod schema
2. Bind to VFS instance in `/api/chat/route.ts`
3. Add to `tools` object in `streamText()` call

### Modifying File System Behavior
- Edit `VirtualFileSystem` class in `src/lib/file-system.ts`
- Update serialization if changing data structure
- Regenerate Prisma client if affecting persistence

### Extending Preview Capabilities
- Modify `transformJSX()` in `jsx-transformer.ts` for transform logic
- Update `createImportMap()` for import resolution rules
- Edit `createPreviewHTML()` for preview container customization
