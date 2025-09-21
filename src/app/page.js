"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
	const { data: session, status } = useSession();
	const router = useRouter();

	// Redirect logged-in users to dashboard
	useEffect(() => {
		if (session) {
			router.push("/dashboard");
		}
	}, [session, router]);

	// Show loading while session is being fetched
	if (status === "loading") {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-xl">Loading...</div>
			</div>
		);
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-blue-50 to-white">
			<div className="text-center">
				<h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
					AI Assistant
				</h1>
				<p className="text-xl mb-8 text-gray-600">
					Your personal AI assistant with Google integration
				</p>
				<button
					onClick={() =>
						signIn("google", { callbackUrl: `/dashboard` })
					}
					className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-all transform hover:scale-105"
				>
					Sign in with Google
				</button>
			</div>
		</main>
	);
}
