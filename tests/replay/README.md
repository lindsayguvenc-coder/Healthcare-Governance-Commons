# Review-queue replay

Records a captioned video of the contribution flow: four visitor submissions
(consensus approve, consensus reject, split, refused for patient data), Lindsay's
review queue, and the published results.

It runs the real `/api/suggest` and `/api/queue` code against the built site.
Redis is an in-memory mock and the two AI reviewers give scripted answers, so it
shows the interface and logic, not live model judgment.

```
npm run build
cd tests/replay && npm init -y && npm i ioredis-mock@8 playwright
node server.js ../.. 4300 &
node record.js http://localhost:4300 ./video
```

Next step (docs/ROADMAP.md): run the same scenarios in GitHub Actions against
each Vercel preview, with real services, and attach the video to the pull request.

## Validation Protocol Generator replay

Fills in a made-up deployment, shows the on-screen disclaimer, generates a real PDF
through `/api/generate-protocol` and `/api/vpg-engines`, and walks through the pages
that changed. The video is stitched from one screenshot per caption, so it needs
`ffmpeg` and `pdftoppm`/`pdftotext` (poppler) on PATH. The server must run on port
3000, because the protocol route calls the engines at `localhost:3000` when
`VERCEL_URL` is unset.

```
npm run build
cd tests/replay && npm i ioredis-mock@8 playwright jspdf@2.5.1
node server.js ../.. 3000 &
node record-vpg.js http://localhost:3000 ./video-vpg [path-to-chrome]
```
