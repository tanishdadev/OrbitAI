"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Mail, Calendar, Zap, Shield, Code, Bot, Globe, CheckCircle } from "lucide-react";

export default function Home() {
	const { data: session, status } = useSession();
	const router = useRouter();

	useEffect(() => {
		if (session) {
			router.push("/dashboard");
		}
	}, [session, router]);

	if (status === "loading") {
		return (
			<div className="flex h-screen items-center justify-center bg-white">
				<div className="flex items-center space-x-3">
					<div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
					<div className="text-lg font-medium text-gray-900">Loading...</div>
				</div>
			</div>
		);
	}

	return (
		<main className="min-h-screen bg-white">
			<nav className="border-b border-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center space-x-3">
							<span className="text-xl font-semibold text-gray-900">Orbit AI</span>
						</div>
					</div>
				</div>
			</nav>

			<section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
				<div className="max-w-7xl mx-auto">
					<div className="max-w-4xl mx-auto text-center">
						<div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 border border-blue-200 mb-8">
							<span className="text-blue-700 text-sm font-medium">AI Workflow Automation</span>
						</div>
						
						<h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
							Automate Your Workflow with
							<span className="text-blue-600"> Orbit AI</span>
						</h1>
						
						<p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
							Connect your Google account and let AI handle your email management and calendar scheduling through simple natural language commands.
						</p>

						<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
							<button
								onClick={() => signIn("google", { callbackUrl: `/dashboard` })}
								className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
							>
								<Globe className="w-5 h-5 mr-2" />
								Continue with Google
								<ArrowRight className="ml-2 w-5 h-5" />
							</button>
						</div>

						<div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
							<div className="flex items-center">
								<CheckCircle className="w-4 h-4 text-green-500 mr-2" />
								Free demo
							</div>
							<div className="flex items-center">
								<CheckCircle className="w-4 h-4 text-green-500 mr-2" />
								No setup required
							</div>
							<div className="flex items-center">
								<CheckCircle className="w-4 h-4 text-green-500 mr-2" />
								Secure OAuth
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="py-20 bg-gray-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold text-gray-900 mb-4">
							Powerful Automation Features
						</h2>
						<p className="text-lg text-gray-600 max-w-2xl mx-auto">
							Simple commands that connect to your Google services and get things done
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow duration-200">
							<div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
								<Mail className="w-6 h-6 text-blue-600" />
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Email Management</h3>
							<p className="text-gray-600 mb-6 leading-relaxed">
								Send emails and get inbox summaries with simple natural language commands
							</p>
							<div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-600">
								<code className="text-sm text-gray-700">"Send email to john@company.com about meeting"</code>
							</div>
						</div>

						<div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow duration-200">
							<div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
								<Calendar className="w-6 h-6 text-green-600" />
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Calendar Scheduling</h3>
							<p className="text-gray-600 mb-6 leading-relaxed">
								Create meetings and events with Google Meet links automatically
							</p>
							<div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-600">
								<code className="text-sm text-gray-700">"Schedule team meeting tomorrow at 2pm"</code>
							</div>
						</div>

						<div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow duration-200">
							<div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-6">
								<Zap className="w-6 h-6 text-indigo-600" />
							</div>
							<h3 className="text-xl font-semibold text-gray-900 mb-4">Smart Processing</h3>
							<p className="text-gray-600 mb-6 leading-relaxed">
								AI understands context and executes complex tasks from simple requests
							</p>
							<div className="bg-gray-50 rounded-lg p-4 border-l-4 border-indigo-600">
								<code className="text-sm text-gray-700">"Summarize unread emails from this week"</code>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="py-20">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold text-gray-900 mb-4">
							Built with Enterprise Technology
						</h2>
						<p className="text-lg text-gray-600">
							Secure, reliable, and scalable infrastructure
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
						<div className="text-center p-6">
							<div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
								<Code className="w-8 h-8 text-gray-600" />
							</div>
							<h3 className="text-lg font-semibold text-gray-900 mb-2">Next.js & React</h3>
							<p className="text-gray-600">Modern web framework with optimal performance</p>
						</div>

						<div className="text-center p-6">
							<div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
								<Shield className="w-8 h-8 text-gray-600" />
							</div>
							<h3 className="text-lg font-semibold text-gray-900 mb-2">Google OAuth</h3>
							<p className="text-gray-600">Secure authentication and API access</p>
						</div>

						<div className="text-center p-6">
							<div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
								<Bot className="w-8 h-8 text-gray-600" />
							</div>
							<h3 className="text-lg font-semibold text-gray-900 mb-2">LLM Model Integration</h3>
							<p className="text-gray-600">Advanced language processing capabilities</p>
						</div>
					</div>
				</div>
			</section>

			<section className="py-20 bg-blue-600">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
					<h2 className="text-3xl font-bold text-white mb-4">
						Start Automating Today
					</h2>
					<p className="text-xl text-blue-100 mb-8">
						Connect your Google account and experience intelligent workflow automation
					</p>
					<button
						onClick={() => signIn("google", { callbackUrl: `/dashboard` })}
						className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all duration-200 transform hover:scale-105"
					>
						<Globe className="w-5 h-5 mr-2" />
						Get Started Now
						<ArrowRight className="ml-2 w-5 h-5" />
					</button>
				</div>
			</section>

			<footer className="bg-white border-t border-gray-200">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
					<div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
						<div className="flex items-center space-x-3">
							<span className="text-xl font-semibold text-gray-900">Orbit AI</span>
						</div>
						<div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-8 text-sm text-gray-600">
							<p>© 2025 Orbit AI. All rights reserved.</p>
							<p>Support: <a href="mailto:help.aiorbit@gmail.com" className="text-blue-600 hover:text-blue-700 transition-colors">help.aiorbit@gmail.com</a></p>
						</div>
					</div>
				</div>
			</footer>
		</main>
	);
}