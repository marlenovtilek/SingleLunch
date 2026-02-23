import baseConfig from '@frontend/ui/tailwind.config'
import type { Config } from 'tailwindcss'

const config: Config = {
  ...baseConfig,
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './providers/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/forms/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/messages/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/components/**/*.{js,ts,jsx,tsx,mdx}'
  ]
}

export default config
