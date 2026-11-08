import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "google-gax",
    "google-auth-library",
    "jwks-rsa",
    "jose",
    "mssql",
    "tedious",
    "@azure/identity",
  ],
  // Le pagine Predictive sono passate da /predictive-dialer a /predictive (le API /api/predictive-dialer restano invariate).
  async redirects() {
    return [
      { source: "/predictive-dialer", destination: "/predictive", permanent: true },
      { source: "/predictive-dialer/:path*", destination: "/predictive/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
