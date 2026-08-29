import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "google-gax",
    "google-auth-library",
    "jwks-rsa",
    "jose",
  ],
};

export default nextConfig;
