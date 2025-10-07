# Cupid AI

A Tinder-style dating app for AI characters. Swipe on character cards, match with your favorites, and have conversations powered by AI.

## Features

- **Character Cards**: Import PNG character cards (v2 spec) with full personality data
- **Swipe Interface**: Tinder-style swiping with like/pass actions
- **AI Conversations**: Chat with matched characters using OpenRouter API
- **Dating Profiles**: AI-generated dating profiles for each character
- **Multi-Message System**: Progressive message display with typing indicators
- **Context Management**: Token-based conversation history trimming
- **Message Controls**: Edit, delete, and regenerate AI responses
- **User Settings**: Customizable LLM parameters per user

## Tech Stack

**Frontend:**
- React + Vite
- Tailwind CSS
- IndexedDB for client-side storage
- React Router

**Backend:**
- Node.js + Express
- SQLite (better-sqlite3)
- JWT authentication
- OpenRouter API integration

## Setup

### Prerequisites
- Node.js 18+
- OpenRouter API key

### Installation

1. Clone the repository
2. Install dependencies:
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Configure environment variables:

Create `backend/.env`:
```env
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-random-secret-here
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

4. Start the servers:
```bash
# Backend (from backend/)
npm start

# Frontend (from frontend/)
npm run dev
```

5. Open http://localhost:5173 in your browser

## Usage

1. **Register/Login**: Create an account or log in
2. **Import Characters**: Upload PNG character cards in the Library
3. **Swipe**: Browse characters on the home page, swipe right to like
4. **Chat**: Click on matches in the sidebar to start conversations
5. **Settings**: Customize LLM model, temperature, context window, etc.

## Project Structure

```
cupid-ai/
├── backend/
│   ├── src/
│   │   ├── db/         # Database and migrations
│   │   ├── middleware/ # Auth middleware
│   │   ├── routes/     # API endpoints
│   │   └── services/   # AI service, business logic
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── context/    # Auth context
│   │   ├── pages/      # Page components
│   │   └── services/   # API and storage services
│   └── package.json
├── CLAUDE.md           # Technical documentation
└── PLAN.md            # Feature planning

```

## License

MIT
