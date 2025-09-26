import { useEffect, useRef, useState } from "react";
import PingoRing from "./PingoRing";

export default function AudioVisualizer({
  stream,
  onSpeaking,
  isUserSpeaking = false,
  connected = false,
  aiSpeaking = false,
  hasAiSpokenOnce = false
}: {
  stream: MediaStream | null;
  onSpeaking?: (speaking: boolean) => void;
  isUserSpeaking?: boolean;
  connected?: boolean;
  aiSpeaking?: boolean;
  hasAiSpokenOnce?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationStateRef = useRef<'connecting' | 'ai-speaking' | 'user-speaking'>('connecting');
  const barHeightsRef = useRef<number[]>([120, 120, 120, 120]); // Smooth interpolation targets
  const currentBarHeightsRef = useRef<number[]>([120, 120, 120, 120]); // Current animated values

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let raf = 0;
    
    // Get fresh audio data to check if AI is actually still speaking
    let hasAudioActivity = false;
    
    // Set up persistent audio analysis for the AI's audio stream first
    if (stream && connected && !((canvas as any).audioContext)) {
      // Clean up any existing audio context
      if ((canvas as any).audioContext) {
        try {
          (canvas as any).source?.disconnect();
          (canvas as any).audioContext.close();
        } catch (e) {
          console.log('Audio cleanup failed:', e);
        }
      }
      try {
        (canvas as any).audioContext = new AudioContext();
        
        // Ensure AudioContext is resumed (required by browsers)
        if ((canvas as any).audioContext.state === 'suspended') {
          (canvas as any).audioContext.resume().then(() => {
            console.log('AudioContext resumed');
          });
        }
        
        (canvas as any).source = (canvas as any).audioContext.createMediaStreamSource(stream);
        (canvas as any).analyser = (canvas as any).audioContext.createAnalyser();
        (canvas as any).analyser.fftSize = 2048; // Higher resolution for better frequency analysis
        (canvas as any).analyser.smoothingTimeConstant = 0.4; // Balanced smoothing - responsive but not jittery
        (canvas as any).analyser.minDecibels = -90;
        (canvas as any).analyser.maxDecibels = -10;
        (canvas as any).source.connect((canvas as any).analyser);
        console.log('Audio analyzer connected to AI stream', {
          sampleRate: (canvas as any).audioContext.sampleRate,
          fftSize: (canvas as any).analyser.fftSize,
          frequencyBinCount: (canvas as any).analyser.frequencyBinCount
        });
      } catch (e) {
        console.log('Audio analysis setup failed:', e);
      }
    }

    // Now check audio activity if analyzer is set up
    if (stream && connected) {
      try {
        // Ensure we have all required audio components
        if ((canvas as any).audioContext && 
            (canvas as any).source && 
            (canvas as any).analyser) {
          const dataArray = new Uint8Array((canvas as any).analyser.frequencyBinCount);
          (canvas as any).analyser.getByteFrequencyData(dataArray);
          const avgVolume = Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length;
          hasAudioActivity = avgVolume > 5; // Threshold for audio activity
        }
      } catch (e) {
        console.log('Audio analysis failed:', e);
      }
    }

    // Determine current state - only 3 states now
    let currentState: 'connecting' | 'ai-speaking' | 'user-speaking';
    if (!connected) {
      currentState = 'connecting';
    } else if (isUserSpeaking) {
      // User speaking - show blue circle with rotating line (this overrides everything)
      currentState = 'user-speaking';
    } else {
      // Default to frequency bars (AI speaking or waiting)
      currentState = 'ai-speaking';
    }
    
    animationStateRef.current = currentState;
    
    // No circle animation here - handled by Framer Motion
    
    // Audio context setup is now handled at the start of the effect

    function animate() {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      // High DPI support for crisp rendering
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width * dpr;
      const h = rect.height * dpr;
      
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Enable anti-aliasing for smooth edges
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const time = Date.now() / 1000;
      
      // Get fresh audio data on every frame if we have an analyzer
      let currentAudioData: Uint8Array | null = null;
      if (stream && connected) {
        try {
          // Ensure we have all required audio components
          if ((canvas as any).audioContext && 
              (canvas as any).source && 
              (canvas as any).analyser) {
            const dataArray = new Uint8Array((canvas as any).analyser.frequencyBinCount);
            (canvas as any).analyser.getByteFrequencyData(dataArray);
            currentAudioData = dataArray;
          
          // Debug logging every 2 seconds
          if (!(canvas as any).debugCounter) (canvas as any).debugCounter = 0;
          (canvas as any).debugCounter++;
          if ((canvas as any).debugCounter % 120 === 0) { // Every 2 seconds at 60fps
            const avgVolume = Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length;
            const maxVolume = Math.max(...dataArray);
            console.log('🎵 VISUAL STATE:', { 
              currentState: animationStateRef.current, 
              aiSpeaking,
              isUserSpeaking,
              connected,
              avgVolume, 
              maxVolume, 
              hasAudioData: dataArray.length > 0,
              note: isUserSpeaking ? 'User speaking -> show blue circle' : 'Default -> show frequency bars',
              hasAudioActivity
            });
          }
          }
        } catch (e) {
          console.log('Failed to get fresh audio data:', e);
        }
      }
      
      switch (animationStateRef.current) {
        case 'connecting':
          drawConnectingState(ctx, rect.width, rect.height, time);
          break;
          
        case 'ai-speaking':
          drawAiSpeakingState(ctx, rect.width, rect.height, centerX, centerY, time, currentAudioData);
          break;
          
        case 'user-speaking':
          drawUserSpeakingState(ctx, centerX, centerY, time);
          break;
      }
      
      raf = requestAnimationFrame(animate);
    }
    
    function drawConnectingState(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
      const colors = ["#1F4DFF", "#FF6F6F", "#FFD400", "#1F4DFF"];
      const barWidth = 80;
      const barSpacing = 15;
      const totalWidth = (barWidth * 4) + (barSpacing * 3);
      const startX = (w - totalWidth) / 2;
      
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        const x = startX + (i * (barWidth + barSpacing));
        
        // Static bars when connecting - no fake animation
        const baseHeight = 120;
        const y = (h - baseHeight) / 2;
        
        drawRoundedRect(ctx, x, y, barWidth, baseHeight, 30);
      });
    }
    
    function drawUserSpeakingState(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, time: number) {
      // Empty - user speaking state is now handled by PingoRing
    }

    function drawAiSpeakingState(ctx: CanvasRenderingContext2D, w: number, h: number, centerX: number, centerY: number, time: number, audioData: Uint8Array | null) {
      const colors = ["#1F4DFF", "#FF6F6F", "#FFD400", "#1F4DFF"];
      const barWidth = 80;
      const barSpacing = 15;
      const totalWidth = (barWidth * 4) + (barSpacing * 3);
      const startX = (w - totalWidth) / 2;
      
      // Update target heights ONLY based on real audio frequency data
      if (audioData && audioData.length > 0) {
        const totalFreqs = audioData.length;
        
        for (let i = 0; i < 4; i++) {
          let freqStart, freqEnd;
          
          switch (i) {
            case 0: // Low frequencies (0-15%) - bass/fundamental
              freqStart = Math.floor(totalFreqs * 0.02); // Skip DC component
              freqEnd = Math.floor(totalFreqs * 0.15);
              break;
            case 1: // Low-mid frequencies (15-40%) - vocals/harmonics
              freqStart = Math.floor(totalFreqs * 0.15);
              freqEnd = Math.floor(totalFreqs * 0.4);
              break;
            case 2: // Mid-high frequencies (40-70%) - consonants/clarity
              freqStart = Math.floor(totalFreqs * 0.4);
              freqEnd = Math.floor(totalFreqs * 0.7);
              break;
            case 3: // High frequencies (70-85%) - sibilants/presence
              freqStart = Math.floor(totalFreqs * 0.7);
              freqEnd = Math.floor(totalFreqs * 0.85);
              break;
          }
          
          // Calculate average amplitude for this frequency range
          let sum = 0;
          for (let j = freqStart; j < freqEnd; j++) {
            sum += audioData[j] || 0;
          }
          const avgAmplitude = sum / (freqEnd - freqStart);
          
          // Simple linear scaling - no fake animations
          const normalizedAmp = avgAmplitude / 255;
          let targetHeight = 80 + normalizedAmp * 120; // 80-200px range for better proportions
          
          // Clamp to reasonable bounds
          targetHeight = Math.max(80, Math.min(200, targetHeight));
          
          barHeightsRef.current[i] = targetHeight;
        }
      } else {
        // When no audio data, bars stay at minimum height - no fake bouncing
        for (let i = 0; i < 4; i++) {
          barHeightsRef.current[i] = 100; // Static minimum height - taller for better proportions
        }
      }
      
      // Smooth interpolation for fluid motion
      const lerpFactor = 0.2; // Responsive but smooth
      for (let i = 0; i < 4; i++) {
        currentBarHeightsRef.current[i] += (barHeightsRef.current[i] - currentBarHeightsRef.current[i]) * lerpFactor;
      }
      
      // Draw the bars with high quality rendering
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        const x = startX + (i * (barWidth + barSpacing));
        const barHeight = Math.round(currentBarHeightsRef.current[i]); // Round for crisp edges
        const y = Math.round((h - barHeight) / 2); // Round for crisp positioning
        
        drawRoundedRect(ctx, x, y, barWidth, barHeight, 30);
      });
    }
    
    function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }
    
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      // Clean up audio context when component unmounts
      try {
        if ((canvas as any).source) {
          (canvas as any).source.disconnect();
          (canvas as any).source = null;
        }
        if ((canvas as any).analyser) {
          (canvas as any).analyser = null;
        }
        if ((canvas as any).audioContext) {
          (canvas as any).audioContext.close();
          (canvas as any).audioContext = null;
        }
      } catch (e) {
        console.log('Audio cleanup failed:', e);
      }
    };
  }, [stream, onSpeaking, isUserSpeaking, connected, aiSpeaking]);

  return (
      <div className="relative w-full h-60">
        {aiSpeaking && <canvas ref={canvasRef} className="w-full h-full" />}
        {(isUserSpeaking || (!aiSpeaking && connected && hasAiSpokenOnce)) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <PingoRing isHolding={isUserSpeaking} showWhenNotHolding={!aiSpeaking && connected && hasAiSpokenOnce} />
          </div>
        )}
    </div>
  );
}