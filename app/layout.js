import "./globals.css";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";

export const metadata = {
  title: "ਗੁਰਬਾਣੀ ਵਿਚਾਰ",
  description:
    "ਗੁਰਬਾਣੀ ਸ਼ਬਦ ਪੜ੍ਹਨ, ਅਰਥ ਸਮਝਣ ਅਤੇ ਆਪਣੀ ਯਾਤਰਾ ਦੀ ਨਿਗਰਾਨੀ ਲਈ ਇੱਕ ਸ਼ਾਂਤ ਥਾਂ।",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ਗੁਰਬਾਣੀ",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#B39DDB",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
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