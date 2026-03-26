# Athena

A document annotation tool with AI-powered summaries. Upload and manage documents, highlight text to add annotations and comments, link related passages across documents, and generate AI summaries via the Gemini API.

## Features

- Document search and management
- Text highlighting with inline annotations and comments
- Cross-document linking of related passages
- AI-generated document summaries (Gemini)
- Local SQLite database — no cloud backend needed

## Getting Started

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
   Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Express, SQLite (better-sqlite3)
- **AI:** Google Gemini API (`@google/genai`)
- **Build:** Vite, tsx
