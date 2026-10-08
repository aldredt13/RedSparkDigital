import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

/** Public site origin, no trailing slash. A custom domain added on Vercel is picked up automatically. */
function resolveSiteUrl(env: Record<string, string>): string {
  const explicit = env.VITE_SITE_URL || process.env.VITE_SITE_URL
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return (explicit || (vercel ? `https://${vercel}` : 'https://red-spark-digital.vercel.app')).replace(/\/+$/, '')
}

/**
 * Everything prefixed VITE_ ends up in the public JavaScript bundle. Refuse to
 * build if the Supabase settings are missing, or if the key is a
 * secret/service-role key — that key bypasses every security rule in the database.
 */
function supabaseKeyGuard(env: Record<string, string>): Plugin {
  return {
    name: 'supabase-key-guard',
    apply: 'build',
    configResolved() {
      const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((name) => !env[name]?.trim())
      if (missing.length) {
        throw new Error(
          `\n\nMissing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.\n` +
            'Vite only passes variables whose names start with VITE_ to the website, so the names must stay exactly\n' +
            'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Vercel → Settings → Environment Variables), then redeploy.\n',
        )
      }

      const key = env.VITE_SUPABASE_ANON_KEY ?? ''
      let role = ''
      try {
        role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role ?? ''
      } catch {
        /* not a JWT (e.g. a new sb_publishable_ key) */
      }
      if (role === 'service_role' || key.startsWith('sb_secret_')) {
        throw new Error(
          '\n\nVITE_SUPABASE_ANON_KEY is a SECRET service-role key. It would be published in the site bundle.\n' +
            'Use the anon / publishable key instead (Supabase → Project Settings → API Keys).\n',
        )
      }
    },
  }
}

/**
 * Fills %SITE_URL% in index.html, emits robots.txt + sitemap.xml, and writes
 * app.html — a non-indexed copy of the SPA shell that vercel.json serves for /admin.
 */
function seo(siteUrl: string): Plugin {
  let isClientBuild = false
  let outDir = 'dist'
  return {
    name: 'redspark-seo',
    configResolved(config) {
      isClientBuild = config.command === 'build' && !config.build.ssr
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const indexPath = path.join(outDir, 'index.html')
      if (!isClientBuild || !fs.existsSync(indexPath)) return
      const shell = fs
        .readFileSync(indexPath, 'utf8')
        .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, nofollow" />')
        .replace(/<title>[^<]*<\/title>/, '<title>Admin · RedSpark Digital</title>')
      fs.writeFileSync(path.join(outDir, 'app.html'), shell)
    },
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    generateBundle() {
      if (!isClientBuild) return
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          `  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n` +
          `  <url>\n    <loc>${siteUrl}/privacy</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.3</priority>\n  </url>\n` +
          `</urlset>\n`,
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const { version } = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))
  return {
    // Semantic version from package.json — see CHANGELOG.md
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [
      supabaseKeyGuard(env),
      seo(resolveSiteUrl(env)),
      TanStackRouterVite({ autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],
  }
})
