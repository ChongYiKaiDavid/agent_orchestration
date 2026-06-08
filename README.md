# AI Agent Orchestration Frontend

A modern dark React TypeScript frontend dashboard for AI task orchestration, built with Vite and custom dark theme styling.

## Features

- 🌙 **Dark themed UI** with system status and task lifecycle views
- 📱 **Responsive sidebar navigation** for fast section switching
- ⚡ **React + TypeScript** frontend with state-driven page rendering
- 🧪 **Unit tests** using Vitest and Testing Library
- 🚀 **Vite build** with fast development and production output

## Project Structure

```
src/
├── components/
│   └── layout/
│       ├── Header.tsx
│       ├── Layout.tsx
│       └── Sidebar.tsx
├── pages/
│   ├── Activity.tsx
│   ├── Agents.tsx
│   ├── CreateTask.tsx
│   ├── Dashboard.tsx
│   ├── Decompose.tsx
│   ├── Pipelines.tsx
│   └── Settings.tsx
├── __tests__/
│   └── *.test.tsx
├── App.tsx
├── index.css
├── main.tsx
└── setupTests.ts
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build

```bash
npm run build
```

## Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Notes

- The project uses custom CSS styling in `src/index.css` rather than Tailwind.
- The app preserves the current client architecture while adding test coverage for each page.

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
