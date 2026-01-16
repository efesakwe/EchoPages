'use client'

import { useState } from 'react'

interface ChapterPreviewButtonProps {
  chapterTitle: string
  chapterText: string
}

export function ChapterPreviewButton({ chapterTitle, chapterText }: ChapterPreviewButtonProps) {
  const [showPreview, setShowPreview] = useState(false)

  const startText = chapterText.substring(0, 500)
  const endText = chapterText.substring(chapterText.length - 500)
  const wordCount = chapterText.split(/\s+/).length
  const charCount = chapterText.length

  return (
    <>
      <button
        onClick={() => setShowPreview(true)}
        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        title="Preview extracted text"
      >
        Preview
      </button>

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-lilac-500 to-pink-400 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{chapterTitle}</h2>
                <p className="text-sm opacity-90">{wordCount.toLocaleString()} words • {charCount.toLocaleString()} characters</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Warning Banner */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Verify before generating audio</p>
                    <p className="text-xs text-yellow-700 mt-1">Check that the chapter starts and ends correctly. Audio generation uses credits!</p>
                  </div>
                </div>
              </div>

              {/* Start of Chapter */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-green-700 uppercase mb-2 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Beginning of Chapter
                </h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-serif leading-relaxed">
                    {startText}
                    {chapterText.length > 1000 && <span className="text-gray-400 italic">...</span>}
                  </pre>
                </div>
              </div>

              {/* Middle indicator */}
              {chapterText.length > 1000 && (
                <div className="flex items-center justify-center my-4">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <span className="px-4 text-sm text-gray-500">
                    ... {(wordCount - 200).toLocaleString()} words in between ...
                  </span>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>
              )}

              {/* End of Chapter */}
              <div>
                <h3 className="text-sm font-bold text-red-700 uppercase mb-2 flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  End of Chapter
                </h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-serif leading-relaxed">
                    {chapterText.length > 1000 && <span className="text-gray-400 italic">...</span>}
                    {endText}
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
              <p className="text-xs text-gray-500">
                If text is cut off or wrong, click "Re-extract Chapters"
              </p>
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-lilac-500 text-white rounded-lg hover:bg-lilac-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
