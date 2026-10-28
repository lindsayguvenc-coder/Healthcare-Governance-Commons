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
