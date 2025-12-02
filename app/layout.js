// app/layout.js
import './globals.css';

export const metadata = {
  title: 'MyXL Web Bot',
  description: 'Bot Management MyXL',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        {children}
      </body>
    </html>
  );
}
