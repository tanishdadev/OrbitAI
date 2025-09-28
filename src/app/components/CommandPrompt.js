'use client'

import { useState } from 'react'

export default function CommandPrompt({ onSubmit, isProcessing }) {
  const [command, setCommand] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (command.trim() && !isProcessing) {
      onSubmit(command)
      setCommand('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl">
      <div className="flex gap-2">
        <textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Type a command (e.g., 'Schedule a meeting', 'Draft an email to john@example.com about project update')"
          className="flex-1 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          disabled={isProcessing}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
        <button
          type="submit"
          disabled={isProcessing}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            isProcessing 
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg transform hover:scale-105'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Send'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  )
}