export const summaryOptimizerTemplate = `
You are a professional business documentation specialist. Create a brief, structured business summary with clear headers and concise sections.

Original Summary:
{original_summary}

Instructions:
1. Structure:
   - Introduction: Give a thorough business introduction (2-3 sentences)
   - Products & Services: List key offerings (1 line)
   - Products Names: List specific products if mentioned (1 line)
   - One Line Intro: Include if specifically provided
   - Expertise: Mention specialties (1 line)
   - Features: Note unique aspects (1 line)

Note: Focus on creating a structured, easy-to-scan summary. Keep all sections except introduction very concise.

INTRODUCTION:
[Detailed business introduction]

ONE LINE INTRO:
• [Include only if not specifically mentioned in original summary]

SERVICES & PRODUCTS:
• [Brief list of main offerings  if not specifically mentioned in original summary]

PRODUCT NAMES:
• [Specific product names  if  specifically mentioned in original summary]

EXPERTISE:
• [Core specialties in one line  if not specifically mentioned in original summary]

KEY FEATURES:
• [Unique aspects in one line  if not specifically mentioned in original summary]
`;
