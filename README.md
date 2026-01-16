# Echo Pages - Audiobook App MVP

An invite-only Audible-like web application for personal use. Upload PDF novels, automatically extract chapters, and generate high-quality audio narration using AI.

## Features

- **Invite-Only Authentication**: Email/password or magic link authentication with allowlist
- **PDF Upload & Processing**: Upload PDFs and automatically extract text
- **Chapter Detection**: Automatically detect and organize chapters from PDFs
- **AI Audio Generation**: 
  - Uses OpenAI GPT-4o-mini for text structuring (dialogue vs narration, emotion detection)
  - Uses ElevenLabs for high-quality TTS audio generation
  - Background job processing with progress tracking
- **Audio Player**: Full-featured player with:
  - Play/pause, seek, skip ±30 seconds
  - Next/previous chunk navigation
  - Playback speed control (0.75x - 2x)
  - Auto-resume from last playback position
  - Progress saving

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes + Server Actions
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth
- **Job Queue**: BullMQ + Redis
- **AI Services**: OpenAI (GPT-4o-mini), ElevenLabs TTS

## Setup

### Prerequisites

- Node.js 18+ 
- Redis (for job queue)
- Supabase account and project
- OpenAI API key
- ElevenLabs API key

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-only)
- `OPENAI_API_KEY`: OpenAI API key
- `ELEVENLABS_API_KEY`: ElevenLabs API key
- `REDIS_HOST`: Redis host (default: localhost)
- `REDIS_PORT`: Redis port (default: 6379)
- `REDIS_PASSWORD`: Redis password (optional)
- `NEXT_PUBLIC_APP_URL`: Your app URL (default: http://localhost:5000)

3. **Set up Supabase:**

   a. Create a new Supabase project
   
   b. Run the migration to create tables:
   ```bash
   # Using Supabase CLI (recommended)
   supabase db push
   
   # Or manually copy the contents of supabase/migrations/001_initial_schema.sql
   # and run it in the Supabase SQL editor
   ```

   c. Create a storage bucket named `books`:
   - Go to Storage in Supabase dashboard
   - Create bucket: `books`
   - Make it private (only authenticated users can access)

   d. Add RLS policies for storage (in SQL editor):
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Users can upload to books bucket"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'books');

   -- Allow users to read their own files
   CREATE POLICY "Users can read books bucket"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'books');
   ```

   e. Add emails to allowlist:
   ```sql
   INSERT INTO allowlist_emails (email) VALUES ('your-email@example.com');
   ```

4. **Start Redis:**

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or using Homebrew (macOS)
brew install redis
brew services start redis

# Or install and run Redis on your system
```

5. **Start the development server:**

```bash
npm run dev
```

6. **Start the background worker** (in a separate terminal):

```bash
npm run worker
```

The app will be available at `http://localhost:5000`.

## Usage

1. **Sign Up/Sign In**: Use an email that's in the allowlist
2. **Upload a Book**: Go to Library → Upload Book → Select PDF and enter title
3. **Extract Chapters**: On the book detail page, click "Extract Chapters"
4. **Generate Audio**: Open a chapter and click "Generate Audio"
5. **Listen**: Once generation completes, use the audio player to listen

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── book/              # Book detail & chapter pages
│   │   ├── library/           # Library listing
│   │   ├── login/             # Auth pages
│   │   └── upload/            # Upload page
│   ├── components/            # React components
│   │   └── AudioPlayer.tsx   # Main audio player
│   ├── lib/
│   │   ├── supabase/         # Supabase client configs
│   │   └── services/         # Business logic services
│   │       ├── pdfService.ts
│   │       ├── chapterService.ts
│   │       ├── llmService.ts
│   │       ├── ttsService.ts
│   │       ├── storageService.ts
│   │       └── playbackService.ts
│   └── worker/               # Background job worker
│       └── index.ts
├── supabase/
│   └── migrations/           # Database migrations
└── package.json
```

## Database Schema

- `allowlist_emails`: Invite list emails
- `books`: Book metadata
- `chapters`: Chapter information
- `audio_chunks`: Generated audio chunks per chapter
- `playback_state`: User playback positions

## Background Worker

The worker processes audio generation jobs asynchronously:

- Processes one chapter at a time
- Splits chapters into chunks using LLM
- Generates audio for each chunk via ElevenLabs
- Updates chunk status in database
- Retries failed chunks up to 3 times

## Development

- **Dev server**: `npm run dev`
- **Worker**: `npm run worker`
- **Build**: `npm run build`
- **Start production**: `npm start`

## Notes

- Audio generation can take time depending on chapter length
- ElevenLabs has rate limits - generation may queue
- PDF text extraction quality depends on PDF structure
- Chapter detection uses pattern matching - may need manual adjustment for some books

## License

Private project for personal use.
