/// <reference types="react-scripts" />

declare module "react-speech-kit";
declare module "web-speech-cognitive-services/lib/SpeechServices/TextToSpeech";
declare module "web-speech-cognitive-services/lib/SpeechServices/SpeechToText";

interface Hypothesis {
  utterance: string;
  confidence: number;
}

interface MySpeechSynthesisUtterance extends SpeechSynthesisUtterance {
  new (s: string);
}

interface MySpeechRecognition extends SpeechRecognition {
  new (s: string);
}

interface Parameters {
  ttsVoice: string;
  ttsLexicon: string;
  asrLanguage: string;
  azureKey: string;
  azureNLUKey: string;
  azureNLUUrl: string;
  azureNLUprojectName: string;
  azureNLUdeploymentName: string;
}

interface ChatInput {
  past_user_inputs: string[];
  generated_responses: string[];
  text: string;
}

interface Settings {
  ttsVoice: string;
  ttsLexicon: string;
  asrLanguage: string;
  azureKey: string;
}

interface SDSContext {
  parameters: Parameters;
  asr: SpeechRecognition;
  tts: SpeechSynthesis;
  voice: SpeechSynthesisVoice;
  ttsUtterance: MySpeechSynthesisUtterance;
  recResult: Hypothesis[];
  ttsAgenda: string;
  azureAuthorizationToken: string;
  audioCtx: any;
  nluResult: any;

  begining: any;
  celeb: any;
  choice: any;
  title: any;
  date: any;
  duration_y: any;
  duration_n: any;
  time: any;
  end: any;
  day: any;
  endline: any;
  information: any;
  appointment: any;
  reprompts: any;
  waitStartTime?: number;
  askCount: any;
  retryCount: any;
  celebrity: any;
  confirmation: any;
  topic: string;
  celeb1: any;
}

type SDSEvent =
  | { type: "TTS_READY" }
  | { type: "TTS_ERROR" }
  | { type: "CLICK" }
  | { type: "SELECT"; value: any }
  | { type: "STARTSPEECH" }
  | { type: "RECOGNISED" }
  | { type: "ASRRESULT"; value: Hypothesis[] }
  | { type: "ENDSPEECH" }
  | { type: "LISTEN" }
  | { type: "TIMEOUT" }
  | { type: "SPEAK"; value: string };


