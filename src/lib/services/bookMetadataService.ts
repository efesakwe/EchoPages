import OpenAI from 'openai'

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey })
}

interface BookMetadata {
  title: string
  author: string
  publishedDate?: string
  summary: string
  publisher?: string
  category?: string
  coverImageUrl?: string
  isbn?: string
  language?: string
  series?: string
}

export async function fetchBookMetadata(
  title: string, 
  extractedText?: string,
  providedAuthor?: string
): Promise<BookMetadata> {
  try {
    // First, try to get the cover from Google Books using title + provided author
    // This is the most reliable way to get the correct cover
    let coverImageUrl: string | undefined
    const searchAuthor = providedAuthor || ''
    
    console.log('Searching Google Books for:', title, 'by', searchAuthor)
    
    try {
      // Build a precise search query
      const searchQuery = providedAuthor 
        ? `intitle:${title} inauthor:${providedAuthor}`
        : title
      
      const googleBooksResponse = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=5`
      )
      const googleBooksData = await googleBooksResponse.json()
      
      console.log('Google Books results:', googleBooksData.totalItems || 0)
      
      if (googleBooksData.items && googleBooksData.items.length > 0) {
        // Find the best match - prefer one with the exact author if provided
        let bestMatch = googleBooksData.items[0]
        
        if (providedAuthor) {
          const authorLower = providedAuthor.toLowerCase()
          for (const item of googleBooksData.items) {
            const authors = item.volumeInfo?.authors || []
            if (authors.some((a: string) => a.toLowerCase().includes(authorLower) || authorLower.includes(a.toLowerCase()))) {
              bestMatch = item
              break
            }
          }
        }
        
        // Get the highest resolution cover available
        const imageLinks = bestMatch.volumeInfo?.imageLinks
        if (imageLinks) {
          // Prefer extraLarge > large > medium > small > thumbnail
          coverImageUrl = imageLinks.extraLarge || 
                         imageLinks.large || 
                         imageLinks.medium || 
                         imageLinks.small || 
                         imageLinks.thumbnail
          
          if (coverImageUrl) {
            // Convert to HTTPS and get higher resolution
            coverImageUrl = coverImageUrl
              .replace('http://', 'https://')
              .replace('&zoom=1', '&zoom=0')
              .replace('&edge=curl', '') // Remove curl effect
            
            console.log('Found cover URL:', coverImageUrl)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch cover from Google Books:', error)
    }

    // Use OpenAI to get detailed metadata
    const authorHint = providedAuthor ? `\nKnown author: ${providedAuthor}` : ''
    const prompt = `You are a book metadata expert. Given a book title${extractedText ? ' and some extracted text from the book' : ''}${providedAuthor ? ' and the known author' : ''}, provide detailed information about the book.

Title: ${title}${authorHint}
${extractedText ? `\nExtracted text (first 2000 chars):\n${extractedText.substring(0, 2000)}` : ''}

Please provide a JSON object with the following fields:
- title: The full title of the book
- author: The author's full name (use the known author if provided)
- publishedDate: Publication date in YYYY-MM-DD format (or best estimate)
- summary: A detailed synopsis/description (2-4 paragraphs, make it engaging)
- publisher: The publisher name
- category: Primary genre/category (e.g., "Literature & Fiction", "Mystery", "Romance", "Science Fiction", "Historical Fiction", "Christian Fiction")
- isbn: ISBN if known (optional)
- language: Language (default: "English")
- series: Series name if part of a series (e.g., "Queen Esther's Court, Book 2")

Return ONLY valid JSON, no markdown formatting.`

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts book metadata and returns it as JSON. Always return valid JSON. If the author is provided, use that exact name.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')

    // If we still don't have a cover, try one more time with AI-determined author
    if (!coverImageUrl && result.author) {
      try {
        const retryQuery = `intitle:${title} inauthor:${result.author}`
        const retryResponse = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(retryQuery)}&maxResults=1`
        )
        const retryData = await retryResponse.json()
        
        if (retryData.items?.[0]?.volumeInfo?.imageLinks?.thumbnail) {
          coverImageUrl = retryData.items[0].volumeInfo.imageLinks.thumbnail
            .replace('http://', 'https://')
            .replace('&zoom=1', '&zoom=0')
        }
      } catch (error) {
        console.error('Failed to fetch cover on retry:', error)
      }
    }

    return {
      title: result.title || title,
      author: providedAuthor || result.author || 'Unknown Author',
      publishedDate: result.publishedDate || undefined,
      summary: result.summary || 'No description available.',
      publisher: result.publisher || undefined,
      category: result.category || 'Fiction',
      coverImageUrl: coverImageUrl || undefined,
      isbn: result.isbn || undefined,
      language: result.language || 'English',
      series: result.series || undefined,
    }
  } catch (error) {
    console.error('Failed to fetch book metadata:', error)
    // Return fallback metadata
    return {
      title,
      author: providedAuthor || 'Unknown Author',
      summary: 'No description available.',
      category: 'Fiction',
      language: 'English',
    }
  }
}
