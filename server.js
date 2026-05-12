require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;
const PORT = process.env.PORT || 3000;

// Issue type map (from KAN project)
const ISSUE_TYPE_MAP = {
  'task': '10003',
  'incident': '10004',
  'service request': '10005',
  'support': '10006',
  'epic': '10001',
};

app.post('/api/create-ticket', async (req, res) => {
  try {
    const data = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    // Extract fields from the user's simplified JSON
    const summary = data.title || data.summary || 'Untitled ticket';
    const description = data.description || '';
    const priority = data.priority || 'Medium';
    const issueTypeName = (data.category || data.issuetype || 'Task').toLowerCase();
    const issueTypeId = ISSUE_TYPE_MAP[issueTypeName] || '10003'; // default: Task

    // Build Jira Cloud API v3 payload
    const jiraPayload = {
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        summary: summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: description }]
            }
          ]
        },
        issuetype: { id: issueTypeId },
      }
    };

    // Add labels if provided
    if (data.labels) {
      jiraPayload.fields.labels = Array.isArray(data.labels) ? data.labels : [data.labels];
    }

    // Call Jira Cloud REST API
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(jiraPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Jira API error',
        details: result,
      });
    }

    // Return success with ticket URL
    const issueKey = result.key;
    const ticketUrl = `${JIRA_BASE_URL}/browse/${issueKey}`;

    res.json({
      success: true,
      key: issueKey,
      id: result.id,
      url: ticketUrl,
      self: result.self,
    });

  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
