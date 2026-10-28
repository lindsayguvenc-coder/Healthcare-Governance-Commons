// api/synthesize.js — the one AI route for every tool (node synthesis, Collaborator,
// ROI, Governance Assessment, Transition tools). All limits live in _relay.js.
// One shared route keeps the site under the Vercel Hobby limit of 12 functions.
const { relay } = require("./_relay.js");

export default async function handler(req, res) {
  return relay(req, res);
}
