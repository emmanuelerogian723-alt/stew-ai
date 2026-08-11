#!/bin/bash
# S.T.E.W CLI Usage Examples

# Chat
stew chat "What is the capital of Nigeria?"
stew chat "Latest news in Lagos" --web
stew chat "Write a poem about Africa" --json
stew chat "Summarize this" --raw

# Search
stew search "top Nigerian fintechs 2026"
stew search "weather in Enugu today" --json

# Skills
stew skills
stew skills --category finance
stew skills run generate_cv '{"name":"Emmanuel","role":"Developer"}'
stew skills run currency_rates '{"base":"NGN","target":"USD"}'
stew skills run weather '{"city":"Lagos"}'

# Documents
stew doc pdf '{"title":"Report","content":"This is a report"}' --output report.pdf
stew doc xlsx '{"data":[{"Name":"Emmanuel","Role":"Dev"},{"Name":"Jane","Role":"Designer"}]}' --output team.xlsx
stew doc pptx '{"slides":[{"title":"Q3 Report","content":"Revenue up 40%"}]}' --output slides.pptx

# Fine-tune
stew finetune
stew finetune --persona doctor --instructions "Always cite NHS guidelines"
stew finetune --persona startup --style concise --language pidgin

# Account
stew login stew_your_api_key_here
stew whoami
stew register --name "Emmanuel" --email you@example.com --password secret123
stew logout

# Status
stew status
stew status --json

# Piping
echo "Long article text..." | stew chat "Summarize this article"
cat data.json | stew chat "Analyze this data"
