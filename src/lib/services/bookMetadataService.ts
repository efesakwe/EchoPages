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

interface GoogleBooksResult {
  title?: string
  authors?: string[]
  description?: string
  publishedDate?: string
  publisher?: string
  categories?: string[]
  imageLinks?: {
    extraLarge?: string
    large?: string
    medium?: string
    small?: string
    thumbnail?: string
    smallThumbnail?: string
  }
  industryIdentifiers?: Array<{ type: string; identifier: string }>
}

async function fetchFromGoogleBooks(title: string, author?: string): Promise<GoogleBooksResult | null> {
  // Try multiple search strategies to find the book
  const searchQueries: string[] = []
  
  if (author && title) {
    // Strategy 1: Exact title and author match
    searchQueries.push(`intitle:"${title}" inauthor:"${author}"`)
    // Strategy 2: Title and author without quotes
    searchQueries.push(`intitle:${title} inauthor:${author}`)
    // Strategy 3: Just title and author as keywords
    searchQueries.push(`${title} ${author}`)
  }
  
  if (title) {
    // Strategy 4: Just the title
    searchQueries.push(`intitle:"${title}"`)
    searchQueries.push(title)
  }
  
  console.log('Trying Google Books searches:', searchQueries)
  
  for (const searchQuery of searchQueries) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=10`
      )
      const data = await response.json()
      
      console.log(`Search "${searchQuery}" returned ${data.totalItems || 0} results`)
      
      if (!data.items || data.items.length === 0) {
        continue
      }
      
      // Find the best match
      let bestMatch = data.items[0]
      let bestScore = 0
      
      if (author) {
        const authorLower = author.toLowerCase().trim()
        const titleLower = title.toLowerCase().trim()
        
        for (const item of data.items) {
          const itemTitle = (item.volumeInfo?.title || '').toLowerCase()
          const itemAuthors = (item.volumeInfo?.authors || []).map((a: string) => a.toLowerCase())
          
          // Score based on title and author match
          let score = 0
          if (itemTitle.includes(titleLower) || titleLower.includes(itemTitle)) {
            score += 10
          }
          if (itemAuthors.some(a => a.includes(authorLower) || authorLower.includes(a))) {
            score += 10
          }
          // Bonus if it has an image
          if (item.volumeInfo?.imageLinks) {
            score += 5
          }
          
          if (score > bestScore) {
            bestMatch = item
            bestScore = score
          }
        }
      }
      
      // If we found a match with image, return it
      if (bestMatch?.volumeInfo) {
        console.log('Found match:', {
          title: bestMatch.volumeInfo.title,
          authors: bestMatch.volumeInfo.authors,
          hasImage: !!bestMatch.volumeInfo.imageLinks,
        })
        return bestMatch.volumeInfo
      }
    } catch (error) {
      console.error(`Google Books API error for query "${searchQuery}":`, error)
      continue
    }
  }
  
  console.log('No book found in Google Books after trying all queries')
  return null
}

function getCoverUrl(imageLinks?: GoogleBooksResult['imageLinks']): string | undefined {
  if (!imageLinks) {
    console.log('No imageLinks provided')
    return undefined
  }
  
  console.log('Available image links:', Object.keys(imageLinks))
  
  // Prefer higher resolution
  let url = imageLinks.extraLarge || 
            imageLinks.large || 
            imageLinks.medium || 
            imageLinks.small || 
            imageLinks.thumbnail ||
            imageLinks.smallThumbnail
  
  if (!url) {
    console.log('No URL found in imageLinks')
    return undefined
  }
  
  console.log('Original image URL:', url)
  
  // Convert to HTTPS
  url = url.replace('http://', 'https://')
  
  // For Google Books images, we can get higher resolution by manipulating the zoom parameter
  // Remove zoom=1 or zoom=5 and set to zoom=0 for best quality
  url = url.replace(/&zoom=\d+/, '&zoom=0')
  
  // Remove curl edge effect
  url = url.replace('&edge=curl', '')
  
  // If it's a thumbnail, try to get a larger version
  if (url.includes('zoom=5')) {
    url = url.replace('zoom=5', 'zoom=0')
  }
  
  console.log('Processed image URL:', url)
  
  return url
}

function getIsbn(identifiers?: Array<{ type: string; identifier: string }>): string | undefined {
  if (!identifiers) return undefined
  const isbn13 = identifiers.find(i => i.type === 'ISBN_13')
  const isbn10 = identifiers.find(i => i.type === 'ISBN_10')
  return isbn13?.identifier || isbn10?.identifier
}

function parsePublishedDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined
  
  // If it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  
  // If it's just a year (YYYY)
  if (/^\d{4}$/.test(dateStr)) {
    return `${dateStr}-01-01`
  }
  
  // If it's YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return `${dateStr}-01`
  }
  
  // Try to parse other formats
  try {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return undefined
}

export async function fetchBookMetadata(
  title: string, 
  extractedText?: string,
  providedAuthor?: string
): Promise<BookMetadata> {
  console.log('=== Starting metadata fetch for:', title, 'by', providedAuthor || 'unknown')
  
  // First, always try Google Books for cover and basic info
  const googleData = await fetchFromGoogleBooks(title, providedAuthor)
  
  const coverImageUrl = getCoverUrl(googleData?.imageLinks)
  const isbn = getIsbn(googleData?.industryIdentifiers)
  
  console.log('Google Books data:', {
    found: !!googleData,
    title: googleData?.title,
    authors: googleData?.authors,
    hasDescription: !!googleData?.description,
    hasImageLinks: !!googleData?.imageLinks,
    coverImageUrl: coverImageUrl || 'NOT FOUND',
    categories: googleData?.categories,
  })
  
  if (!coverImageUrl && googleData?.imageLinks) {
    console.error('⚠️ Image links exist but coverImageUrl is null!', JSON.stringify(googleData.imageLinks, null, 2))
  }
  
  // Build base metadata from Google Books
  let metadata: BookMetadata = {
    title: googleData?.title || title,
    author: providedAuthor || googleData?.authors?.[0] || 'Unknown Author',
    publishedDate: parsePublishedDate(googleData?.publishedDate),
    summary: googleData?.description || '',
    publisher: googleData?.publisher,
    category: googleData?.categories?.[0] || 'Fiction',
    coverImageUrl,
    isbn,
    language: 'English',
    series: undefined,
  }
  
  // Try to enhance with OpenAI for better summary and series detection
  try {
    const authorHint = providedAuthor ? `\nKnown author: ${providedAuthor}` : ''
    const prompt = `You are a book metadata expert. Given a book title${extractedText ? ' and some extracted text from the book' : ''}${providedAuthor ? ' and the known author' : ''}, provide detailed information about the book.

Title: ${title}${authorHint}
${extractedText ? `\nExtracted text (first 2000 chars):\n${extractedText.substring(0, 2000)}` : ''}
${googleData?.description ? `\nExisting description: ${googleData.description}` : ''}

Please provide a JSON object with the following fields:
- title: The full title of the book
- author: The author's full name (use the known author if provided)
- publishedDate: Publication date in YYYY-MM-DD format (or best estimate)
- summary: A detailed synopsis/description (2-4 paragraphs, make it engaging). If an existing description is provided, enhance it.
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
    console.log('OpenAI enhanced metadata:', { 
      hasEnhancedSummary: !!result.summary,
      series: result.series,
      category: result.category 
    })

    // Merge OpenAI results with Google Books data (prefer Google for cover)
    metadata = {
      title: result.title || metadata.title,
      author: providedAuthor || result.author || metadata.author,
      publishedDate: parsePublishedDate(result.publishedDate) || metadata.publishedDate,
      summary: result.summary || metadata.summary || 'No description available.',
      publisher: result.publisher || metadata.publisher,
      category: result.category || metadata.category,
      coverImageUrl: coverImageUrl, // Always use Google Books cover
      isbn: metadata.isbn || result.isbn,
      language: result.language || 'English',
      series: result.series,
    }
  } catch (openaiError: any) {
    console.error('OpenAI enhancement failed:', openaiError.message)
    // Continue with Google Books data only
  }
  
  // If still no cover, try one more search with the metadata we have
  if (!metadata.coverImageUrl && metadata.author && metadata.author !== 'Unknown Author') {
    console.log('Retrying cover search with author:', metadata.author)
    const retryData = await fetchFromGoogleBooks(title, metadata.author)
    if (retryData?.imageLinks) {
      metadata.coverImageUrl = getCoverUrl(retryData.imageLinks)
    }
  }
  
  console.log('=== Final metadata:', {
    title: metadata.title,
    author: metadata.author,
    hasSummary: !!metadata.summary && metadata.summary !== 'No description available.',
    hasCover: !!metadata.coverImageUrl,
    category: metadata.category,
  })

  return metadata
}
