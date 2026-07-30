import "./globals.css";

export const metadata = {
  title: "Gurbani Shabad — Read & Reflect",
  description:
    "A serene space to read Gurbani shabads, reflect on their meanings, and track your journey.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Decorative floating pastel blobs */}
        <div
          className="blob animate-floaty"
          style={{
            width: 320,
            height: 320,
            top: -80,
            left: -60,
            background: "#F8BBD0",
          }}
        />
        <div
          className="blob animate-floaty"
          style={{
            width: 280,
            height: 280,
            bottom: -60,
            right: -40,
            background: "#80CBC4",
            animationDelay: "2s",
          }}
        />
        <div
          className="blob animate-floaty"
          style={{
            width: 240,
            height: 240,
            top: "40%",
            right: "10%",
            background: "#B39DDB",
            animationDelay: "4s",
          }}
        />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}