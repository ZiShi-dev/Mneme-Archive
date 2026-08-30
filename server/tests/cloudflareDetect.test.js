import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOUDFLARE_CHALLENGE_PATTERN,
  isCloudflareChallengeHtml,
  isValidSourceHtml,
} from "../lib/cloudflareDetect.js";

test("isCloudflareChallengeHtml detects common challenge pages", () => {
  assert.equal(isCloudflareChallengeHtml('<html><title>Just a moment...</title></html>'), true);
  assert.equal(isCloudflareChallengeHtml('<div class="cf-browser-verification"></div><script src="/cdn-cgi/challenge-platform/"></script>'), true);
  assert.equal(isCloudflareChallengeHtml('<h1>Attention Required!</h1>'), true);
  assert.equal(isCloudflareChallengeHtml('<div>Checking your browser before accessing</div>'), true);
  assert.equal(isCloudflareChallengeHtml('<div class="cf-turnstile"></div>'), true);
  assert.equal(isCloudflareChallengeHtml('<script>__cf_chl_opt={}</script>'), true);
  assert.equal(isCloudflareChallengeHtml('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon></script>'), false);
  assert.equal(
    isCloudflareChallengeHtml('<script src="/cdn-cgi/challenge-platform/h/g/scripts/abc/main.js"></script><ul><li class="novel-item"></li></ul>'),
    false,
  );
});

test("isCloudflareChallengeHtml ignores valid catalog pages", () => {
  const html = '<div class="page-item-detail manga"><a href="/manga/demo/">Demo</a></div>';
  assert.equal(isCloudflareChallengeHtml(html), false);
  assert.equal(CLOUDFLARE_CHALLENGE_PATTERN.test(html), false);
});

test("isValidSourceHtml combines cloudflare and business checks", () => {
  const valid = '<div class="page-item-detail manga"></div>';
  const blocked = '<title>Just a moment...</title>';
  assert.equal(isValidSourceHtml(valid, (html) => /page-item-detail/.test(html)), true);
  assert.equal(isValidSourceHtml(blocked, (html) => /page-item-detail/.test(html)), false);
  assert.equal(isValidSourceHtml(valid, () => false), false);
});
