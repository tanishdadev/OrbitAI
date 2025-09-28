'use client'

import { useState } from 'react'

export default function CommandPrompt({ onSubmit, isProcessing, darkMode }) {
  const [command, setCommand] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (command.trim() && !isProcessing) {
      onSubmit(command)
      setCommand('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Type your message here... (e.g., 'Send email to john@example.com', 'Schedule meeting tomorrow')"
            className={`w-full p-4 pr-12 border-0 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
              darkMode 
                ? 'bg-gray-700 text-gray-100 placeholder-gray-400 focus:bg-gray-600' 
                : 'bg-gray-50 text-gray-900 placeholder-gray-500 focus:bg-white'
            }`}
            rows={1}
            disabled={isProcessing}
            style={{ minHeight: '52px', maxHeight: '120px' }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          
          <button
            type="submit"
            disabled={!command.trim() || isProcessing}
            className={`absolute right-3 bottom-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
              !command.trim() || isProcessing
                ? darkMode
                  ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
            }`}
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      <div className={`flex items-center justify-between mt-2 text-xs ${
        darkMode ? 'text-gray-400' : 'text-gray-500'
      }`}>
        <span>Press Enter to send, Shift+Enter for new line</span>
        {isProcessing && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            Processing...
          </span>
        )}
      </div>
    </form>
  )
}