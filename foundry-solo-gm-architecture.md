# Foundry VTT Solo GM Tool - Architecture Plan

## Project Overview
A Foundry VTT V13 module that acts as an AI-powered solo GM tool, allowing players to interact with OpenAI's API for dynamic storytelling, scene descriptions, and campaign management.

## Technical Stack
- **Platform**: Foundry VTT V13 Module
- **Build Tool**: Vite + TypeScript
- **AI Integration**: OpenAI API (user-provided keys)
- **UI Framework**: Foundry V13 ApplicationV2 + ThemeV2
- **Data Storage**: Foundry's native document system (Journal Entries, Chat Messages, etc.)

## Core Features (Phased Development)

### Phase 1: Basic Chat Interface
- New chat button in Foundry's right sidebar
- ApplicationV2 dialog with chat interface
- OpenAI API integration for GM responses
- Messages visible to all players (with optional privacy setting)
- API key storage in module settings

### Phase 2: Context & Memory
- Session recap system (AI-generated journal entries at session end)
- Integration with existing Foundry journal entries
- "Recap button" for GMs to generate session summaries
- Context loading from current scene/tokens when starting new session

### Phase 3: Document Integration
- Text highlighting in journal entries with AI context queries
- Search through existing journal entries for relevant information
- AI-powered journal entry generation based on session events

### Phase 4: Advanced Features (Stretch Goals)
- Semantic search through campaign documents
- NPC generation as Foundry Actor documents
- Scene generation (text-based, eventually visual maps)

## Data Flow Architecture

### Chat Session Flow
1. **Session Start**: Load context from recent recap + current scene
2. **During Play**: 
   - Player messages → OpenAI API → AI responses
   - All messages stored as Foundry ChatMessage documents
   - AI can reference recent dice rolls and game state
3. **Session End**: AI generates recap and saves as Journal Entry

### Context Management
- **Short-term**: Recent chat history (current session)
- **Long-term**: Session recaps stored as Journal Entries
- **Game State**: Current scene, active tokens, recent dice rolls
- **Documents**: Existing journal entries searchable by AI

## Technical Implementation Details

### Module Structure
```
/module-root
├── module.json (V13 manifest)
├── src/
│   ├── main.ts (entry point)
│   ├── chat/
│   │   ├── ChatApplication.ts (ApplicationV2 dialog)
│   │   └── OpenAIService.ts (API integration)
│   ├── context/
│   │   ├── ContextManager.ts (session/recap handling)
│   │   └── DocumentSearch.ts (journal integration)
│   └── ui/
│       ├── sidebar.ts (chat button integration)
│       └── templates/ (Handlebars templates)
├── styles/ (V13 ThemeV2 CSS)
└── dist/ (Vite build output)
```

### Key Foundry V13 Integration Points
- **ApplicationV2**: Modern dialog system for chat interface
- **ChatMessage**: Native message storage and display
- **JournalEntry**: Session recaps and AI-generated content
- **game.settings**: API key and module configuration storage
- **Sidebar**: Integration point for chat button

## User Experience Flow
1. GM clicks chat button in sidebar → Opens AI chat dialog
2. GM types message → Sent to OpenAI → Response appears in chat
3. All players see AI responses in main chat (unless whispered)
4. At session end, GM clicks "Generate Recap" → AI creates summary Journal Entry
5. Next session automatically loads with recap context
6. GM can highlight journal text and ask AI for clarification/expansion

## Development Priority
**Phase 1 Focus**: Get basic chat working with OpenAI integration and Foundry V13 compatibility. Everything else is iterative improvement from there.

## Notes
- Personal use priority (polished public release is secondary)
- Heavy operations (like vector search) acceptable for personal use
- Module should work with existing Foundry data structures where possible
- TypeScript for better DX, familiar to React developer background