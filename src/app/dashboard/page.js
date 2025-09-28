"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import CommandPrompt from "../components/CommandPrompt";
import { useRouter } from "next/navigation";

export default function Dashboard() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [responses, setResponses] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const messagesEndRef = useRef(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [responses]);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/");
		}
	}, [status, router]);

	if (status === "loading") {
		return (
			<div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
				<div className="flex flex-col items-center space-y-4">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
					<div className="text-lg font-medium text-gray-700">Loading...</div>
				</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	const handleCommand = async (command) => {
		setIsProcessing(true);
		
		// Add user message immediately
		const userMessage = {
			type: "user",
			text: command,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
		};
		
		setResponses((prev) => [...prev, userMessage]);

		try {
			const response = await fetch("/api/ai", {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${session.accessToken}`
				},
				body: JSON.stringify({ command }),
			});

			const data = await response.json();
			
			const assistantMessage = {
				type: "assistant",
				text: data.result || data.error || "I apologize, but I couldn't process your request.",
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				isError: !!data.error
			};

			setResponses((prev) => [...prev, assistantMessage]);
		} catch (error) {
			const errorMessage = {
				type: "assistant",
				text: `I encountered an error: ${error.message}. Please try again.`,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				isError: true
			};
			
			setResponses((prev) => [...prev, errorMessage]);
		} finally {
			setIsProcessing(false);
		}
	};

	const clearChat = () => {
		setResponses([]);
	};

	// Enhanced text formatting with proper markdown rendering
	const formatText = (text) => {
		if (!text) return []
		
		return text
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0)
			.map((line, index) => {
				// Convert **bold** to actual bold
				const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
				
				// Convert *italic* to actual italic
				const italicFormatted = boldFormatted.replace(/\*(.*?)\*/g, '<em>$1</em>')
				
				// Handle different types of content
				if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
					const cleanLine = line.substring(1).trim()
					const formatted = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
					return <li key={index} className="ml-4 mb-1" dangerouslySetInnerHTML={{ __html: formatted }}></li>
				}
				
				if (line.match(/^\d+\./)) {
					const cleanLine = line.replace(/^\d+\./, '').trim()
					const formatted = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
					return <li key={index} className="ml-4 list-decimal mb-1" dangerouslySetInnerHTML={{ __html: formatted }}></li>
				}
				
				if (line.includes(':') && line.length < 100) {
					const [label, ...rest] = line.split(':');
					if (rest.length > 0) {
						const formattedLabel = label.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
						const formattedRest = rest.join(':').trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
						return (
							<p key={index} className="font-medium mb-2">
								<span className="text-blue-600" dangerouslySetInnerHTML={{ __html: formattedLabel }}></span>: 
								<span dangerouslySetInnerHTML={{ __html: ` ${formattedRest}` }}></span>
							</p>
						)
					}
				}
				
				// Regular paragraph with markdown support
				const formatted = italicFormatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
				return <p key={index} className="leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: formatted }}></p>
			});
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
			{/* Modern Header */}
			<header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-10">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex justify-between items-center">
						<div className="flex items-center space-x-3">
							<div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
								<span className="text-white font-bold text-sm">AI</span>
							</div>
							<h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
								AI Assistant
							</h1>
						</div>
						
						<div className="flex items-center gap-4">
							{responses.length > 0 && (
								<button
									onClick={clearChat}
									className="text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
								>
									Clear Chat
								</button>
							)}
							<div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
								{session.user?.image && (
									<img
										src={session.user.image}
										alt="Profile"
										className="w-7 h-7 rounded-full ring-2 ring-white"
									/>
								)}
								<span className="text-sm font-medium text-gray-700">
									{session.user?.name || session.user?.email}
								</span>
							</div>
							<button
								onClick={() => signOut()}
								className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-lg"
							>
								Sign Out
							</button>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Welcome Section - Only show when no messages */}
				{responses.length === 0 && (
					<div className="text-center mb-12">
						<div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6">
							<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
						</div>
						<h2 className="text-4xl font-bold text-gray-900 mb-3">
							Welcome back, {session.user?.name?.split(' ')[0] || 'User'}!
						</h2>
						<p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
							Your intelligent assistant is ready to help with emails, calendar scheduling, and more. Just type what you need!
						</p>
						
						{/* Feature Cards */}
						<div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
							<div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 hover:bg-white/80 transition-all duration-200">
								<div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
									<svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
									</svg>
								</div>
								<h3 className="font-semibold text-gray-900 mb-2">Email Management</h3>
								<p className="text-sm text-gray-600">Send emails and summarize your inbox</p>
							</div>
							
							<div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 hover:bg-white/80 transition-all duration-200">
								<div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
									<svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
									</svg>
								</div>
								<h3 className="font-semibold text-gray-900 mb-2">Calendar Scheduling</h3>
								<p className="text-sm text-gray-600">Create meetings with Google Meet links</p>
							</div>
							
							<div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 hover:bg-white/80 transition-all duration-200">
								<div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
									<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
									</svg>
								</div>
								<h3 className="font-semibold text-gray-900 mb-2">Smart Assistance</h3>
								<p className="text-sm text-gray-600">Get answers and helpful information</p>
							</div>
						</div>
					</div>
				)}

				{/* Chat Interface */}
				<div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/50 overflow-hidden">
					{/* Chat Messages */}
					<div className="h-96 overflow-y-auto p-6 space-y-4" style={{ scrollbarWidth: 'thin' }}>
						{responses.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-gray-500">
								<div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
									<svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
								</div>
								<p className="text-lg font-medium mb-2">Ready to assist you</p>
								<p className="text-sm text-center max-w-md">
									Try these commands:
								</p>
								<div className="mt-4 space-y-2 text-sm">
									<div className="bg-gray-50 rounded-lg px-3 py-2">
										"Send an email to john@example.com about the meeting"
									</div>
									<div className="bg-gray-50 rounded-lg px-3 py-2">
										"Schedule a team meeting tomorrow at 2 PM"
									</div>
									<div className="bg-gray-50 rounded-lg px-3 py-2">
										"Summarize my unread emails"
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-4">
								{responses.map((response, i) => (
									<div
										key={i}
										className={`flex ${
											response.type === "user" ? "justify-end" : "justify-start"
										}`}
									>
										<div
											className={`max-w-[80%] ${
												response.type === "user"
													? "bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-md"
													: response.isError
													? "bg-red-50 text-red-800 border border-red-200 rounded-2xl rounded-bl-md"
													: "bg-gray-50 text-gray-800 rounded-2xl rounded-bl-md"
											} px-4 py-3 shadow-sm`}
										>
											<div className="text-xs opacity-70 mb-1">
												{response.timestamp}
											</div>
											<div className="space-y-2">
												{response.type === "user" ? (
													<p className="whitespace-pre-wrap">{response.text}</p>
												) : (
													<div className="prose prose-sm max-w-none">
														{formatText(response.text)}
													</div>
												)}
											</div>
										</div>
									</div>
								))}
								{isProcessing && (
									<div className="flex justify-start">
										<div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
											<div className="flex items-center space-x-2">
												<div className="flex space-x-1">
													<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
													<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
													<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
												</div>
												<span className="text-sm text-gray-600">Thinking...</span>
											</div>
										</div>
									</div>
								)}
								<div ref={messagesEndRef} />
							</div>
						)}
					</div>

					{/* Command Input */}
					<div className="border-t border-gray-200/50 p-6 bg-white/50">
						<CommandPrompt
							onSubmit={handleCommand}
							isProcessing={isProcessing}
						/>
					</div>
				</div>

				{/* Quick Actions - ALWAYS VISIBLE */}
				<div className="mt-8 flex flex-wrap gap-3 justify-center">
					<button
						onClick={() => handleCommand("Summarize my unread emails")}
						disabled={isProcessing}
						className="bg-white/60 hover:bg-white/80 border border-white/50 text-gray-700 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-sm hover:shadow-md disabled:opacity-50"
					>
						📧 Check emails
					</button>
					<button
						onClick={() => handleCommand("Schedule a team meeting tomorrow")}
						disabled={isProcessing}
						className="bg-white/60 hover:bg-white/80 border border-white/50 text-gray-700 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-sm hover:shadow-md disabled:opacity-50"
					>
						📅 Schedule meeting
					</button>
					<button
						onClick={() => handleCommand("What's the weather like today?")}
						disabled={isProcessing}
						className="bg-white/60 hover:bg-white/80 border border-white/50 text-gray-700 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-sm hover:shadow-md disabled:opacity-50"
					>
						🌤️ Weather
					</button>
					<button
						onClick={() => handleCommand("Send email to test@example.com about project update")}
						disabled={isProcessing}
						className="bg-white/60 hover:bg-white/80 border border-white/50 text-gray-700 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-sm hover:shadow-md disabled:opacity-50"
					>
						✉️ Send test email
					</button>
				</div>
			</main>
		</div>
	);
}