import OpenAI from 'openai';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TranscriptSummarizerService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async summarizeTranscript(transcript: Array<{ role: string; transcript: string; time: string }>) {
        try {
            const stats = {
                userMessageCount: transcript.filter(t => t.role === 'user').length,
                aiMessageCount: transcript.filter(t => t.role === 'ai').length,
                totalMessages: transcript.length
            };

            const formattedTranscript = transcript
                .map(t => t.transcript)
                .join('\n');

            // Technical analysis for metadata
            const technicalResponse = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Analyze the conversation technically and return ONLY a raw JSON object without any formatting.
                        Include detailed escalation analysis in the response. The JSON structure should be:
                        {
                            "topics": [],
                            "userRequests": [],
                            "actionsTaken": [],
                            "satisfaction": {"level": "", "indicators": []},
                            "businessInquiries": [],
                            "goalsAchieved": true/false,
                            "followUpNeeded": true/false,
                            "followUpActions": [],
                            "userIntent": {"primary": "", "secondary": [], "context": ""},
                            "urgencyAssessment": {"level": "", "reason": "", "requiresImmediateAction": true/false},
                            "escalationAnalysis": {
                                "wasEscalated": true/false,
                                "reason": "",
                                "timestamp": "",
                                "urgencyLevel": "low/medium/high/critical",
                                "customerState": ""
                            }
                        }`
                    },
                    {
                        role: 'user',
                        content: formattedTranscript
                    }
                ],
                temperature: 0.3,
            });

            // Narrative summary focused on key points
            const narrativeResponse = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Provide a clear, natural summary of this call conversation. 
                        Write it as a normal paragraph that explains ONLY what is explicitly present in the transcript:
                        - What the customer called about (only if explicitly stated)
                        - How the conversation went based STRICTLY on the messages exchanged
                        - What was actually resolved or decided in the conversation
                        - Any next steps or follow-ups explicitly mentioned
                        
                        IMPORTANT:
                        - DO NOT invent or hallucinate ANY details not present in the transcript
                        - If the transcript is very short or incomplete, state that there is limited information
                        - If only greetings were exchanged, simply state that
                        - If the customer never responded, state that clearly
                        
                        Keep it simple and conversational, like you're briefing a manager.
                        Mention if the call needed human escalation.
                        Don't use any special formatting or structure.
                        Limit to 2-3 sentences maximum.`
                    },
                    {
                        role: 'user',
                        content: formattedTranscript
                    }
                ],
                temperature: 0.3,
            });

            // Parse technical response with error handling
            let analysis;
            try {
                const cleanJson = technicalResponse.choices[0].message.content.trim()
                    .replace(/^```json\s*/, '')
                    .replace(/```$/, '');
                analysis = JSON.parse(cleanJson);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                analysis = {
                    topics: [],
                    userRequests: [],
                    actionsTaken: [],
                    satisfaction: { level: 'unknown', indicators: [] },
                    businessInquiries: [],
                    goalsAchieved: false,
                    followUpNeeded: false,
                    followUpActions: [],
                    userIntent: { primary: '', secondary: [], context: '' },
                    urgencyAssessment: { level: 'normal', reason: '', requiresImmediateAction: false },
                    escalationAnalysis: {
                        wasEscalated: false,
                        reason: '',
                        timestamp: '',
                        urgencyLevel: 'low',
                        customerState: 'normal'
                    }
                };
            }

            // Parse narrative response without JSON structure
            const summary = narrativeResponse.choices[0].message.content.trim();

            return {
                summary: summary,
                metadata: {
                    ...stats,
                    summarizedAt: new Date().toISOString(),
                    escalation: analysis.escalationAnalysis || {
                        wasEscalated: false,
                        reason: '',
                        urgencyLevel: 'low',
                        customerState: 'normal'
                    },
                    technicalAnalysis: {
                        topics: analysis.topics || [],
                        userRequests: analysis.userRequests || [],
                        actionsTaken: analysis.actionsTaken || [],
                        satisfaction: analysis.satisfaction || { level: 'unknown', indicators: [] },
                        businessInquiries: analysis.businessInquiries || [],
                        goalsAchieved: analysis.goalsAchieved || false,
                        followUpNeeded: analysis.followUpNeeded || false,
                        followUpActions: analysis.followUpActions || [],
                        userIntent: analysis.userIntent || { primary: '', secondary: [], context: '' },
                        urgencyAssessment: analysis.urgencyAssessment || { 
                            level: 'normal', 
                            reason: '', 
                            requiresImmediateAction: false 
                        }
                    }
                }
            };
        } catch (error) {
            console.error('Error summarizing transcript:', error);
            throw new Error('Failed to summarize transcript');
        }
    }
}
