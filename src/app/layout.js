// src/app/layout.js
import { Inter } from 'next/font/google';
import './globals.css';
import ClientSessionProvider from '../components/ClientSessionProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'AI Assistant',
  description: 'Your personal AI assistant with Google integration',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientSessionProvider>
          {children}
        </ClientSessionProvider>
      </body>
    </html>
  );
}
