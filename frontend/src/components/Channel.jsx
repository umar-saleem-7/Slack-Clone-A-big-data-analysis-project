import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import websocket from '../services/websocket';
import ChannelMembers from './ChannelMembers';
import VoiceRecorder from './VoiceRecorder';
import MessageMedia from './MessageMedia';
import '../styles/Channel.css';

function Channel({ channel, workspace, user, onOpenSearch, showToast, onChannelLeave }) {
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        // Reset messages when channel changes to prevent stale data
        setMessages([]);
        setLoading(true);
        loadMessages();

        // Join channel via WebSocket
        websocket.joinChannel(channel.channel_id);

        // Listen for new messages
        const handleNewMessage = (data) => {
            if (data.message.channel_id === channel.channel_id) {
                setMessages(prev => {
                    // Check if this is our own message (replace optimistic)
                    if (data.message.user_id === user.userId) {
                        // Remove any optimistic messages and add the real one
                        const filtered = prev.filter(m => !m.isOptimistic);
                        return [...filtered, data.message];
                    }
                    // For other users' messages, just append
                    return [...prev, data.message];
                });
                scrollToBottom();
            }
        };

        const handleTyping = (data) => {
            if (data.channelId === channel.channel_id && data.userId !== user.userId) {
                setTypingUsers(prev => new Set(prev).add(data.userName));
                setTimeout(() => {
                    setTypingUsers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(data.userName);
                        return newSet;
                    });
                }, 3000);
            }
        };

        websocket.on('new_message', handleNewMessage);
        websocket.on('user_typing', handleTyping);

        return () => {
            websocket.leaveChannel(channel.channel_id);
            websocket.off('new_message', handleNewMessage);
            websocket.off('user_typing', handleTyping);
        };
    }, [channel.channel_id]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/messages/${channel.channel_id}?limit=50`);
            setMessages(response.data.messages.reverse());
        } catch (error) {
            console.error('Failed to load messages:', error);
        } finally {
            setLoading(false);
            scrollToBottom();
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                alert('File size must be less than 10MB');
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleFileUpload = async () => {
        if (!selectedFile) return null;

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('channelId', channel.channel_id);

            const response = await api.post('/files/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            return response.data.file.fileId;
        } catch (error) {
            console.error('File upload failed:', error);
            alert('Failed to upload file');
            return null;
        } finally {
            setUploading(false);
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!messageText.trim() && !selectedFile) return;

        let fileId = null;

        // Upload file first if selected
        if (selectedFile) {
            fileId = await handleFileUpload();
            if (!fileId && !messageText.trim()) return; // Don't send if file upload failed and no text
        }

        const textToSend = messageText.trim() || (selectedFile ? `📎 ${selectedFile.name}` : '');

        // Optimistic update - add message to local state immediately
        const optimisticMessage = {
            message_id: `temp-${Date.now()}`,
            channel_id: channel.channel_id,
            user_id: user.userId,
            user_name: user.name,
            message_text: textToSend,
            file_id: fileId,
            timestamp: new Date().toISOString(),
            isOptimistic: true,
        };
        setMessages(prev => [...prev, optimisticMessage]);
        scrollToBottom();

        // Send via WebSocket
        websocket.sendMessage(channel.channel_id, textToSend, fileId);
        setMessageText('');
        setSelectedFile(null);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            websocket.stopTyping(channel.channel_id);
        }
    };

    const handleTyping = (e) => {
        setMessageText(e.target.value);

        // Send typing indicator
        if (e.target.value.length > 0) {
            websocket.startTyping(channel.channel_id);

            // Clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Stop typing after 2 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                websocket.stopTyping(channel.channel_id);
            }, 2000);
        } else {
            websocket.stopTyping(channel.channel_id);
        }
    };

    const handleDownloadFile = async (fileId, filename) => {
        try {
            const response = await api.get(`/files/${fileId}`);
            // Open presigned URL in new tab
            window.open(response.data.file.downloadUrl, '_blank');
        } catch (error) {
            console.error('Failed to download file:', error);
            alert('Failed to download file');
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const removeSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleLeaveChannel = async () => {
        if (!window.confirm(`Are you sure you want to leave #${channel.name}?`)) return;

        try {
            await api.post(`/channels/${channel.channel_id}/leave`);
            if (showToast) showToast(`Left channel #${channel.name}`, 'success');
            if (onChannelLeave) {
                onChannelLeave(channel.channel_id);
            }
        } catch (error) {
            if (showToast) showToast(error.response?.data?.error || 'Failed to leave channel', 'error');
        }
    };

    // Check if current user is the channel creator
    const isCreator = channel.created_by === user.userId;

    return (
        <div className="channel">
            <div className="channel-header">
                <div className="channel-info">
                    <h2 className="channel-title">
                        <span className="channel-hash">{channel.type === 'private' ? '🔒' : '#'}</span>
                        {channel.name}
                    </h2>
                    {channel.description && (
                        <p className="channel-description">{channel.description}</p>
                    )}
                </div>
                <div className="channel-actions">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowMembers(true)}
                        title="View members"
                    >
                        👥 Members
                    </button>
                    {onOpenSearch && (
                        <button className="btn btn-secondary btn-sm" onClick={onOpenSearch}>
                            🔍 Search
                        </button>
                    )}
                    {!isCreator && (
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={handleLeaveChannel}
                            title="Leave this channel"
                        >
                            🚪 Leave
                        </button>
                    )}
                </div>
            </div>

            <div className="channel-messages">
                {loading ? (
                    <div className="messages-loading">
                        <div className="spinner"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="messages-empty">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    <div className="messages-list">
                        {messages.map((message) => (
                            <div
                                key={message.message_id}
                                className={`message ${message.user_id === user.userId ? 'own-message' : ''}`}
                            >
                                <div className="message-avatar" title={message.user_name}>
                                    {message.user_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="message-bubble">
                                    <div className="message-content">
                                        <div className="message-header">
                                            <span className="message-author">{message.user_name}</span>
                                            <span className="message-time">{formatTime(message.timestamp)}</span>
                                        </div>
                                        <div className="message-text">{message.message_text}</div>
                                        {message.file_id && (
                                            <MessageMedia
                                                fileId={message.file_id}
                                                messageText={message.message_text}
                                                onDownload={handleDownloadFile}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}

                {typingUsers.size > 0 && (
                    <div className="typing-indicator">
                        {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                    </div>
                )}
            </div>

            <div className="channel-input">
                {selectedFile && (
                    <div className="file-preview">
                        <span className="file-preview-name">📎 {selectedFile.name}</span>
                        <button className="file-preview-remove" onClick={removeSelectedFile}>×</button>
                    </div>
                )}
                <form onSubmit={handleSendMessage}>
                    <div className="input-wrapper">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                            accept="image/*,.pdf,.doc,.docx,.txt"
                        />
                        <button
                            type="button"
                            className="btn-icon attach-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Attach file"
                            disabled={uploading}
                        >
                            📎
                        </button>
                        <input
                            type="text"
                            className="message-input"
                            placeholder={`Message ${channel.type === 'private' ? '🔒' : '#'}${channel.name}`}
                            value={messageText}
                            onChange={handleTyping}
                            disabled={uploading}
                            autoFocus
                        />
                        <VoiceRecorder
                            disabled={uploading}
                            onRecordComplete={async (audioBlob) => {
                                try {
                                    setUploading(true);
                                    const formData = new FormData();
                                    formData.append('file', audioBlob, 'voice-message.webm');
                                    formData.append('channelId', channel.channel_id);

                                    const uploadResponse = await api.post('/files/upload', formData, {
                                        headers: { 'Content-Type': 'multipart/form-data' }
                                    });

                                    websocket.sendMessage(channel.channel_id, '🎤 Voice message', uploadResponse.data.file.fileId);
                                    if (showToast) showToast('Voice message sent!', 'success');
                                } catch (error) {
                                    console.error('Failed to upload voice message:', error);
                                    if (showToast) showToast('Failed to send voice message', 'error');
                                } finally {
                                    setUploading(false);
                                }
                            }}
                        />
                        <button
                            type="submit"
                            className="btn btn-primary send-btn"
                            disabled={(!messageText.trim() && !selectedFile) || uploading}
                        >
                            {uploading ? 'Uploading...' : 'Send'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Channel Members Modal */}
            <ChannelMembers
                isOpen={showMembers}
                channel={channel}
                workspace={workspace}
                currentUserId={user.userId}
                isAdmin={channel.created_by === user.userId}
                onClose={() => setShowMembers(false)}
                showToast={showToast || ((msg, type) => console.log(type, msg))}
            />
        </div>
    );
}

export default Channel;
