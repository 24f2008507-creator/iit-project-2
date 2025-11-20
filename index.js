// index.js
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8000;

// Use env var if set, otherwise fallback to the hard-coded secret
const APP_SECRET = process.env.TDS_SECRET || 'tds24_llm_quiz_7JxQ29';

// --- Middleware to parse JSON and handle invalid JSON ---

app.use(express.json());

// Error handler specifically for JSON parse errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next();
});

// --- Main /quiz endpoint ---

app.post('/quiz', async (req, res) => {
  try {
    const body = req.body || {};
    const { email, secret, url } = body;

    // 1. Check required fields
    if (!email || !secret || !url) {
      return res.status(400).json({
        error: 'Invalid fields. "email", "secret", and "url" are required.'
      });
    }

    // 2. Validate secret
    if (secret !== APP_SECRET) {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    // 3. Secret is valid → solve quiz chain within 3 minutes
    const deadline = Date.now() + 3 * 60 * 1000; // now + 3 minutes

    const result = await solveQuizChain({
      startUrl: url,
      email,
      secret,
      deadline
    });

    // HTTP 200 is required for valid secrets
    return res.status(200).json(result);
  } catch (err) {
    console.error('Unexpected error in /quiz handler:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Basic quiz solving logic for tests ---
// NOTE: This is a BASIC implementation.
// It shows that your endpoint:
//   - Visits the quiz URL
//   - Sends a JSON answer payload
//   - Follows any `url` in the response
// It does NOT yet compute correct answers to arbitrary tasks.

async function solveQuizChain({ startUrl, email, secret, deadline }) {
  let currentUrl = startUrl;
  let lastResult = null;

  while (Date.now() < deadline) {
    try {
      // 1. "Visit" the quiz page with a GET (even if it's JS-rendered, this
      // at least shows we are contacting it; for full JS execution you would
      // later replace this with Playwright/Puppeteer).
      try {
        await axios.get(currentUrl, { timeout: 15000 });
      } catch (e) {
        console.warn(`GET ${currentUrl} failed (continuing anyway):`, e.message);
      }

      // 2. Send a simple/dummy answer payload to the URL.
      // For the real exam, you must parse the page instructions, find the
      // submit URL from the text, compute the real answer, and POST to that
      // submit URL (not necessarily the quiz URL!).
      const payload = {
        email,
        secret,
        url: currentUrl,
        answer: 0 // TODO: replace with real computed answer
      };

      const response = await axios.post(currentUrl, payload, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });

      lastResult = response.data;

      // 3. If the response includes a new URL, follow it; otherwise we're done.
      if (!lastResult || !lastResult.url) {
        break;
      }

      currentUrl = lastResult.url;
    } catch (e) {
      console.error('Error during quiz chain:', e.message);
      // Return what we have so far plus error info
      return {
        status: 'error',
        message: 'Error while contacting quiz server',
        error: e.message,
        lastResult
      };
    }
  }

  if (!lastResult) {
    return {
      status: 'no_response',
      message: 'No response received from quiz server before deadline',
      startUrl: startUrl
    };
  }

  return {
    status: 'completed_basic',
    message: 'Basic quiz chain run (dummy answers sent). For full marks you must implement real solving.',
    lastResult
  };
}

// --- Start server ---

app.listen(PORT, () => {
  console.log(`TDS quiz server listening on port ${PORT}`);
});

