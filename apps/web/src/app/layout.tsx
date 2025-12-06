// Root layout that only handles the HTML structure
// The actual layout with providers is in [locale]/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
