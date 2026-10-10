import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
// Self-hosted fonts (no Google Fonts request)
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import './index.css'

const router = getRouter()

// Resolve the first route (and its code-split chunk) before mounting, so the
// prerendered landing page is swapped for the live one without a blank flash.
router
  .load()
  .catch(() => {})
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    )
  })
