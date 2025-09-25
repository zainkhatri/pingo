import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "../config/api";
import { motion, AnimatePresence } from "framer-motion";
import AudioVisualizer from "./AudioVisualizer";
import { useRealtime, Scenario } from "../hooks/useRealtime";
import { SCENARIOS, LANGUAGES, Language } from "../config/scenarios";

export default function ChatInterface() {
  const { connect, cleanup, resetState, setScenario, connected, aiSpeaking, setAiSpeaking, pttStart, pttEnd, remoteRef, transcript } = useRealtime();
  const [sel, setSel] = useState<Scenario | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [showScenarioSelect, setShowScenarioSelect] = useState(true);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [accurateTranscript, setAccurateTranscript] = useState<Array<{role: 'user' | 'ai', text: string, timestamp?: string}> | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function handleConnect() {
    setLoading(true);
    try {
      const { remoteStream } = await connect();
      setRemote(remoteStream);
      if (audioRef.current) audioRef.current.srcObject = remoteStream;
      setShowScenarioSelect(false);
      // Timer removed
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect to OpenAI. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // Only set scenario once when connection is first established
  const [scenarioSet, setScenarioSet] = useState(false);
  
  useEffect(() => {
    if (connected && sel && !scenarioSet) {
      setScenario(sel, selectedLanguage || undefined);
      setScenarioSet(true);
    }
  }, [connected, sel, selectedLanguage, setScenario, scenarioSet]);

  // Generate conversation summary
  async function generateSummary() {
    if (!transcript || transcript.length === 0) {
      return "No conversation to summarize.";
    }

    setLoadingSummary(true);
    try {
      // Format the transcript for the AI
      const conversationText = transcript
        .map(msg => `${msg.role === 'ai' ? 'AI' : 'User'}: ${msg.text}`)
        .join('\n');

      const scenarioContext = sel === 'jobInterview' 
        ? 'job interview practice session'
        : sel === 'languageTutor' 
        ? 'language learning session'
        : 'startup pitch practice session';

      // Use helper function for API URL
      const response = await fetch(getApiUrl("/api/summary"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationText,
          scenarioContext
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      return data.summary;
    } catch (error) {
      console.error('Error generating summary:', error);
      return "Unable to generate summary at this time. Your conversation covered valuable practice material!";
    } finally {
      setLoadingSummary(false);
    }
  }

  // Handle ending conversation
  async function handleEndConversation() {
    cleanup(); // Clean up existing connection first
    resetState(); // Reset hook state
    
    if (transcript && transcript.length > 0) {
      // Show summary if there was a conversation
      const summaryText = await generateSummary();
      setSummary(summaryText);
      setShowSummary(true);
    } else {
      // No conversation to summarize, go directly to scenario selection
      setRemote(null);
      setSel(null);
      setSelectedLanguage(null); // Reset language selection
      setScenarioSet(false); // Reset scenario flag for next conversation
      setAccurateTranscript(null); // Reset accurate transcript
      setIsGeneratingTranscript(false); // Reset button animation state
      setIsButtonPressed(false); // Reset button press state
      setShowScenarioSelect(true);
    }
    
    // Reset all component state
    setRemote(null); // Clear remote stream
    setIsUserSpeaking(false); // Reset user speaking state
    setLoading(false); // Reset loading state
  }

  // Handle closing summary and returning to scenario selection
  function handleCloseSummary() {
    setShowSummary(false);
    setSummary('');
    setSel(null); // Reset scenario selection
    setSelectedLanguage(null); // Reset language selection
    setScenarioSet(false); // Reset scenario flag for next conversation
    setAccurateTranscript(null); // Reset accurate transcript
    setIsGeneratingTranscript(false); // Reset button animation state
    setIsButtonPressed(false); // Reset button press state
    setShowScenarioSelect(true); // Show scenario selection screen
  }

  // Generate accurate transcript from the conversation
  async function generateAccurateTranscript() {
    if (!transcript || transcript.length === 0) {
      return;
    }

    setLoadingTranscript(true);
    setShowTranscript(true); // Show the transcript panel when generating
    
    // First, immediately show the basic transcript with timestamps
    const basicTranscript = transcript.map((msg, index) => ({
      ...msg,
      timestamp: new Date(Date.now() - (transcript.length - index) * 30000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }));
    setAccurateTranscript(basicTranscript);
    setLoadingTranscript(false); // Stop loading immediately since we show the basic transcript
    
    try {
      // Send the raw transcript to backend for processing and correction
      // Use helper function for API URL
      const response = await fetch(getApiUrl("/api/transcript/process"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawTranscript: transcript,
          scenarioType: sel
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process transcript');
      }

      const data = await response.json();
      
      // Add timestamps to the processed transcript
      const timestampedTranscript = data.processedTranscript.map((msg: any, index: number) => ({
        ...msg,
        timestamp: new Date(Date.now() - (data.processedTranscript.length - index) * 30000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }));

      setAccurateTranscript(timestampedTranscript);
    } catch (error) {
      console.error('Error processing transcript:', error);
      // Fallback: use the original transcript with timestamps
      const fallbackTranscript = transcript.map((msg, index) => ({
        ...msg,
        timestamp: new Date(Date.now() - (transcript.length - index) * 30000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
      setAccurateTranscript(fallbackTranscript);
      console.log('Using fallback transcript:', fallbackTranscript);
    } finally {
      setLoadingTranscript(false);
      // Add a delay before fading out the button
      setTimeout(() => {
        setIsGeneratingTranscript(false);
      }, 1000); // Fade out after 1 second
    }
  }

  // Remove this - user should be able to interrupt AI at any time

  useEffect(() => {
    if (audioRef.current && remote) {
      console.log('Setting audio source to remote stream', {
        tracks: remote.getTracks().length,
        audioTracks: remote.getAudioTracks().length
      });
      audioRef.current.srcObject = remote;
      audioRef.current.play().catch(e => console.log('Auto-play failed:', e));
    }
  }, [remote]);

  const testAudio = () => {
    if (audioRef.current) {
      console.log('Testing audio playback...');
      console.log('Audio element:', audioRef.current);
      console.log('Source object:', audioRef.current.srcObject);
      console.log('Remote stream:', remote);
      audioRef.current.play().catch(e => console.log('Manual play failed:', e));
    }
  };

  if (showScenarioSelect) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-white overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Choose your scenario</h1>
          </motion.div>
          
          <div className="space-y-3">
            {SCENARIOS.map((s, index) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ 
                  delay: index * 0.1, 
                  duration: 0.3,
                  type: "spring",
                  stiffness: 200,
                  damping: 20
                }}
                whileHover={{ 
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSel(s.id)}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-colors duration-200 ${
                  sel === s.id 
                    ? "bg-[#1F4DFF] text-white border-[#1F4DFF] shadow-lg" 
                    : "border-gray-200 text-gray-900 hover:border-[#1F4DFF] hover:bg-blue-50 hover:shadow-md"
                }`}
              >
                <motion.div 
                  className="font-medium"
                  animate={{
                    color: sel === s.id ? "#ffffff" : "#111827"
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {s.name}
                </motion.div>
                <motion.div 
                  className={`text-sm mt-1 ${
                    sel === s.id ? 'text-blue-100' : 'text-gray-500'
                  }`}
                  animate={{
                    color: sel === s.id ? "#dbeafe" : "#6b7280"
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {s.description}
                </motion.div>
              </motion.button>
            ))}
          </div>

          {/* Language Selection - Show for all scenarios with smooth animation */}
          <AnimatePresence>
            {sel && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -20 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-4 overflow-hidden px-2"
              >
                <motion.h3 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                  className="text-lg font-medium text-gray-900 text-center"
                >
                  Choose Language
                </motion.h3>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.2 }}
                  className="grid grid-cols-2 gap-4 p-2"
                >
                  {LANGUAGES.map((lang, index) => (
                    <motion.button
                      key={lang.code}
                      initial={{ opacity: 0, scale: 0.8, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ 
                        delay: 0.3 + (index * 0.1), 
                        duration: 0.3,
                        type: "spring",
                        stiffness: 200,
                        damping: 20
                      }}
                      whileHover={{ 
                        scale: 1.05,
                        transition: { duration: 0.2 }
                      }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedLanguage(lang.name)}
                      className={`p-4 rounded-xl border-2 text-center transition-colors duration-200 min-h-[80px] flex flex-col justify-center ${
                        selectedLanguage === lang.name
                          ? "bg-[#1F4DFF] text-white border-[#1F4DFF] shadow-lg"
                          : "border-gray-200 text-gray-900 hover:border-[#1F4DFF] hover:bg-blue-50 hover:shadow-md"
                      }`}
                    >
                      <motion.div 
                        className="font-medium text-sm"
                        animate={{
                          color: selectedLanguage === lang.name ? "#ffffff" : "#111827"
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {lang.nativeName}
                      </motion.div>
                      <motion.div 
                        className={`text-xs mt-1 ${
                          selectedLanguage === lang.name ? 'text-blue-100' : 'text-gray-500'
                        }`}
                        animate={{
                          color: selectedLanguage === lang.name ? "#dbeafe" : "#6b7280"
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {lang.name}
                      </motion.div>
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            whileHover={{ 
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConnect}
            disabled={!sel || !selectedLanguage || loading}
            className="w-full py-4 rounded-2xl bg-[#1F4DFF] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            <motion.span
              animate={{
                opacity: loading ? 0.7 : 1
              }}
              transition={{ duration: 0.2 }}
            >
              {loading ? "Connecting..." : "Start Session"}
            </motion.span>
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-end p-4 border-b border-gray-100">
        <button className="p-2 text-gray-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
      </div>

      {/* Main conversation area */}
      <div className="flex-1 flex flex-col justify-center items-center px-8 py-12">
        <div className="w-full max-w-md space-y-12 text-center">
          
          {/* Header text moved above visualizer */}
          <div className="text-base text-gray-600 -mb-8 flex items-center justify-center space-x-6">
            <div><span className="font-medium text-gray-900">You:</span> Friend A</div>
            <div><span className="font-medium text-gray-900">Pingo:</span> Friend B</div>
            
            {/* Document Icon - Generate Transcript */}
            {console.log('🎤 Button state:', {
              loadingTranscript,
              transcriptLength: transcript?.length,
              hasTranscript: !!transcript,
              disabled: loadingTranscript || !transcript || transcript.length === 0
            })}
            <motion.button
              onClick={() => {
                console.log('🎤 Document button clicked!');
                generateAccurateTranscript();
              }}
              onMouseDown={() => {
                console.log('🎤 Document button mouse down');
                setIsButtonPressed(true);
              }}
              onMouseUp={() => {
                console.log('🎤 Document button mouse up');
                setIsButtonPressed(false);
                // Start fade out after a short delay
                setTimeout(() => {
                  console.log('🎤 Starting fade out animation');
                  setIsGeneratingTranscript(true);
                }, 200);
              }}
              onMouseLeave={() => {
                console.log('🎤 Document button mouse leave');
                setIsButtonPressed(false);
                // Start fade out after a short delay
                setTimeout(() => {
                  console.log('🎤 Starting fade out animation (leave)');
                  setIsGeneratingTranscript(true);
                }, 200);
              }}
              disabled={loadingTranscript || !transcript || transcript.length === 0}
              style={{
                pointerEvents: (loadingTranscript || !transcript || transcript.length === 0) ? 'none' : 'auto'
              }}
              className="group relative p-2 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              animate={{
                opacity: isGeneratingTranscript ? 0 : 1,
                scale: isGeneratingTranscript ? 0.8 : (isButtonPressed ? 0.95 : 1),
                y: isGeneratingTranscript ? -10 : 0
              }}
              transition={{
                duration: isGeneratingTranscript ? 0.8 : 0.2,
                ease: "easeInOut"
              }}
              whileHover={{
                scale: isGeneratingTranscript ? 0.8 : 1.05,
                transition: { duration: 0.2 }
              }}
            >
              {/* Document Icon */}
              <div className="w-6 h-7 relative">
                {/* Main document body */}
                <div className="w-full h-full border-2 border-gray-400 rounded-sm relative">
                  {/* Top torn edge */}
                  <div className="absolute -top-1 left-0 right-0 h-1 bg-white">
                    <div className="w-full h-full border-t-2 border-gray-400" style={{
                      clipPath: 'polygon(0% 0%, 10% 100%, 20% 0%, 30% 100%, 40% 0%, 50% 100%, 60% 0%, 70% 100%, 80% 0%, 90% 100%, 100% 0%)'
                    }}></div>
                  </div>
                  
                  {/* Text lines */}
                  <div className="absolute top-1.5 left-0.5 right-0.5 space-y-0.5">
                    <div className="h-0.5 bg-gray-300 w-3/4"></div>
                    <div className="h-0.5 bg-gray-300 w-1/2"></div>
                  </div>
                  
                  {/* Folded corner */}
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-gray-100 border-l-2 border-b-2 border-gray-400 transform rotate-45 origin-bottom-right"></div>
                </div>
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {loadingTranscript ? 'Generating...' : 'Generate Transcript'}
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-t-2 border-t-gray-900 border-l-2 border-r-2 border-l-transparent border-r-transparent"></div>
              </div>
            </motion.button>
          </div>

          {/* Audio Visualizer - this IS the main interaction */}
          <div className="relative flex justify-center">
            <div 
              onMouseDown={() => { 
                console.log('Mouse down - setting isUserSpeaking to true'); 
                pttStart(); 
                setIsUserSpeaking(true); 
              }}
              onMouseUp={() => { 
                console.log('Mouse up - setting isUserSpeaking to false'); 
                pttEnd(); 
                setIsUserSpeaking(false); 
              }}
              onMouseLeave={() => { 
                console.log('Mouse leave - setting isUserSpeaking to false'); 
                pttEnd(); 
                setIsUserSpeaking(false); 
              }}
              onTouchStart={() => { 
                console.log('Touch start - setting isUserSpeaking to true'); 
                pttStart(); 
                setIsUserSpeaking(true); 
              }}
              onTouchEnd={() => { 
                console.log('Touch end - setting isUserSpeaking to false'); 
                pttEnd(); 
                setIsUserSpeaking(false); 
              }}
              onTouchCancel={() => { 
                console.log('Touch cancel - setting isUserSpeaking to false'); 
                pttEnd(); 
                setIsUserSpeaking(false); 
              }}
              className="cursor-pointer select-none"
              style={{ pointerEvents: connected ? 'auto' : 'none' }}
            >
              <AudioVisualizer 
                stream={remote} 
                onSpeaking={setAiSpeaking}
                isUserSpeaking={isUserSpeaking}
                connected={connected}
                aiSpeaking={aiSpeaking}
              />
            </div>
            
            {/* Fixed position tap to interrupt - no layout shift */}
            <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
              <div className={`text-gray-500 text-sm transition-opacity duration-300 ${
                aiSpeaking ? 'opacity-100' : 'opacity-0'
              }`}>
                Tap to interrupt
              </div>
            </div>
          </div>

          {/* End conversation button */}
          <div className="space-y-4 pt-8">
            <button 
              onClick={handleEndConversation}
              disabled={loadingSummary}
              className="px-8 py-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              {loadingSummary ? 'Generating Summary...' : 'End & Get Summary'}
            </button>
          </div>
        </div>
      </div>


      {/* Backdrop overlay */}
      {showTranscript && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-20 z-20"
          onClick={() => setShowTranscript(false)}
        />
      )}

      {/* Transcript Panel - Slides in from right */}
      <div className={`fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-100 p-4 overflow-y-auto transform transition-transform duration-300 ease-in-out z-30 ${
        showTranscript ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversation Transcript</h2>
          <button
            onClick={() => setShowTranscript(false)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        {accurateTranscript && accurateTranscript.length > 0 ? (
          <div className="space-y-4">
            {accurateTranscript.map((msg, i) => (
              <div key={i} className={`p-3 rounded-lg ${msg.role === 'ai' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <div className="font-medium mb-1 flex items-center justify-between">
                  <span>{msg.role === 'ai' ? 'Pingo' : 'You'}</span>
                  {msg.timestamp && (
                    <span className="text-xs text-gray-500">{msg.timestamp}</span>
                  )}
                </div>
                <div className="text-gray-700">{msg.text}</div>
              </div>
            ))}
          </div>
        ) : loadingTranscript ? (
          <div className="text-center text-gray-500 py-8">
            <div className="mb-2">⏳</div>
            <p className="text-sm">Generating accurate transcript...</p>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <div className="mb-2">📝</div>
            <p className="text-sm">Click the document icon to generate a transcript</p>
          </div>
        )}
      </div>


      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Session Summary</h2>
              <div className="text-sm text-gray-600">
                {sel === 'jobInterview' && 'Job Interview Practice'}
                {sel === 'languageTutor' && 'Language Learning Session'}
                {sel === 'founderMock' && 'Startup Pitch Practice'}
              </div>
            </div>
            
            {loadingSummary ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F4DFF]"></div>
                <span className="ml-2 text-gray-600">Generating summary...</span>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{summary}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button 
                onClick={handleCloseSummary}
                disabled={loadingSummary}
                className="flex-1 py-3 px-4 rounded-lg bg-[#1F4DFF] text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )}

      <audio 
        ref={audioRef} 
        autoPlay 
        playsInline 
        controls={false}
        style={{ display: 'none' }}
        onLoadedData={() => console.log('Audio loaded')}
        onPlay={() => console.log('Audio started playing')}
        onError={(e) => console.log('Audio error:', e)}
      />
    </div>
  );
}
