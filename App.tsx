
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from './services/geminiService';
import { pcmToAudioBuffer, audioBufferToWav } from './utils/audioUtils';
import { AVAILABLE_VOICES, INITIAL_EFFECT_SETTINGS } from './constants';
import type { Voice, EffectSettings } from './types';
import { AudioEditor } from './components/AudioEditor';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { SpeakerIcon } from './components/icons/SpeakerIcon';

const App: React.FC = () => {
  const [djName, setDjName] = useState<string>('Sonido Fantasma');
  const [selectedVoice, setSelectedVoice] = useState<Voice>(AVAILABLE_VOICES[0]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [effectSettings, setEffectSettings] = useState<EffectSettings>(INITIAL_EFFECT_SETTINGS);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const previewSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);


  useEffect(() => {
    // Lazy initialization of AudioContext
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            try {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
              setError("La API de Web Audio no es compatible con este navegador.");
            }
        }
    };
    // Add event listener for first user interaction to create audio context
    window.addEventListener('click', initAudioContext, { once: true });


    return () => {
        window.removeEventListener('click', initAudioContext);
        sourceNodeRef.current?.stop();
        previewSourceNodeRef.current?.stop();
        audioContextRef.current?.close();
    };
  }, []);

  const stopAllAudio = () => {
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {/* ignore */}
    }
    if (previewSourceNodeRef.current) {
        try { previewSourceNodeRef.current.stop(); } catch(e) {/* ignore */}
    }
  }

  const handleGenerate = async () => {
    if (!djName.trim()) {
      setError('Por favor, escribe un nombre para tu pista de voz.');
      return;
    }
    if (!audioContextRef.current) {
        setError('El contexto de audio no está inicializado. Haz clic en la página para activarlo.');
        return;
    }

    setIsLoading(true);
    setError(null);
    originalBufferRef.current = null;
    stopAllAudio();

    try {
      const base64Audio = await generateSpeech(djName, selectedVoice.id, selectedVoice.promptPrefix);
      if (!base64Audio) {
          throw new Error("Se recibieron datos de audio vacíos desde la API.");
      }
      const audioBuffer = await pcmToAudioBuffer(base64Audio, audioContextRef.current);
      originalBufferRef.current = audioBuffer;
    } catch (e) {
      console.error('La generación falló:', e);
      setError(e instanceof Error ? e.message : 'Ocurrió un error desconocido durante la generación de voz.');
    } finally {
      setIsLoading(false);
    }
  };

  const playWithEffects = useCallback(async () => {
    if (!originalBufferRef.current || !audioContextRef.current) return;
    
    stopAllAudio();

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    const audioCtx = audioContextRef.current;
    
    const source = audioCtx.createBufferSource();
    source.buffer = originalBufferRef.current;
    source.playbackRate.value = effectSettings.playbackRate;
    sourceNodeRef.current = source;
    
    let lastNode: AudioNode = source;

    const lowShelf = audioCtx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 320;
    lowShelf.gain.value = effectSettings.eqLow;
    lastNode.connect(lowShelf);
    lastNode = lowShelf;

    const midPeak = audioCtx.createBiquadFilter();
    midPeak.type = 'peaking';
    midPeak.frequency.value = 1000;
    midPeak.Q.value = 1;
    midPeak.gain.value = effectSettings.eqMid;
    lastNode.connect(midPeak);
    lastNode = midPeak;

    const highShelf = audioCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 3200;
    highShelf.gain.value = effectSettings.eqHigh;
    lastNode.connect(highShelf);
    lastNode = highShelf;

    const delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = effectSettings.delayTime;
    const feedbackNode = audioCtx.createGain();
    feedbackNode.gain.value = effectSettings.delayFeedback;
    
    lastNode.connect(delayNode);
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode);

    const mixNode = audioCtx.createGain();
    lastNode.connect(mixNode);
    feedbackNode.connect(mixNode);
    lastNode = mixNode;

    const reverbDry = audioCtx.createGain();
    reverbDry.gain.value = 1 - (effectSettings.reverb / 100);
    lastNode.connect(reverbDry);
    reverbDry.connect(audioCtx.destination);

    const reverbWet = audioCtx.createGain();
    reverbWet.gain.value = effectSettings.reverb / 100;
    lastNode.connect(reverbWet);

    const convolver = audioCtx.createConvolver();
    const impulseLength = audioCtx.sampleRate * 2;
    const impulse = audioCtx.createBuffer(2, impulseLength, audioCtx.sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < impulseLength; i++) {
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2.5);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2.5);
    }
    convolver.buffer = impulse;
    reverbWet.connect(convolver);
    convolver.connect(audioCtx.destination);

    source.start(0);

  }, [effectSettings]);

  const handlePreview = useCallback(async (voice: Voice) => {
    if (previewingVoice) return;
    if (!audioContextRef.current) {
        setError('El contexto de audio no está inicializado. Haz clic en la página para activarlo.');
        return;
    }
    stopAllAudio();
    setPreviewingVoice(voice.name);
    setError(null);

    try {
        const base64Audio = await generateSpeech(voice.name, voice.id, voice.promptPrefix);
        if (!base64Audio || !audioContextRef.current) throw new Error("Falló el audio de vista previa.");

        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        
        const audioBuffer = await pcmToAudioBuffer(base64Audio, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.start(0);
        previewSourceNodeRef.current = source;
        source.onended = () => {
            if (previewSourceNodeRef.current === source) {
                previewSourceNodeRef.current = null;
            }
        };

    } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la vista previa.');
    } finally {
        setPreviewingVoice(null);
    }
  }, [previewingVoice]);

  const handleDownload = useCallback(async () => {
    if (!originalBufferRef.current) {
        setError("No se ha generado audio para descargar.");
        return;
    }

    try {
        const wavBlob = await audioBufferToWav(originalBufferRef.current, effectSettings);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${djName.replace(/ /g, '_')}_drop.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch(e) {
        console.error("La descarga falló:", e);
        setError("Falló el procesamiento de audio para la descarga.");
    }
  }, [djName, effectSettings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/40 to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="font-orbitron text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            Generador de Voz para DJ
          </h1>
          <p className="mt-2 text-lg text-gray-300 max-w-2xl mx-auto">
            Crea tus pistas de DJ personalizadas con calidad de estudio en segundos. Escribe tu nombre, elige una voz y mezcla tu sonido.
          </p>
        </header>

        <main className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-purple-500/10 p-6 sm:p-8 border border-gray-700">
          <div className="space-y-8">
            <div>
              <label htmlFor="djName" className="font-orbitron text-sm font-bold text-purple-300 mb-2 block">
                1. Escribe el Nombre
              </label>
              <input
                id="djName"
                type="text"
                value={djName}
                onChange={(e) => setDjName(e.target.value)}
                placeholder="Ej: Sonido Fantasma"
                className="w-full bg-gray-900/70 border-2 border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300"
              />
            </div>

            <div>
              <label className="font-orbitron text-sm font-bold text-purple-300 mb-3 block">
                2. Elige una Voz
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {AVAILABLE_VOICES.map((voice) => (
                    <div key={voice.name} className="flex items-center gap-2">
                        <button
                            onClick={() => setSelectedVoice(voice)}
                            className={`flex-grow px-4 py-3 text-sm font-bold rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white ${
                            selectedVoice.name === voice.name
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {voice.name}
                        </button>
                        <button 
                            onClick={() => handlePreview(voice)}
                            disabled={!!previewingVoice}
                            aria-label={`Escuchar ${voice.name}`}
                            className="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white disabled:opacity-50 disabled:cursor-wait"
                        >
                            {previewingVoice === voice.name ? <SpinnerIcon/> : <SpeakerIcon />}
                        </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="font-orbitron w-full md:w-auto text-lg font-bold bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white rounded-lg px-12 py-4 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center mx-auto"
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon />
                    Generando...
                  </>
                ) : (
                  '3. Generar Pista de Voz'
                )}
              </button>
              {error && <p className="text-red-400 mt-4">{error}</p>}
            </div>
            
            {originalBufferRef.current && (
                <AudioEditor
                    effectSettings={effectSettings}
                    setEffectSettings={setEffectSettings}
                    onPlay={playWithEffects}
                    onDownload={handleDownload}
                />
            )}
          </div>
        </main>
        <footer className="text-center mt-8 text-gray-500 text-sm">
            <p>Creado con Gemini API. Hecho con React & Tailwind CSS.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;