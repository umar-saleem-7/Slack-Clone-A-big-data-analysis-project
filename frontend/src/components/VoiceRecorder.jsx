import { useState, useRef } from 'react';
import './VoiceRecorder.css';

function VoiceRecorder({ onRecordComplete, disabled }) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Failed to start recording:', error);
            alert('Could not access microphone. Please allow microphone access.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
        clearInterval(timerRef.current);
    };

    const sendVoiceMessage = () => {
        if (audioBlob && onRecordComplete) {
            onRecordComplete(audioBlob);
            setAudioBlob(null);
            setAudioUrl(null);
            setRecordingTime(0);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="voice-recorder">
            {!isRecording && !audioBlob && (
                <button
                    type="button"
                    className="voice-btn record-btn"
                    onClick={startRecording}
                    disabled={disabled}
                    title="Record voice message"
                >
                    🎤
                </button>
            )}

            {isRecording && (
                <div className="recording-controls">
                    <span className="recording-indicator">
                        <span className="recording-dot"></span>
                        Recording {formatTime(recordingTime)}
                    </span>
                    <button type="button" className="voice-btn cancel-btn" onClick={cancelRecording} title="Cancel">
                        ✕
                    </button>
                    <button type="button" className="voice-btn stop-btn" onClick={stopRecording} title="Stop">
                        ⏹️
                    </button>
                </div>
            )}

            {audioBlob && !isRecording && (
                <div className="preview-controls">
                    <audio src={audioUrl} controls className="audio-preview" />
                    <button type="button" className="voice-btn cancel-btn" onClick={cancelRecording} title="Discard">
                        🗑️
                    </button>
                    <button type="button" className="voice-btn send-btn" onClick={sendVoiceMessage} title="Send">
                        📤
                    </button>
                </div>
            )}
        </div>
    );
}

export default VoiceRecorder;
