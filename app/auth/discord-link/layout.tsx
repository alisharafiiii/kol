export default function DiscordLinkLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Return children directly without any wrapper
  // This bypasses the LayoutWrapper from the root layout
  return <>{children}</>
} 