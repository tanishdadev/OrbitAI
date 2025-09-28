// src/app/layout.js
import { Inter } from "next/font/google";
import "./globals.css";
import ClientSessionProvider from "./components/ClientSessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
	title: "Orbit AI",
	description: "Your personal AI to automate and streamline workflows for 10x productivity",
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body className={inter.className}>
				<ClientSessionProvider>{children}</ClientSessionProvider>
			</body>
		</html>
	);
}
