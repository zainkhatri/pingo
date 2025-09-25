import { useRef, useState } from "react";
import { getScenarioConfig, formatInstructions, Language } from "../config/scenarios";
import { getApiUrl } from "../config/api";

export type Scenario = "jobInterview" | "languageTutor" | "founderMock";

export function useRealtime() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const eventsRef = useRef<RTCDataChannel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const greetingSentRef = useRef<boolean>(false); // Track if greeting was already sent
  const ignoreOpenAIAudioRef = useRef<boolean>(false); // Flag to ignore OpenAI audio processing

  const [connected, setConnected] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false); // Start as false - wait for user to initiate
  const [transcript, setTranscript] = useState<Array<{role: 'user' | 'ai', text: string}>>([]);

  // Send a Blob (webm) to OpenAI and get text back
  async function transcribeAudio(blob: Blob): Promise<string> {
    const form = new FormData();
    form.append("file", blob, "speech.webm");
    form.append("model", "whisper-1");

    // Use helper function for API URL
    const res = await fetch(getApiUrl("/api/openai/audio/transcriptions"), {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("transcription failed");
    const data = await res.json();
    return data.text;
  }

  async function connect() {
    console.log('Starting connection...');
    // Use helper function for API URL
    const session = await fetch(getApiUrl("/api/session")).then(r => r.json());
    const token: string | undefined = session?.client_secret?.value;
    if (!token) throw new Error("No ephemeral token");

    console.log('Got token, creating peer connection...');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    // remote audio to a MediaStream
    const remote = new MediaStream();
    remoteRef.current = remote;
    pc.ontrack = e => {
      console.log('Received remote track:', e.track.kind);
      remote.addTrack(e.track);
      
      // Force audio to play immediately
      setTimeout(() => {
        const audioElement = document.querySelector('audio');
        if (audioElement && audioElement.srcObject !== remote) {
          audioElement.srcObject = remote;
          audioElement.play().catch(e => console.log('Audio play failed:', e));
        }
      }, 100);
    };

    // mic off by default; push-to-talk will enable
    // IMPORTANT: We add tracks to satisfy WebRTC requirements but disable processing via session config
    console.log('Getting microphone access...');
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    micRef.current = mic;
    mic.getTracks().forEach(t => {
      t.enabled = false;
      pc.addTrack(t, mic);  // Add tracks for WebRTC compatibility but disable via session config
    });

    // optional data channel for control events; transcripts later
    const dc = pc.createDataChannel("oai-events");
    eventsRef.current = dc;
    
    dc.onopen = () => {
      console.log('Data channel opened');
      // Emit connected state to trigger scenario setup
      setConnected(true);
    };
    
    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received message from OpenAI:', message.type, message);
        
        if (message.type === 'response.audio.delta') {
          console.log('🎵 AI is speaking - audio delta received');
          setAiSpeaking(true); // AI is actively sending audio
        } else if (message.type === 'response.audio_transcript.delta') {
          console.log('🎤 AI transcript delta - still speaking');
          setAiSpeaking(true); // Make sure we stay in speaking state
          // Add to transcript
          console.log('Full message:', message);
          console.log('Delta object:', message.delta);
          
          // The delta is actually a string, not an object!
          const text = message.delta;
          
          console.log('Extracted text:', text);
          if (text) {
            console.log('🤖 AI transcript delta:', text);
            
            // AGGRESSIVE HALLUCINATION DETECTION: Check if AI is referencing things user never said
            const userMessages = transcript.filter(msg => msg.role === 'user').map(msg => msg.text.toLowerCase());
            const allUserText = userMessages.join(' ');
            const lastUserMessage = userMessages[userMessages.length - 1] || '';
            
            // Flag potential hallucination patterns
            const suspiciousPatterns = [
              'thanks for sharing that',
              'impressive that you',
              'you mentioned',
              'you talked about',
              'you said',
              'you worked on',
              'your experience with',
              'node.js',
              'backend',
              'javascript',
              'programming',
              'development',
              'coding',
              'technical',
              'automation',
              'scripts',
              'apis'
            ];
            
            // Check if user asked to end interview but AI ignored it
            const userWantsToEnd = lastUserMessage.includes('end') || 
                                 lastUserMessage.includes('over') || 
                                 lastUserMessage.includes('finish') ||
                                 lastUserMessage.includes('done');
            const aiIgnoredEndRequest = userWantsToEnd && 
                                      (textLower.includes('?') || 
                                       textLower.includes('how') || 
                                       textLower.includes('what') ||
                                       textLower.includes('do you'));
            
            if (aiIgnoredEndRequest) {
              console.error('🚨 AI IGNORED USER REQUEST TO END INTERVIEW!');
              console.error('🚨 User said:', lastUserMessage);
              console.error('🚨 But AI continued with:', text);
            }
            
            // Check if user mentioned violence but AI inappropriately agreed or encouraged it
            const violentTerms = ['hit', 'hitting', 'punch', 'fight', 'violence', 'violent', 'attack', 'hurt', 'harm', 'stab', 'kill'];
            const userMentionedViolence = violentTerms.some(term => lastUserMessage.includes(term));
            const inappropriateAgreement = ['that sounds good', 'great approach', 'i understand', 'that makes sense', 'good strategy', 'i see', 'interesting'];
            const aiInappropriatelyAgreed = userMentionedViolence && 
                                          inappropriateAgreement.some(phrase => textLower.includes(phrase)) &&
                                          !textLower.includes('not okay') && 
                                          !textLower.includes('unacceptable') &&
                                          !textLower.includes('concerning');
            
            if (aiInappropriatelyAgreed) {
              console.error('🚨 AI INAPPROPRIATELY AGREED WITH VIOLENCE!');
              console.error('🚨 User mentioned violence:', lastUserMessage);
              console.error('🚨 AI should have condemned it, but said:', text);
            }
            
            // Check for tech assumptions when user mentioned non-tech work
            const nonTechJobs = ['mcdonalds', 'mcdonald\'s', 'fast food', 'retail', 'restaurant', 'cashier', 'server'];
            const userMentionedNonTech = nonTechJobs.some(job => allUserText.includes(job));
            const techTerms = ['node', 'backend', 'programming', 'development', 'technical', 'javascript', 'coding'];
            const aiMentionedTech = techTerms.some(term => text.toLowerCase().includes(term));
            
            const textLower = text.toLowerCase();
            const isPotentialHallucination = (
              suspiciousPatterns.some(pattern => textLower.includes(pattern)) && 
              (lastUserMessage.length < 30 || lastUserMessage.includes('hello'))
            ) || (
              userMentionedNonTech && aiMentionedTech
            ) || (
              aiIgnoredEndRequest
            ) || (
              aiInappropriatelyAgreed
            );
            
            if (isPotentialHallucination) {
              console.error('🚨 POTENTIAL HALLUCINATION DETECTED!');
              console.error('🚨 AI said:', text);
              console.error('🚨 But user said:', allUserText);
              console.error('🚨 This suggests the AI is making assumptions!');
              
              // If user mentioned non-tech but AI mentioned tech, this is a clear hallucination
              if (userMentionedNonTech && aiMentionedTech) {
                console.error('🚨 CRITICAL: User mentioned non-tech work but AI assumed tech background!');
              }
            }
            
            setTranscript(prev => {
              const lastMessage = prev[prev.length - 1];
              const newTranscript = lastMessage?.role === 'ai' 
                ? [...prev.slice(0, -1), { ...lastMessage, text: (lastMessage.text || '') + (text || '') }]
                : [...prev, { role: 'ai', text: text || '' }];
              console.log('🤖 AI updated transcript:', newTranscript);
              return newTranscript;
            });
          }
        } else if (message.type === 'response.done') {
          console.log('✅ AI response completed - but waiting for audio to finish');
          // Don't set aiSpeaking to false here - wait for output_audio_buffer.stopped
        } else if (message.type === 'response.audio_transcript.done') {
          console.log('🎤 AI finished speaking (transcript done)');
          // Don't set aiSpeaking to false here - wait for output_audio_buffer.stopped
        } else if (message.type === 'output_audio_buffer.stopped') {
          console.log('🔇 Audio buffer stopped - AI truly finished speaking');
          setAiSpeaking(false); // AI finished speaking
        } else if (message.type === 'response.output_item.added') {
          console.log('📝 AI output item added');
        } else if (message.type === 'response.created') {
          console.log('🚀 AI response started');
          setAiSpeaking(true); // AI started responding
        } else if (message.type === 'conversation.item.input_audio_transcription.completed') {
          // IGNORE OpenAI's transcription - we use our own Whisper transcription
          if (ignoreOpenAIAudioRef.current) {
            console.log('🚫 Ignoring OpenAI transcription - using our Whisper transcription instead');
            return;
          }
        } else if (message.type === 'input_audio_buffer.speech_started') {
          // IGNORE - we don't use OpenAI's built-in speech detection anymore
          console.log('🚫 Ignoring OpenAI speech detection - using Whisper instead');
        } else if (message.type === 'input_audio_buffer.speech_stopped') {
          // IGNORE - we don't use OpenAI's built-in speech detection anymore
          console.log('🚫 Ignoring OpenAI speech stopped - using Whisper instead');
        } else if (message.type.startsWith('input_audio_buffer')) {
          // IGNORE all input audio buffer events - we handle audio locally
          console.log('🚫 Ignoring OpenAI audio buffer event:', message.type);
        } else if (message.type === 'response.cancelled') {
          console.log('🛑 AI response cancelled');
          setAiSpeaking(false);
        } else if (message.type === 'output_audio_buffer.cleared') {
          console.log('🔇 Audio buffer cleared - AI stopped');
          setAiSpeaking(false);
        } else if (message.type === 'error') {
          console.error('⚠️ OpenAI error:', message);
          console.error('⚠️ Error details:', JSON.stringify(message.error, null, 2));
          // If there's an error during interruption, still set AI as not speaking
          if (message.error && message.error.type === 'invalid_request_error') {
            setAiSpeaking(false);
          }
        }
      } catch (error) {
        console.log('Received non-JSON message:', event.data);
      }
    };
    
    dc.onclose = () => {
      console.log('Data channel closed');
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('Created offer, sending to OpenAI...');

    const r = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp"
      },
      body: offer.sdp as string
    });

    if (!r.ok) {
      const errorText = await r.text();
      console.error('OpenAI WebRTC error:', errorText);
      throw new Error(`OpenAI WebRTC failed: ${r.status} ${errorText}`);
    }

    const answer = await r.text();
    console.log('Got answer from OpenAI, setting remote description...');
    await pc.setRemoteDescription({ type: "answer", sdp: answer });

    pc.onconnectionstatechange = () => {
      console.log('Connection state changed:', pc.connectionState);
      // We'll set connected state in the data channel onopen handler instead
      if (pc.connectionState !== "connected") {
        setConnected(false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    return { remoteStream: remote };
  }

  function setScenario(sc: Scenario, selectedLanguage?: Language) {
    const dc = eventsRef.current;
    if (!dc || dc.readyState !== 'open') {
      console.log('Data channel not ready, skipping scenario update');
      return;
    }
    
    try {
      console.log('Updating scenario instructions:', sc, 'in language:', selectedLanguage);
      
      // Map languages to appropriate voices
      const voiceMap = {
        'English': 'alloy',
        'Spanish': 'echo', 
        'Mandarin': 'shimmer',
        'Arabic': 'coral'
      };
      
      const selectedVoice = voiceMap[selectedLanguage || 'English'];
      
      // Simple session update with just the basics
      dc.send(JSON.stringify({
        type: "session.update",
        session: {
          instructions: `CRITICAL: You must speak EXCLUSIVELY in ${selectedLanguage || 'English'}. You are conducting a ${sc}. Do not use any other language under any circumstances. Your first message should be a simple greeting in ${selectedLanguage || 'English'} asking the user to introduce themselves.`,
          voice: selectedVoice,
          temperature: 0.6,
          turn_detection: null,
          input_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1"
          }
        }
      }));

      // Simple greeting trigger
      if (!greetingSentRef.current) {
        console.log('🎤 Triggering greeting...');
        setTimeout(() => {
          if (dc.readyState === 'open') {
            dc.send(JSON.stringify({
              type: "response.create"
            }));
            greetingSentRef.current = true;
            console.log('🎤 AI greeting request sent');
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('Failed to send scenario update:', error);
    }
  }

  function pttStart() {
    console.log('Push-to-talk started');
    
    // Set flag to ignore any OpenAI audio processing during our recording
    ignoreOpenAIAudioRef.current = true;
    
    // If AI is currently speaking, interrupt it AGGRESSIVELY
    const dc = eventsRef.current;
    if (dc && dc.readyState === 'open' && aiSpeaking) {
      console.log('Interrupting AI speech...');
      try {
        // Send interruption commands only if AI is actually speaking
        dc.send(JSON.stringify({
          type: "response.cancel"
        }));
        // Also clear the output audio buffer
        dc.send(JSON.stringify({
          type: "output_audio_buffer.clear"
        }));
        // Force AI speaking state to false immediately
        setAiSpeaking(false);
        console.log('AI interruption commands sent');
      } catch (error) {
        console.log('Error sending interruption commands:', error);
      }
    } else if (dc && dc.readyState === 'open') {
      console.log('AI not speaking, no need to interrupt');
    }
    
    micRef.current?.getAudioTracks().forEach(t => {
      t.enabled = true;
      console.log('Enabled microphone track');
    });

    // Start recording
    if (micRef.current) {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(micRef.current, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    }
  }

  const processingRequestRef = useRef<boolean>(false);

  async function pttEnd() {
    console.log('Push-to-talk ended');
    micRef.current?.getAudioTracks().forEach(t => {
      t.enabled = false;
      console.log('Disabled microphone track');
    });

    // Prevent duplicate processing
    if (processingRequestRef.current) {
      console.log('🚫 Already processing a request, skipping...');
      return;
    }

    // Stop recording and transcribe FIRST, then send to AI
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      return new Promise<void>((resolve) => {
        mediaRecorderRef.current!.onstop = async () => {
          if (processingRequestRef.current) {
            console.log('🚫 Already processing, skipping duplicate...');
            resolve();
            return;
          }
          
          processingRequestRef.current = true;
          
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          try {
            const text = await transcribeAudio(blob);
            console.log('🎤 USER ACTUALLY SAID:', text);
            console.log('🎤 Length of audio blob:', blob.size, 'bytes');
            
            // Update transcript with actual user speech
            setTranscript(prev => {
              const lastMessage = prev[prev.length - 1];
              const newTranscript = lastMessage?.role === 'user' && lastMessage.text === ''
                ? [...prev.slice(0, -1), { ...lastMessage, text }]
                : [...prev, { role: 'user', text }];
              console.log('🎤 Updated user transcript:', newTranscript);
              return newTranscript;
            });

            // NOW send the accurate transcription to OpenAI via text input
            const dc = eventsRef.current;
            if (dc && dc.readyState === 'open' && text.trim()) {
              console.log('🎤 Sending accurate transcription to AI:', text);
              
              // Send user message as conversation item first
              dc.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "user",
                  content: [{
                    type: "input_text",
                    text: text
                  }]
                }
              }));

              // Then request AI response
              setTimeout(() => {
                if (dc.readyState === 'open') {
                  console.log('🎤 Requesting AI response to accurate transcription...');
                  dc.send(JSON.stringify({
                    type: "response.create"
                  }));
                  
                  // Reset processing flag after response is requested
                  setTimeout(() => {
                    processingRequestRef.current = false;
                  }, 1000);
                }
              }, 100);
            } else {
              processingRequestRef.current = false;
            }
          } catch (error) {
            console.error('Transcription failed:', error);
            processingRequestRef.current = false;
          }
          
          // Reset the flag after processing our transcription
          ignoreOpenAIAudioRef.current = false;
          resolve();
        };
        mediaRecorderRef.current!.stop();
      });
    }
  }

  function cleanup() {
    console.log('🧹 HARD RESET - Cleaning up connection to prevent AI hallucination...');
    
    // Cancel any ongoing AI response AND clear conversation history
    const dc = eventsRef.current;
    if (dc && dc.readyState === 'open') {
      console.log('🧹 Cancelling AI response and clearing conversation history...');
      try {
        // Clear conversation history to prevent hallucination
        dc.send(JSON.stringify({ type: "conversation.item.truncate", item_id: null }));
        dc.send(JSON.stringify({ type: "response.cancel" }));
        dc.send(JSON.stringify({ type: "output_audio_buffer.clear" }));
        console.log('🧹 Sent conversation reset commands');
      } catch (error) {
        console.log('Error sending reset commands:', error);
      }
    }
    
    // Close data channel
    if (eventsRef.current) {
      eventsRef.current.close();
      eventsRef.current = null;
    }
    
    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    // Stop microphone tracks
    if (micRef.current) {
      micRef.current.getTracks().forEach(track => track.stop());
      micRef.current = null;
    }
    
    // Stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    // Clear any recorded chunks
    chunksRef.current = [];
    
    // Reset all flags
    greetingSentRef.current = false; // Reset greeting flag to ensure new conversation starts with greeting
    ignoreOpenAIAudioRef.current = false; // Reset ignore flag for audio processing
    processingRequestRef.current = false; // Reset processing flag
    
    console.log('🧹 HARD RESET completed - AI memory should be cleared');
  }

  // Function to reset state - called by component
  function resetState() {
    setConnected(false);
    setAiSpeaking(false); // Reset to waiting state
    setTranscript([]);
    greetingSentRef.current = false; // Reset greeting flag for new conversation
  }

  return {
    connect,
    cleanup,
    resetState,
    setScenario,
    connected,
    aiSpeaking,
    setAiSpeaking,
    pttStart,
    pttEnd,
    remoteRef,
    transcript
  };
}