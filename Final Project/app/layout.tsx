import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HolySplit — Good plans. Fair splits.",
  description: "Split expenses without an account. Calculate locally or offline; sign in only to invite friends.",
  icons: {
    icon: "/mascot.svg",
    shortcut: "/mascot.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="/events.css?v=heroes-1" /></head>
      <body>{children}</body>
    </html>
  );
}
