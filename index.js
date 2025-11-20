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

    // 3. Secret is valid → do basic quiz visit within 3 minutes
    const deadline = Date.now() + 3 * 60 * 1000; // now + 3 minutes

    const result = await basicVisitQuiz({
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

// --- Basic quiz visit logic (no solving yet) ---

async function basicVisitQuiz({ startUrl, email, secret, deadline }) {
  if (Date.now() > deadline) {
    return {
      status: 'deadline_exceeded',
      message: 'Deadline exceeded before contacting quiz server',
      startUrl
    };
  }

  try {
    // "Visit" the quiz page with a GET
    const response = await axios.get(startUrl, { timeout: 15000 });

    return {
      status: 'visited',
      message: 'Visited quiz URL successfully (no solving implemented yet).',
      startUrl,
      httpStatus: response.status
    };
  } catch (e) {
    console.error('Error visiting quiz URL:', e.message);
    return {
      status: 'error',
      message: 'Error while contacting quiz server',
      error: e.message,
      startUrl
    };
  }
}

// --- Start server ---

app.listen(PORT, () => {
  console.log(`TDS quiz server listening on port ${PORT}`);
});
