/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Empêche l'app d'être embarquée dans une iframe externe (anti-clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Empêche le navigateur de deviner le type MIME des fichiers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limite les informations envoyées au clic vers un autre site
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Désactive l'accès aux capteurs/caméra/géoloc par défaut
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Force HTTPS pendant 2 ans, y compris sous-domaines
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
