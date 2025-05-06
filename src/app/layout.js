export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
} 