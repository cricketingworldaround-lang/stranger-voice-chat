import "./globals.css";

export const metadata = {
  title: "TalkStranger — Anonymous Voice Chat",
  description: "Talk to random strangers by voice, anonymously.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white antialiased">{children}</body>
    </html>
  );
}