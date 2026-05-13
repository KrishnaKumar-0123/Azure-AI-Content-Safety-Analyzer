# AI Shield - Azure AI Content Safety Analyzer

AI Shield is a professional AI-900 project that demonstrates a full-stack Azure AI Content Safety workflow with a Flask backend, animated HTML/CSS/JavaScript frontend, Chart.js analytics, scan history, PDF export, and a cybersecurity-style dashboard.

## Features

- Azure AI Content Safety REST API integration
- Browser-local temporary storage for endpoint and API key
- Text safety analysis for Hate, Self-harm, Sexual, and Violence categories
- Safe or unsafe verdict with severity scores and threat meter
- Dashboard analytics with doughnut, bar, line, and pie charts
- Scan history, search, JSON export, and PDF report export
- Risk heatmap, animated counters, toast notifications, particles, GSAP, and AOS
- Educational AI-900 sections covering responsible AI, moderation, and Azure AI services

## Project Structure

```text
AI-Shield/
  app.py
  requirements.txt
  README.md
  .env.example
  routes/
    api_routes.py
  services/
    azure_content_safety.py
  static/
    css/styles.css
    js/app.js
    images/
  templates/
    index.html
    dashboard.html
```

## Install

```powershell
cd "D:\My C program\AI-Shield"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Configure Azure

You can either paste credentials in the app UI or use environment variables.

1. Create an Azure AI Content Safety resource in the Azure portal.
2. Open the resource and copy the endpoint and key.
3. Copy `.env.example` to `.env`.
4. Set:

```env
AZURE_CONTENT_SAFETY_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com
AZURE_CONTENT_SAFETY_KEY=your_azure_content_safety_key
SECRET_KEY=change_this_for_deployment
```

The UI also supports endpoint and API key entry. Those values are saved only in browser localStorage and sent to the local Flask backend per request.

## Run

```powershell
python app.py
```

Open:

- Analyzer: `http://127.0.0.1:5000/`
- Dashboard: `http://127.0.0.1:5000/dashboard`
- Health check: `http://127.0.0.1:5000/api/health`

## How Azure Content Safety Works Here

The backend calls the Azure REST endpoint:

```text
POST {endpoint}/contentsafety/text:analyze?api-version=2024-09-01
```

Request body:

```json
{
  "text": "content to analyze",
  "categories": ["Hate", "SelfHarm", "Sexual", "Violence"],
  "outputType": "EightSeverityLevels"
}
```

Azure returns severity scores for each category. AI Shield normalizes those scores, calculates the maximum severity, converts it into a threat score, and displays a safe or unsafe verdict.

## AI-900 Relevance

This project maps directly to AI-900 objectives:

- Use prebuilt Azure AI services through REST APIs.
- Explain Azure Cognitive Services and AI service endpoints.
- Demonstrate content moderation and responsible AI.
- Show transparency through severity scores, audit history, and reporting.
- Build a practical AI workflow that combines frontend UX, backend routing, API security, and cloud AI integration.

## Official References

- Azure AI Content Safety overview: https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview
- Analyze Text REST API: https://learn.microsoft.com/en-us/rest/api/contentsafety/text-operations/analyze-text?view=rest-contentsafety-2024-09-01

Images:
<img width="1896" height="952" alt="Screenshot 2026-05-13 203154" src="https://github.com/user-attachments/assets/6eb641f0-bd29-4fc4-a67c-94e8daea88bf" />

<img width="1900" height="955" alt="Screenshot 2026-05-13 203454" src="https://github.com/user-attachments/assets/0039131c-4d7e-4bf0-9f8c-dfa2a8a8855a" />

<img width="1901" height="955" alt="Screenshot 2026-05-13 203631" src="https://github.com/user-attachments/assets/af43e6d2-e2c5-485f-b276-b77ad8de0ed4" />

<img width="1902" height="953" alt="Screenshot 2026-05-13 203834" src="https://github.com/user-attachments/assets/2975b8b3-c545-4b45-907c-d77ffbb169b7" />





