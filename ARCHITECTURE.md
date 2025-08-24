# PDF Signer SPA - Architecture Documentation

## Overview

The PDF Signer SPA is a React-based single-page application that allows users to upload PDF documents and add interactive signatures through drawing, typing, or uploading signature images. The application operates entirely client-side for security and privacy.

## Technology Stack

- **Frontend Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.2
- **State Management**: Zustand 4.5.5
- **PDF Processing**: 
  - PDF.js (pdfjs-dist 4.10.38) for rendering
  - PDF-lib 1.17.1 for document modification
- **Signature Drawing**: signature_pad 5.0.4
- **Styling**: CSS with custom styles

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Input    │    │   React App      │    │   PDF Engine    │
│                 │    │                  │    │                 │
│ • File Upload   │───▶│ • App.tsx        │───▶│ • PDF.js        │
│ • Signature     │    │ • Components     │    │ • PDF-lib       │
│ • Interactions  │    │ • State Store    │    │ • Canvas API    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   File Export   │
                       │                 │
                       │ • Signed PDF    │
                       │ • Local Download│
                       └─────────────────┘
```

## File Structure & Responsibilities

### Core Application Files

#### `src/App.tsx`
**Main application component and entry point**
- **File Upload**: Handles PDF file selection with validation (size: 50MB max, type: PDF only, magic number verification)
- **UI Layout**: Manages sidebar and main viewer layout
- **Security Features**: PDF header validation to prevent malicious files
- **User Interface**: Provides instructions and signature placement counter

#### `src/main.tsx`
**Application bootstrap**
- React application initialization
- DOM mounting point

#### `src/index.css`
**Global styling**
- Application-wide CSS styles
- Layout definitions
- Interactive element styling

### State Management

#### `src/store/appStore.ts`
**Zustand-based global state management**

**State Structure:**
- `pdfFile: File | null` - Currently loaded PDF file
- `pages: HTMLCanvasElement[]` - Rendered PDF pages as canvas elements
- `pageSizes: Size[]` - Dimensions of each PDF page
- `placements: Placement[]` - Array of signature placements
- `currentSignature: string | null` - Active signature (data URL)
- `hasDoc: boolean` - Flag indicating if PDF is loaded

**Key Actions:**
- `loadFile()` - Load PDF and reset placements
- `clearAll()` - Reset entire application state
- `setPages()` - Store rendered PDF pages
- `addPlacement()` - Add signature to specific page coordinates
- `updatePlacement()` - Modify existing signature position/size
- `removePlacement()` - Delete signature placement
- `exportAll()` - Generate signed PDF for download

**Security Features:**
- Data URL validation for signatures
- Input sanitization for placement coordinates
- UUID generation for placement tracking

### UI Components

#### `src/components/PdfViewer.tsx`
**PDF display and signature interaction component**

**Key Features:**
- **PDF Rendering**: Displays PDF pages as HTML5 canvas elements
- **Interactive Placement**: Click-to-place signature functionality
- **Signature Management**: Selection, drag-to-move, resize capabilities
- **Keyboard Controls**: Delete/Backspace key support for removing signatures
- **Visual Feedback**: Selection borders and resize handles

**Interaction Flow:**
1. PDF pages rendered as canvas elements in wrapper divs
2. Click events on canvas trigger signature placement
3. Signature overlays rendered as positioned IMG elements
4. Mouse events handle drag-to-move and resize operations
5. Context menu (right-click) provides deletion option

**Coordinate System:**
- Display coordinates: Top-left origin, scaled 1.5x
- PDF coordinates: Bottom-left origin, 1x scale
- Coordinate conversion handled in export module

#### `src/components/SignaturePanel.tsx`
**Signature creation and management interface**

**Three Signature Modes:**

1. **Draw Mode**: 
   - HTML5 canvas with SignaturePad library
   - Vector-based signature drawing
   - High-DPI support with device pixel ratio scaling

2. **Type Mode**:
   - Text input with comprehensive sanitization
   - Canvas-based text rendering using cursive fonts
   - XSS prevention through input filtering and HTML entity decoding

3. **Upload Mode**:
   - Image file upload (PNG, JPEG, WebP)
   - File type and size validation (5MB max)
   - Data URL format verification

**Security Measures:**
- Input sanitization prevents script injection
- File type validation prevents malicious uploads
- Canvas rendering automatically escapes text content
- Paste event filtering for clipboard content

### PDF Processing Modules

#### `src/modules/pdf/render.ts`
**PDF rendering engine**

**Functionality:**
- Converts PDF files to HTML5 canvas elements using PDF.js
- Applies 1.5x scaling for better display quality
- Extracts page dimensions for coordinate calculations
- Returns array of canvas elements and size metadata

**Process:**
1. Load PDF document from File object
2. Iterate through each page
3. Create viewport with 1.5x scale
4. Render page to canvas context
5. Store canvas and dimensions

#### `src/modules/write/export.ts`
**PDF export and signature embedding**

**Core Process:**
1. Load original PDF using PDF-lib
2. Embed signature images (PNG/JPEG support)
3. Convert display coordinates to PDF coordinate system
4. Apply signatures to appropriate pages
5. Generate downloadable PDF blob

**Coordinate Conversion:**
- **Display**: Top-left origin, 1.5x scale
- **PDF**: Bottom-left origin, 1x scale
- **Formula**: `pdfY = pageHeight - (displayY + height) / 1.5`

**Security Features:**
- Filename sanitization prevents directory traversal
- Image format validation during embedding
- Memory management with image caching

### Configuration Files

#### `package.json`
**Project dependencies and scripts**
- Development server: `npm run dev`
- Production build: `npm run build`
- Preview build: `npm run preview`

#### `tsconfig.json`
**TypeScript configuration**
- Strict type checking enabled
- Modern ES modules support

#### `vite.config.ts`
**Build tool configuration**
- React plugin integration
- Development server settings

#### `index.html`
**Application entry point**
- React application mount point
- Meta tags and basic HTML structure

### Security Files

#### `SECURITY.md`
**Security policy and vulnerability reporting**
- Defines responsible disclosure process
- Contact information for security issues

#### `security-test.html` & `public/security-headers-test.html`
**Security testing utilities**
- Tools for validating security headers
- XSS and injection testing interfaces

## Data Flow

### PDF Loading Process
1. User selects PDF file via file input
2. File validation (size, type, magic number)
3. File stored in Zustand state
4. PDF rendered to canvas elements via PDF.js
5. Canvas elements and page sizes stored in state
6. PDF pages displayed in viewer component

### Signature Creation Process
1. User selects signature mode (draw/type/upload)
2. Signature created via respective method
3. Signature converted to data URL format
4. Data URL stored as current signature in state
5. User interface updated to show signature ready state

### Signature Placement Process
1. User clicks on PDF page while signature is selected
2. Click coordinates captured relative to page wrapper
3. Signature placement created with unique ID
4. Placement stored in state with page index and rectangle
5. Signature rendered as overlay IMG element
6. Interactive handles added for manipulation

### Export Process
1. User triggers export action
2. Original PDF loaded into PDF-lib document
3. All signature placements processed:
   - Images embedded into PDF document
   - Coordinates converted from display to PDF space
   - Signatures drawn onto appropriate pages
4. Modified PDF saved as binary data
5. Download triggered with sanitized filename

## Security Considerations

### Input Validation
- **File Upload**: Size limits, type checking, magic number verification
- **Text Input**: XSS prevention, HTML entity decoding, character filtering
- **Image Upload**: Format validation, size limits, data URL verification

### Client-Side Security
- **No Server Communication**: All processing happens locally
- **Memory Management**: Proper cleanup of object URLs and event listeners
- **Filename Sanitization**: Prevents directory traversal attacks

### Content Security
- **Canvas Rendering**: Automatic content escaping
- **Data URL Validation**: Strict format checking
- **Image Processing**: Safe embedding through PDF-lib

## Performance Optimizations

### Rendering Performance
- **Canvas Scaling**: High-DPI support without performance penalty
- **Event Delegation**: Efficient event handling for multiple signatures
- **Image Caching**: Reuse embedded images for multiple placements

### Memory Management
- **Object URL Cleanup**: Proper disposal of blob URLs
- **Event Listener Cleanup**: Component unmounting cleanup
- **Canvas Context Optimization**: Proper scaling and sizing

## Browser Compatibility

### Core Requirements
- **ES2020 Support**: Modern JavaScript features
- **Canvas API**: HTML5 canvas for rendering
- **FileReader API**: File processing capabilities
- **Blob/URL APIs**: File download functionality

### Tested Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development Workflow

### Local Development
```bash
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Create production build
npm run preview    # Preview production build
```

### Build Process
1. TypeScript compilation with strict checking
2. Vite bundling with tree-shaking
3. Asset optimization and minification
4. Production-ready static files in `dist/` directory

## Deployment Considerations

### Static Hosting
- **No Backend Required**: Pure client-side application
- **CDN Friendly**: Static assets with proper caching headers
- **HTTPS Required**: Secure context for file APIs

### Security Headers
- **Content Security Policy**: Restrict inline scripts and external resources
- **X-Frame-Options**: Prevent clickjacking attacks
- **X-Content-Type-Options**: Prevent MIME type sniffing

## Future Enhancements

### Potential Improvements
- **Multiple Signature Types**: Support for initials, stamps, etc.
- **Annotation Support**: Text boxes, highlighting, comments
- **Batch Processing**: Multiple document signing
- **Touch Support**: Better mobile/tablet interaction
- **Accessibility**: Screen reader and keyboard navigation support

### Technical Debt
- **TypeScript Coverage**: Improve type definitions for PDF.js
- **Error Handling**: More granular error messages and recovery
- **Testing**: Unit and integration test coverage
- **Optimization**: Bundle size reduction and lazy loading