"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import CommandPrompt from "../components/CommandPrompt";
import { useRouter } from "next/navigation";

export default function Dashboard() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [responses, setResponses] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/");
		}
	}, [status, router]);

	if (status === "loading") {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-xl">Loading...</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	const handleCommand = async (command) => {
		setIsProcessing(true);
		try {
			const response = await fetch("/api/ai", {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${session.accessToken}` // ✅ added this line
				},
				body: JSON.stringify({ command }),
			});

			const data = await response.json();

			setResponses((prev) => [
				...prev,
				{
					type: "command",
					text: command,
					timestamp: new Date().toLocaleTimeString(),
				},
				{
					type: "response",
					text: data.result || data.error || "No response",
					timestamp: new Date().toLocaleTimeString(),
				},
			]);
		} catch (error) {
			setResponses((prev) => [
				...prev,
				{
					type: "error",
					text: `Error: ${error.message}`,
					timestamp: new Date().toLocaleTimeString(),
				},
			]);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
			{/* Header */}
			<header className="bg-white shadow-md">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
					<h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
						AI Assistant
					</h1>
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							{session.user?.image && (
								<img
									src={session.user.image}
									alt="Profile"
									className="w-8 h-8 rounded-full"
								/>
							)}
							<span className="text-gray-700">
								{session.user?.email}
							</span>
						</div>
						<button
							onClick={() => signOut()}
							className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
						>
							Sign Out
						</button>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="flex-1 flex flex-col items-center justify-center p-4">
				<div className="text-center mb-8 mt-8">
					<h2 className="text-4xl font-bold text-gray-800">
						Hello, {session.user?.name || "User"}!
					</h2>
					<p className="text-gray-600 mt-2">
						How can I help you today?
					</p>
				</div>

				{/* Response Area */}
				<div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-6 mb-8">
					<div className="h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
						{responses.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-gray-500">
								<p className="text-lg font-medium">
									Your AI responses will appear here
								</p>
								<p className="text-sm mt-2">
									Try commands like:
								</p>
								<ul className="text-sm mt-2 space-y-1">
									<li>
										• "Schedule a meeting tomorrow at 2pm"
									</li>
									<li>
										• "Draft an email to john@example.com
										about project update"
									</li>
									<li>• "Summarize my unread emails"</li>
									<li>• "What's the weather today?"</li>
								</ul>
							</div>
						) : (
							<div className="space-y-3">
								{responses.map((response, i) => (
									<div
										key={i}
										className={`p-3 rounded-lg ${
											response.type === "command"
												? "bg-blue-100 ml-auto max-w-[80%]"
												: response.type === "error"
												? "bg-red-100 max-w-[80%]"
												: "bg-gray-100 max-w-[80%]"
										}`}
									>
										<div className="text-xs text-gray-500 mb-1">
											{response.timestamp}
										</div>
										<div
											className={`whitespace-pre-wrap ${
												response.type === "command"
													? "text-blue-900"
													: response.type === "error"
													? "text-red-900"
													: "text-gray-800"
											}`}
										>
											{response.type === "command"
												? `> ${response.text}`
												: response.text}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Command Prompt */}
				<CommandPrompt
					onSubmit={handleCommand}
					isProcessing={isProcessing}
				/>
			</main>
		</div>
	);
}
