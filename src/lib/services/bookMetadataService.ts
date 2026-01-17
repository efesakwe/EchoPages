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
          if (itemAuthors.some((a: string) => a.includes(authorLower) || authorLower.includes(a))) {
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

// Try Open Library for cover image
async function fetchCoverFromOpenLibrary(title: string, author?: string, isbn?: string): Promise<string | undefined> {
  try {
    let searchUrl = ''
    
    if (isbn) {
      // Try ISBN first (most reliable)
      searchUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    } else if (title && author) {
      // Try title + author
      const query = encodeURIComponent(`${title} ${author}`)
      searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`
    }
    
    if (!searchUrl) return undefined
    
    console.log('Searching Open Library for cover:', searchUrl)
    const response = await fetch(searchUrl)
    const data = await response.json()
    
    // Open Library API format varies
    if (isbn && data[`ISBN:${isbn}`]?.cover?.large) {
      return data[`ISBN:${isbn}`].cover.large
    }
    if (isbn && data[`ISBN:${isbn}`]?.cover?.medium) {
      return data[`ISBN:${isbn}`].cover.medium
    }
    
    // For search results
    if (data.docs && data.docs.length > 0) {
      const coverId = data.docs[0].cover_i
      if (coverId) {
        return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      }
    }
    
    return undefined
  } catch (error) {
    console.error('Open Library cover search error:', error)
    return undefined
  }
}

// Try bookcover.longitood.com API
async function fetchCoverFromLongitood(title: string, author?: string): Promise<string | undefined> {
  try {
    const query = author ? `${title} ${author}` : title
    const url = `https://bookcover.longitood.com/bookcover?book_title=${encodeURIComponent(query)}`
    
    console.log('Searching Longitood for cover:', url)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.url || data.imageUrl || data.cover) {
        return data.url || data.imageUrl || data.cover
      }
    }
    
    return undefined
  } catch (error) {
    console.error('Longitood cover search error:', error)
    return undefined
  }
}

// Try multiple sources for cover image
async function findBookCover(
  title: string, 
  author?: string, 
  isbn?: string,
  googleBooksCover?: string
): Promise<string | undefined> {
  console.log('=== Searching for book cover across multiple sources ===')
  
  // 1. Try Google Books first (most reliable)
  if (googleBooksCover) {
    console.log('✅ Found cover from Google Books')
    return googleBooksCover
  }
  
  console.log('❌ No cover from Google Books, trying other sources...')
  
  // 2. Try Open Library
  const openLibraryCover = await fetchCoverFromOpenLibrary(title, author, isbn)
  if (openLibraryCover) {
    console.log('✅ Found cover from Open Library')
    return openLibraryCover
  }
  
  // 3. Try Longitood
  const longitoodCover = await fetchCoverFromLongitood(title, author)
  if (longitoodCover) {
    console.log('✅ Found cover from Longitood')
    return longitoodCover
  }
  
  // 4. Try Google Books again with different search (in case we got title/author wrong)
  if (author) {
    const retryGoogle = await fetchFromGoogleBooks(title, author)
    const retryCover = getCoverUrl(retryGoogle?.imageLinks)
    if (retryCover) {
      console.log('✅ Found cover from Google Books retry')
      return retryCover
    }
  }
  
  console.log('❌ No cover found from any source')
  return undefined
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
  
  // First, try Google Books for basic info and potential cover
  const googleData = await fetchFromGoogleBooks(title, providedAuthor)
  const googleBooksCover = getCoverUrl(googleData?.imageLinks)
  const isbn = getIsbn(googleData?.industryIdentifiers)
  
  console.log('Google Books data:', {
    found: !!googleData,
    title: googleData?.title,
    authors: googleData?.authors,
    hasDescription: !!googleData?.description,
    hasImageLinks: !!googleData?.imageLinks,
    hasCover: !!googleBooksCover,
    categories: googleData?.categories,
    isbn: isbn || 'NOT FOUND',
  })
  
  // Search multiple sources for cover image
  const coverImageUrl = await findBookCover(title, providedAuthor, isbn, googleBooksCover)
  
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
  
  // Use OpenAI to search the entire internet conceptually for comprehensive book information
  // OpenAI models have training data from across the internet, so they can provide comprehensive info
  try {
    console.log('Using AI to search for comprehensive book information across the internet...')
    const authorHint = providedAuthor ? `\nKnown author: ${providedAuthor}` : ''
    const googleDesc = googleData?.description ? `\n\nNote: Google Books has this description (may be incomplete): ${googleData.description.substring(0, 500)}` : ''
    const googleCategory = googleData?.categories?.length ? `\n\nNote: Google Books suggests these categories: ${googleData.categories.join(', ')}` : ''
    
    const prompt = `You are an expert book researcher with access to information from across the entire internet - including book review sites, publisher websites, library catalogs, Goodreads, Amazon, Wikipedia, literary databases, and all other online sources.

Your task: Research and provide COMPREHENSIVE, DETAILED information about this book as if you've searched the entire internet:

Book to research:
- Title: ${title}${authorHint}${googleDesc}${googleCategory}
${extractedText ? `\n\nActual text excerpt from the book (first 2000 chars):\n${extractedText.substring(0, 2000)}` : ''}

Based on your research across all internet sources, you MUST provide ALL of the following in JSON format:

- title: The full, official title of the book
- author: The author's full name${providedAuthor ? ` (must be exactly: ${providedAuthor})` : ''}
- publishedDate: Publication date in YYYY-MM-DD format (or YYYY-MM-DD if only year is known, or just YYYY)
- summary: A COMPREHENSIVE, DETAILED 3-5 paragraph synopsis/description. This should be engaging, informative, and capture the essence of the story. Include plot points, themes, and what makes this book notable. Do NOT just copy the Google Books description - provide your own comprehensive summary based on your research.
- publisher: The publisher name (include imprint if relevant)
- category: The PRIMARY genre/category. Be specific. Examples: "Mystery", "Romance", "Christian Fiction", "Science Fiction", "Historical Fiction", "Thriller", "Horror", "Literary Fiction", "Young Adult", "Biography", "Non-Fiction", etc.
- isbn: ISBN-13 if known (preferred) or ISBN-10
- language: Language (default: English)
- series: Series name and number if part of a series (e.g., "Kaely Quinn Profiler, Book 2" or "Harry Potter, Book 1")

CRITICAL REQUIREMENTS:
1. The summary MUST be comprehensive, detailed, and engaging (minimum 3 paragraphs, 200+ words)
2. Research across multiple sources - don't rely solely on Google Books description
3. Provide accurate category/genre based on the actual content
4. Include publisher information if available
5. If this is part of a series, include the series name and book number

Return ONLY valid JSON, no markdown code blocks or extra text.`

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert book researcher with knowledge from across the entire internet. You can access information from book review sites, publisher websites, library catalogs, Goodreads, Amazon, Wikipedia, literary databases, and all online sources. You MUST always provide comprehensive, detailed summaries (3-5 paragraphs minimum), accurate categories, and all other metadata fields. Research thoroughly and provide information as if you\'ve searched the entire internet. Return ONLY valid JSON without markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const resultText = response.choices[0]?.message?.content || '{}'
    console.log('OpenAI raw response length:', resultText.length)
    
    let result
    try {
      result = JSON.parse(resultText)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', resultText.substring(0, 500))
      throw new Error('Invalid JSON from OpenAI')
    }
    
    console.log('OpenAI enhanced metadata:', { 
      title: result.title,
      author: result.author,
      hasSummary: !!result.summary,
      summaryLength: result.summary?.length || 0,
      category: result.category,
      publisher: result.publisher,
      series: result.series,
    })

    // Merge OpenAI results with Google Books data (prefer Google for cover)
    metadata = {
      title: result.title || metadata.title || title,
      author: providedAuthor || result.author || metadata.author || 'Unknown Author',
      publishedDate: parsePublishedDate(result.publishedDate) || metadata.publishedDate,
      summary: result.summary || metadata.summary || googleData?.description || 'No description available.',
      publisher: result.publisher || metadata.publisher || googleData?.publisher,
      category: result.category || metadata.category || googleData?.categories?.[0] || 'Fiction',
      coverImageUrl: coverImageUrl, // Use cover from any source we found
      isbn: metadata.isbn || result.isbn,
      language: result.language || metadata.language || 'English',
      series: result.series || metadata.series,
    }
    
    // Ensure we have a summary
    if (!metadata.summary || metadata.summary.trim().length < 50) {
      console.warn('⚠️ Summary is too short or missing, creating fallback')
      metadata.summary = `${metadata.title} by ${metadata.author}. ${metadata.category} novel.`
    }
  } catch (openaiError: any) {
    console.error('OpenAI enhancement failed:', openaiError.message)
    console.error('Error details:', openaiError)
    // Ensure we have at least a basic summary even if OpenAI fails
    if (!metadata.summary || metadata.summary.trim().length < 10) {
      metadata.summary = `${metadata.title}${metadata.author !== 'Unknown Author' ? ` by ${metadata.author}` : ''}. ${metadata.category} novel.`
    }
  }
  
  // If still no cover, try one final search with enhanced metadata from OpenAI
  if (!metadata.coverImageUrl && metadata.author && metadata.author !== 'Unknown Author') {
    console.log('Final retry: Searching for cover with enhanced author info:', metadata.author)
    const finalCover = await findBookCover(title, metadata.author, metadata.isbn)
    if (finalCover) {
      metadata.coverImageUrl = finalCover
      console.log('✅ Found cover in final retry!')
    }
  }
  
  console.log('=== Final metadata being returned:', {
    title: metadata.title,
    author: metadata.author,
    summary: metadata.summary ? `${metadata.summary.substring(0, 100)}...` : 'MISSING',
    summaryLength: metadata.summary?.length || 0,
    category: metadata.category || 'MISSING',
    publisher: metadata.publisher || 'MISSING',
    publishedDate: metadata.publishedDate || 'MISSING',
    hasCover: !!metadata.coverImageUrl,
    coverUrl: metadata.coverImageUrl || 'MISSING',
    isbn: metadata.isbn || 'MISSING',
    series: metadata.series || 'MISSING',
  })

  // Final validation - ensure critical fields are present
  if (!metadata.summary || metadata.summary.trim().length < 20) {
    console.error('❌ SUMMARY IS TOO SHORT OR MISSING!')
    metadata.summary = `${metadata.title} by ${metadata.author}. ${metadata.category || 'Fiction'} novel.`
  }
  
  if (!metadata.category) {
    console.error('❌ CATEGORY IS MISSING!')
    metadata.category = 'Fiction'
  }

  return metadata
}
