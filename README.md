# PDF Signer SPA — Interactive Placement (React + Vite + TS)

What’s new in this build:
- Click anywhere on the PDF to **place** your current signature.
- **Multiple placements** supported (for multiple signers/initials).
- **Drag to move** placed signatures before export.
- Download exports a **flattened** PDF with all placed signatures.

## Run
```bash
npm i
npm run dev
```

## Build & Deploy to S3
```bash
npm run build
aws s3 sync dist/ s3://YOUR_BUCKET --delete
```

<video src="demo.mp4" width="400" autoplay loop muted></video>
