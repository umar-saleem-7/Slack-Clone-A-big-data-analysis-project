import { useState, useEffect } from 'react';
import api from '../services/api';
import './MessageMedia.css';

function MessageMedia({ fileId, messageText, onDownload }) {
    const [fileInfo, setFileInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageExpanded, setImageExpanded] = useState(false);

    useEffect(() => {
        loadFileInfo();
    }, [fileId]);

    const loadFileInfo = async () => {
        try {
            const response = await api.get(`/files/${fileId}`);
            setFileInfo(response.data.file);
        } catch (error) {
            console.error('Failed to load file info:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="message-media loading">Loading media...</div>;
    }

    if (!fileInfo) {
        return (
            <div className="message-file">
                <button
                    className="file-download-btn"
                    onClick={() => onDownload(fileId, messageText)}
                >
                    📎 Download File
                </button>
            </div>
        );
    }

    // API returns camelCase: filename, mimeType, downloadUrl
    const { filename, mimeType, downloadUrl } = fileInfo;
    const isAudio = mimeType?.startsWith('audio/');
    const isImage = mimeType?.startsWith('image/');

    // Voice message / Audio file
    if (isAudio) {
        return (
            <div className="message-media audio-media">
                <div className="audio-container">
                    <span className="audio-icon">🎤</span>
                    <audio controls preload="metadata" className="audio-player">
                        <source src={downloadUrl} type={mimeType} />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            </div>
        );
    }

    // Image file
    if (isImage) {
        return (
            <div className="message-media image-media">
                <img
                    src={downloadUrl}
                    alt={filename || 'Image'}
                    className="message-image"
                    onClick={() => setImageExpanded(true)}
                    loading="lazy"
                />
                {imageExpanded && (
                    <div className="image-overlay" onClick={() => setImageExpanded(false)}>
                        <img src={downloadUrl} alt={filename || 'Image'} className="image-fullsize" />
                        <button className="close-btn" onClick={(e) => { e.stopPropagation(); setImageExpanded(false); }}>✕</button>
                    </div>
                )}
            </div>
        );
    }

    // Other file types - show download button
    return (
        <div className="message-file">
            <button
                className="file-download-btn"
                onClick={() => onDownload(fileId, messageText)}
            >
                📎 {filename || 'Download File'}
            </button>
        </div>
    );
}

export default MessageMedia;
