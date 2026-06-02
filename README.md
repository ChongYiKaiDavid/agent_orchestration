# Frontend - AI Orchestration Dashboard

A modern dark mode React TypeScript frontend for an AI orchestration platform, built with Vite and styled with Tailwind CSS.

## Features

- 🌙 **Dark Mode Design**: Elegant dark theme with purple, blue, and accent colors
- 📱 **Responsive Layout**: Mobile-friendly sidebar navigation with adaptive layout
- ⚡ **React + TypeScript**: Type-safe development with React 18
- 🎨 **Tailwind CSS**: Modern utility-first styling with custom theme
- 🚀 **Vite**: Lightning-fast build tool and dev server
- 📊 **Dashboard Components**:
  - Active Sessions
  - Recent Tasks with status tracking
  - Running Pods status
  - Recent Events
  - Recent Activity

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx      # Left navigation sidebar
│   │   ├── Header.tsx       # Top header with status info
│   │   └── Layout.tsx       # Main layout wrapper
│   └── sections/
│       ├── ActiveSessions.tsx
│       ├── RecentTasks.tsx
│       ├── Pods.tsx
│       ├── RecentEvents.tsx
│       └── RecentActivity.tsx
├── types/
│   └── index.ts             # TypeScript type definitions
├── App.tsx                  # Main application component
├── index.css               # Tailwind CSS setup
└── main.tsx                # React entry point
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## Customization

### Theme Colors

Edit `tailwind.config.js` to customize colors:
- `dark.*` - Dark mode color palette
- `accent.*` - Primary accent colors (purple, blue, green, yellow, red)

### Styling

CSS classes are defined in `src/index.css`:
- `.card` - Card component styling
- `.btn-primary` / `.btn-secondary` - Button styles
- `.status-badge` - Status badge styles
- `.status-*` - Status-specific styles

## Components

### Sidebar
Navigation menu with sections for Dashboard, Live, and Library items with responsive mobile support.

### Header
Top bar showing system status metrics (Nodes, Pods, CPU usage) with mobile menu toggle.

### ActiveSessions
Displays currently active orchestration sessions with branch and project information.

### RecentTasks
Shows recent tasks with status (running, pending, failed, done), associated agents, and PR links.

### Pods
Lists running pods with their current status (running, pending, failed).

### RecentEvents
System events feed with timestamps and icons for various event types.

### RecentActivity
Activity feed showing recent system changes, project connections, and pod lifecycle events.

## Dark Mode

The application uses Tailwind's class-based dark mode with a custom dark color palette:
- `dark-900`: Darkest background (#0f1419)
- `dark-800`: Card and section backgrounds (#1f2236)
- `dark-700`: Borders and hover states (#2d3142)

Accent colors:
- `accent-purple`: #9d7fff
- `accent-blue`: #6b9eff
- `accent-green`: #4ade80
- `accent-yellow`: #fbbf24
- `accent-red`: #ff6b6b

## Status Indicators

- **Running**: Green status badge
- **Pending**: Yellow status badge
- **Failed**: Red status badge
- **Done**: Blue status badge
- **Working**: Yellow status badge
- **Attention**: Red status badge

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Development Stack

- **React 18** with TypeScript for component development
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for styling with JIT compilation
- **Lucide React** for icon components
- **PostCSS** for CSS processing

## File Structure

- `tailwind.config.js` - Tailwind configuration with custom theme
- `postcss.config.js` - PostCSS configuration for Tailwind processing
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration
- `package.json` - Dependencies and scripts

## License

MIT
