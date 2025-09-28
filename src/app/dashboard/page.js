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
	const [darkMode, setDarkMode] = useState(false);
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
		// Handle token refresh errors
		if (session?.error === "RefreshAccessTokenError") {
			console.log("Token refresh failed, forcing re-authentication");
			signOut({ callbackUrl: "/" });
		}
	}, [status, session, router]);

	// Load dark mode preference from localStorage
	useEffect(() => {
		const savedDarkMode = localStorage.getItem('darkMode') === 'true';
		setDarkMode(savedDarkMode);
	}, []);

	// Save dark mode preference and apply classes
	useEffect(() => {
		localStorage.setItem('darkMode', darkMode.toString());
		if (darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}, [darkMode]);

	const toggleDarkMode = () => {
		setDarkMode(!darkMode);
	};

	if (status === "loading") {
		return (
			<div className={`flex h-screen items-center justify-center ${
				darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'
			}`}>
				<div className="flex flex-col items-center space-y-4">
					<div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${
						darkMode ? 'border-blue-400' : 'border-blue-600'
					}`}></div>
					<div className={`text-lg font-medium ${
						darkMode ? 'text-gray-200' : 'text-gray-700'
					}`}>Loading...</div>
				</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	const handleCommand = async (command) => {
		setIsProcessing(true);
		
		const userMessage = {
			type: "user",
			text: command,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
		};
		
		setResponses((prev) => [...prev, userMessage]);

		try {
			// Check if we have a valid session and access token
			if (!session?.accessToken) {
				throw new Error("No access token available. Please sign out and sign back in.");
			}

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

	const formatText = (text) => {
		if (!text) return []
		
		return text
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0)
			.map((line, index) => {
				const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
				const italicFormatted = boldFormatted.replace(/\*(.*?)\*/g, '<em>$1</em>')
				
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
				
				if (line.includes(':') && line.length < 100 && !line.match(/\d{1,2}:\s*\d{2}/) && !line.includes('at ')) {
					const [label, ...rest] = line.split(':');
					if (rest.length > 0 && !label.match(/^\d+$/) && rest.join(':').trim().length > 0) {
						const formattedLabel = label.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
						const formattedRest = rest.join(':').trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
						return (
							<p key={index} className="font-medium mb-2">
								<span className={`${darkMode ? 'text-cyan-400' : 'text-[#1877F2]'}`} dangerouslySetInnerHTML={{ __html: formattedLabel }}></span>: 
								<span dangerouslySetInnerHTML={{ __html: ` ${formattedRest}` }}></span>
							</p>
						)
					}
				}
				
				const formatted = italicFormatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
				return <p key={index} className="leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: formatted }}></p>
			});
	};

	return (
		<div className={`min-h-screen ${
			darkMode 
				? 'bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900' 
				: 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'
		}`}>
			{/* Modern Header */}
			<header className={`backdrop-blur-lg border-b sticky top-0 z-10 ${
				darkMode 
					? 'bg-gray-800/80 border-gray-700/50' 
					: 'bg-white/80 border-gray-200/50'
			}`}>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex justify-between items-center">
						<div className="flex items-center space-x-3">
							<div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
								<span className="text-white font-bold text-sm">AI</span>
							</div>
							<h1 className={`text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${
								darkMode 
									? 'from-gray-100 to-gray-300' 
									: 'from-gray-900 to-gray-700'
							}`}>
								AI Assistant
							</h1>
						</div>
						
						<div className="flex items-center gap-4">
							{/* Dark Mode Toggle */}
							<button
								onClick={toggleDarkMode}
								className={`p-2 rounded-lg transition-all duration-200 ${
									darkMode 
										? 'bg-gray-700 hover:bg-gray-600 text-yellow-400 hover:text-yellow-300' 
										: 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700'
								}`}
								title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
							>
								{darkMode ? (
									// Sun icon for light mode
									<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
									</svg>
								) : (
									// Moon icon for dark mode
									<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
										<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
									</svg>
								)}
							</button>

							{responses.length > 0 && (
								<button
									onClick={clearChat}
									className={`text-sm font-medium transition-colors ${
										darkMode 
											? 'text-gray-400 hover:text-gray-200' 
											: 'text-gray-600 hover:text-gray-800'
									}`}
								>
									Clear Chat
								</button>
							)}
							<div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
								darkMode ? 'bg-gray-700' : 'bg-gray-50'
							}`}>
								{session.user?.image && (
									<img
										src={session.user.image}
										alt="Profile"
										className="w-7 h-7 rounded-full ring-2 ring-white"
									/>
								)}
								<span className={`text-sm font-medium ${
									darkMode ? 'text-gray-200' : 'text-gray-700'
								}`}>
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
						<h2 className={`text-4xl font-bold mb-3 ${
							darkMode ? 'text-gray-100' : 'text-gray-900'
						}`}>
							Welcome back, {session.user?.name?.split(' ')[0] || 'User'}!
						</h2>
						<p className={`text-lg mb-8 max-w-2xl mx-auto ${
							darkMode ? 'text-gray-300' : 'text-gray-600'
						}`}>
							Your intelligent assistant is ready to help with emails, calendar scheduling, and more. Just type what you need!
						</p>
						
						{/* Feature Cards */}
						<div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
							<div className={`backdrop-blur-sm rounded-2xl p-6 border transition-all duration-200 ${
								darkMode 
									? 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-800/80' 
									: 'bg-white/60 border-white/50 hover:bg-white/80'
							}`}>
								<div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto ${
									darkMode ? 'bg-cyan-900/50' : 'bg-blue-50'
								}`}>
									<svg className={`w-6 h-6 ${darkMode ? 'text-cyan-400' : 'text-[#1877F2]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
									</svg>
								</div>
								<h3 className={`font-semibold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Email Management</h3>
								<p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Send emails and summarize your inbox</p>
							</div>
							
							<div className={`backdrop-blur-sm rounded-2xl p-6 border transition-all duration-200 ${
								darkMode 
									? 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-800/80' 
									: 'bg-white/60 border-white/50 hover:bg-white/80'
							}`}>
								<div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto ${
									darkMode ? 'bg-emerald-900/50' : 'bg-green-50'
								}`}>
									<svg className={`w-6 h-6 ${darkMode ? 'text-emerald-400' : 'text-[#1877F2]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
									</svg>
								</div>
								<h3 className={`font-semibold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Calendar Scheduling</h3>
								<p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Create meetings with Google Meet links</p>
							</div>
							
							<div className={`backdrop-blur-sm rounded-2xl p-6 border transition-all duration-200 ${
								darkMode 
									? 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-800/80' 
									: 'bg-white/60 border-white/50 hover:bg-white/80'
							}`}>
								<div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto ${
									darkMode ? 'bg-violet-900/50' : 'bg-purple-50'
								}`}>
									<svg className={`w-6 h-6 ${darkMode ? 'text-violet-400' : 'text-[#1877F2]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
									</svg>
								</div>
								<h3 className={`font-semibold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Smart Assistance</h3>
								<p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Get answers and helpful information</p>
							</div>
						</div>
					</div>
				)}

				{/* Chat Interface */}
				<div className={`backdrop-blur-lg rounded-3xl shadow-xl border overflow-hidden ${
					darkMode 
						? 'bg-gray-800/70 border-gray-700/50' 
						: 'bg-white/70 border-white/50'
				}`}>
					{/* Chat Messages */}
					<div className="h-96 overflow-y-auto p-6 space-y-4" style={{ scrollbarWidth: 'thin' }}>
						{responses.length === 0 ? (
							<div className={`flex flex-col items-center justify-center h-full ${
								darkMode ? 'text-gray-400' : 'text-gray-500'
							}`}>
								<div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
									darkMode ? 'bg-slate-700/50' : 'bg-[#1877F2]/10'
								}`}>
									<svg className={`w-8 h-8 ${darkMode ? 'text-cyan-400' : 'text-[#1877F2]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
								</div>
								<p className="text-lg font-medium mb-2">Ready to assist you</p>
								<p className="text-sm text-center max-w-md">
									Try these commands:
								</p>
								<div className="mt-4 space-y-2 text-sm">
									<div className={`rounded-lg px-3 py-2 border ${
										darkMode 
											? 'bg-slate-700/50 border-slate-600/50 text-gray-300' 
											: 'bg-blue-50 border-blue-200 text-[#1877F2]'
									}`}>
										"Send an email to john@example.com about the meeting"
									</div>
									<div className={`rounded-lg px-3 py-2 border ${
										darkMode 
											? 'bg-slate-700/50 border-slate-600/50 text-gray-300' 
											: 'bg-blue-50 border-blue-200 text-[#1877F2]'
									}`}>
										"Schedule a team meeting tomorrow at 2 PM"
									</div>
									<div className={`rounded-lg px-3 py-2 border ${
										darkMode 
											? 'bg-slate-700/50 border-slate-600/50 text-gray-300' 
											: 'bg-blue-50 border-blue-200 text-[#1877F2]'
									}`}>
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
													? darkMode 
														? "bg-red-900/50 text-red-200 border border-red-800 rounded-2xl rounded-bl-md"
														: "bg-red-50 text-red-800 border border-red-200 rounded-2xl rounded-bl-md"
													: darkMode
														? "bg-gray-700 text-gray-100 rounded-2xl rounded-bl-md"
														: "bg-gray-50 text-gray-800 rounded-2xl rounded-bl-md"
											} px-4 py-3 shadow-sm`}
										>
											<div className={`text-xs mb-1 ${
												response.type === "user" 
													? "opacity-70" 
													: darkMode 
														? "text-gray-400" 
														: "opacity-70"
											}`}>
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
										<div className={`rounded-2xl rounded-bl-md px-4 py-3 shadow-sm ${
											darkMode ? 'bg-gray-700' : 'bg-gray-100'
										}`}>
											<div className="flex items-center space-x-2">
												<div className="flex space-x-1">
													<div className={`w-2 h-2 rounded-full animate-bounce ${
														darkMode ? 'bg-gray-400' : 'bg-gray-400'
													}`}></div>
													<div className={`w-2 h-2 rounded-full animate-bounce ${
														darkMode ? 'bg-gray-400' : 'bg-gray-400'
													}`} style={{ animationDelay: '0.1s' }}></div>
													<div className={`w-2 h-2 rounded-full animate-bounce ${
														darkMode ? 'bg-gray-400' : 'bg-gray-400'
													}`} style={{ animationDelay: '0.2s' }}></div>
												</div>
												<span className={`text-sm ${
													darkMode ? 'text-gray-300' : 'text-gray-600'
												}`}>Thinking...</span>
											</div>
										</div>
									</div>
								)}
								<div ref={messagesEndRef} />
							</div>
						)}
					</div>

					{/* Command Input */}
					<div className={`border-t p-6 ${
						darkMode 
							? 'border-gray-700/50 bg-gray-800/50' 
							: 'border-gray-200/50 bg-white/50'
					}`}>
						<CommandPrompt
							onSubmit={handleCommand}
							isProcessing={isProcessing}
							darkMode={darkMode}
						/>
					</div>
				</div>

				{/* Quick Actions - ALWAYS VISIBLE */}
				<div className="mt-8 flex flex-wrap gap-3 justify-center">
					<button
						onClick={() => handleCommand("Summarize my unread emails")}
						disabled={isProcessing}
						className={`border px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-sm hover:shadow-md disabled:opacity-50 ${
							darkMode 
								? 'bg-slate-800/60 hover:bg-slate-800/80 border-slate-600/50 text-cyan-200 hover:border-cyan-500/50' 
								: 'bg-white/60 hover:bg-white/80 border-[#1877F2]/20 text-[#1877F2] hover:border-[#1877F2]/40'
						}`}
					>
						📧 Check emails
					</button>
					<button
						onClick={() => handleCommand("Schedule a team meeting tomorrow")}
						disabled={isProcessing}
						className={`border px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-sm hover:shadow-md disabled:opacity-50 ${
							darkMode 
								? 'bg-slate-800/60 hover:bg-slate-800/80 border-slate-600/50 text-cyan-200 hover:border-cyan-500/50' 
								: 'bg-white/60 hover:bg-white/80 border-[#1877F2]/20 text-[#1877F2] hover:border-[#1877F2]/40'
						}`}
					>
						📅 Schedule meeting
					</button>
					<button
						onClick={() => handleCommand("Send email to test@example.com about project update")}
						disabled={isProcessing}
						className={`border px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-sm hover:shadow-md disabled:opacity-50 ${
							darkMode 
								? 'bg-slate-800/60 hover:bg-slate-800/80 border-slate-600/50 text-cyan-200 hover:border-cyan-500/50' 
								: 'bg-white/60 hover:bg-white/80 border-[#1877F2]/20 text-[#1877F2] hover:border-[#1877F2]/40'
						}`}
					>
						✉️ Send test email
					</button>
				</div>
			</main>
		</div>
	);
}