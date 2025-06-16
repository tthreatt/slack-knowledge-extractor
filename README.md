# Slack Knowledge Extractor

A tool to automatically extract, categorize, and surface organizational knowledge from Slack conversations, creating searchable documentation and insights.

## Features

- Extract knowledge from Slack conversations
- Categorize and organize information
- Create searchable documentation
- Transform ephemeral chat into persistent knowledge
- AI-powered content analysis and categorization
- Real-time knowledge extraction
- Searchable knowledge base

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Slack workspace with admin access
- Claude API key (optional for MVP)

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd slack-knowledge-extractor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Slack App:
   - Go to https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch"
   - Name it "Knowledge Extractor"
   - Select your workspace
   - Under "OAuth & Permissions", add these scopes:
     - `channels:history`
     - `groups:history`
     - `users:read`
   - Install the app to your workspace
   - Copy the "Bot User OAuth Token"

4. Create a `.env` file in the root directory:
   ```env
   # Slack API Configuration
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Claude API Configuration (Optional for MVP)
   CLAUDE_API_KEY=your-claude-api-key-here
   ```

## Development

To start the development server:
```bash
npm run dev
```

The server will start on http://localhost:3000

## Building for Production

To build the project:
```bash
npm run build
```

To start the production server:
```bash
npm start
```

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── routes/         # API routes
└── server.ts       # Main application file
```

## API Endpoints

### Knowledge Extraction
- `GET /api/channels` - List available Slack channels
- `POST /api/extract` - Extract knowledge from selected channels
  ```json
  {
    "channelIds": ["C1234567890"],
    "daysBack": 30
  }
  ```

### Knowledge Search
- `GET /api/search?q=query&category=type` - Search knowledge base
- `GET /api/stats` - Get extraction statistics
- `GET /api/knowledge` - Get all knowledge items

### System
- `GET /health` - Health check endpoint

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| SLACK_BOT_TOKEN | Slack Bot User OAuth Token | Yes |
| SLACK_SIGNING_SECRET | Slack App Signing Secret | Yes |
| PORT | Server port | No (default: 3000) |
| NODE_ENV | Environment (development/production) | No |
| CLAUDE_API_KEY | Claude API key for AI processing | No |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License. 