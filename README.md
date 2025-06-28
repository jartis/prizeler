# PRIZELER

A utility for tracking prize package incentives for charity marathon streams. Allows for setting eligibility times, defining prize packs with minimum cumulative donations or multi-entry by defined amount, along with multiple quantities of individual packs with unique winners drawn.

# BUILDING

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js installation

## Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Available Build Scripts**:
   - `npm run build` - Production build with minification
   - `npm run dev` - Development build with watch mode
   - `npm run serve` - Development server with hot reload
   - `npm run clean` - Clean the dist folder

## Build Process

The application uses **Webpack 5** for bundling and optimization:

### Development Build
```bash
npm run dev
```
- Builds to `dist/` folder in development mode
- Enables source maps for debugging
- Watches for file changes and rebuilds automatically
- No minification for faster builds

### Development Server
```bash
npm run serve
```
- Starts a local development server on `http://localhost:3000`
- Hot module replacement for instant updates
- Automatically opens in your default browser

### Production Build
```bash
npm run build
```
- Creates optimized production build in `dist/` folder
- Minifies JavaScript and CSS
- Removes console.log statements and debugger calls
- Generates content hashes for cache busting
- Compresses and optimizes all assets

### Build Output Structure
```
dist/
├── index.html                    # Main HTML file
├── js/
│   ├── main.[hash].min.js       # Minified application code
│   └── vendors.[hash].min.js    # Third-party libraries
├── css/
│   └── styles.[hash].min.css    # Minified stylesheets
├── donations-schema.json        # Validation schemas
├── prizepacks-schema.json
└── ignoreme/
    └── *.json                   # Sample data files
```

## Deployment

### Static File Hosting
The `dist/` folder contains all files needed for deployment:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy the `dist/` folder** to any static hosting service.

### Web Server Configuration
The application is a single-page application (SPA) that can run from any web server:

- **Apache**: No special configuration needed
- **Nginx**: Serve static files from the `dist/` directory
- **IIS**: Deploy as static content
- **CDN**: All files are static and CDN-friendly

### Local Testing
To test the production build locally:
```bash
npm run build
# Serve the dist folder with any static server
npx serve dist
```

The application will be available at the provided local URL (typically `http://localhost:3000` or `http://localhost:5000`).

# USAGE

## Workflow Overview

The typical workflow for using PRIZELER follows these main steps:

### 1. Set Up Prize Packs
**Create or Import Prize Packages:**
- **Manual Creation**: Use the "Add New Prize Pack" button in the Prize Packs tab to create individual prize packages
- **Bulk Import**: Drag and drop a JSON file containing multiple prize packs, or use the file upload button
- **Configure Each Pack**: Set pack ID, block name, eligibility dates, minimum donation amounts, and drawing rules (cumulative vs. multi-entry)

### 2. Import Donation Data
**Load Donor Contributions:**
- **Import JSON File**: Drag and drop or upload a donations JSON file containing donor records
- **Manual Entry**: Add individual donations using the "Add New Donation" button if needed
- **Verify Data**: Review imported donations using filters and search functionality

### 3. Conduct Drawings
**Run Prize Drawings:**
- **Navigate to Drawings Tab**: View all available prize packs and their eligibility status
- **Individual Drawings**: Click "Run Drawing" on specific prize packs to conduct single drawings
- **Bulk Processing**: Use "Run All Drawings" to conduct drawings for all eligible prize packs at once
- **Review Results**: Immediately view winners, eligible entry counts, and packs with no qualifying donors

### 4. Save and Export Results
**Finalize and Export:**
- **Save Results**: Click "Save Results" to permanently store drawing outcomes and add them to history
- **CSV Export**: Automatically download a CSV file containing prize pack details, winner information, and drawing dates
- **Reset Option**: Use "Reset" buttons to clear results and re-run drawings if needed

### 5. Data Management
**Ongoing Operations:**
- **View History**: Access the "Drawing History" button to review past drawing results
- **Analytics**: Monitor statistics for prize packs, donations, and drawing outcomes
- **Export Data**: Export prize packs and donations as JSON files for backup or sharing

The application automatically saves data to browser localStorage, ensuring your work persists between sessions.

## Data sources

The application accepts JSON files for importing data into the system. Two types of data files are supported:

### Prize Packs (`prizepacks-schema.json`)
Prize pack files contain an array of prize package definitions. Each prize pack includes:
- **Pack ID**: Unique identifier
- **Block/Category**: Organizational grouping
- **Start/End Dates**: Eligibility time windows
- **Prize Description**: Details of items included
- **Entry Requirements**: Minimum donation amounts
- **Drawing Rules**: Multi-entry vs. cumulative, number of winners

### Donations (`donations-schema.json`)
Donation files contain an array of donor contribution records. Each donation includes:
- **Timestamp**: When the donation was made (ISO 8601 format)
- **Donor Information**: Screen name, email, and unique user ID
- **Amount**: Donation value in dollars (supports cents)

Both file formats are validated against their respective JSON schemas to ensure data integrity and compatibility with the drawing system. The schemas enforce proper data types, required fields, and valid value ranges to prevent common data entry errors.

You can drag and drop JSON files directly into the application interface to import data, or use the file upload buttons in each respective tab.

