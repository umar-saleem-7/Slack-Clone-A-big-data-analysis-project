import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import websocket from '../services/websocket';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import Channel from '../components/Channel';
import Search from '../components/Search';
import { useToast, ToastContainer } from '../components/Toast';
import CreateWorkspaceModal from '../components/CreateWorkspaceModal';
import JoinWorkspaceModal from '../components/JoinWorkspaceModal';
import CreateChannelModal from '../components/CreateChannelModal';
import WorkspaceSettings from '../components/WorkspaceSettings';
import '../styles/Dashboard.css';
import '../styles/common.css';

function Dashboard() {
    const [workspaces, setWorkspaces] = useState([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [selectedWorkspaceRole, setSelectedWorkspaceRole] = useState(null);
    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showSearch, setShowSearch] = useState(false);

    // Modal states
    const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
    const [showJoinWorkspace, setShowJoinWorkspace] = useState(false);
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);

    const { toasts, showToast, removeToast } = useToast();
    const navigate = useNavigate();
    const user = authService.getCurrentUser();

    useEffect(() => {
        // Connect WebSocket
        const token = authService.getToken();
        if (token) {
            websocket.connect(token);
        }

        // Load workspaces
        loadWorkspaces();

        return () => {
            websocket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (selectedWorkspace) {
            loadChannels(selectedWorkspace.workspace_id);
        }
    }, [selectedWorkspace]);

    const loadWorkspaces = async () => {
        try {
            const response = await api.get('/workspaces');
            setWorkspaces(response.data.workspaces);

            // Try to restore saved workspace from localStorage
            const savedWorkspaceId = localStorage.getItem('selectedWorkspaceId');
            let workspaceToSelect = null;

            if (savedWorkspaceId) {
                workspaceToSelect = response.data.workspaces.find(
                    w => w.workspace_id === savedWorkspaceId
                );
            }

            // If no saved workspace or it doesn't exist, select first one
            if (!workspaceToSelect && response.data.workspaces.length > 0) {
                workspaceToSelect = response.data.workspaces[0];
            }

            if (workspaceToSelect) {
                setSelectedWorkspace(workspaceToSelect);
                setSelectedWorkspaceRole(workspaceToSelect.role);
                localStorage.setItem('selectedWorkspaceId', workspaceToSelect.workspace_id);
            }
        } catch (error) {
            console.error('Failed to load workspaces:', error);
            showToast('Failed to load workspaces', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadChannels = async (workspaceId) => {
        try {
            const response = await api.get(`/channels/workspace/${workspaceId}`);
            setChannels(response.data.channels);

            // Try to restore saved channel from localStorage
            const savedChannelId = localStorage.getItem('selectedChannelId');
            let channelToSelect = null;

            if (savedChannelId) {
                channelToSelect = response.data.channels.find(
                    c => c.channel_id === savedChannelId
                );
            }

            // If no saved channel or it doesn't exist, select first one
            if (!channelToSelect && response.data.channels.length > 0) {
                channelToSelect = response.data.channels[0];
            }

            if (channelToSelect) {
                // Auto-join public channels if not a member
                if (!channelToSelect.is_member && channelToSelect.type === 'public') {
                    try {
                        await api.post(`/channels/${channelToSelect.channel_id}/join`);
                        channelToSelect.is_member = true;
                    } catch (e) {
                        console.log('Auto-join failed, might already be member');
                    }
                }
                setSelectedChannel(channelToSelect);
                localStorage.setItem('selectedChannelId', channelToSelect.channel_id);
            }
        } catch (error) {
            console.error('Failed to load channels:', error);
            showToast('Failed to load channels', 'error');
        }
    };

    const handleLogout = () => {
        authService.logout();
        websocket.disconnect();
        navigate('/login');
    };

    const handleCreateWorkspace = async (name, description) => {
        await api.post('/workspaces', { name, description });
        await loadWorkspaces();
    };

    const handleJoinWorkspace = async (workspaceId) => {
        await api.post(`/workspaces/${workspaceId}/join`);

        // Auto-load and select the joined workspace
        const response = await api.get('/workspaces');
        const joinedWorkspace = response.data.workspaces.find(w => w.workspace_id === workspaceId);

        if (joinedWorkspace) {
            setWorkspaces(response.data.workspaces);
            setSelectedWorkspace(joinedWorkspace);
            setSelectedWorkspaceRole(joinedWorkspace.role);

            // Auto-load channels
            await loadChannels(workspaceId);
        }
    };

    const handleCreateChannel = async (name, description, type) => {
        await api.post('/channels', {
            workspaceId: selectedWorkspace.workspace_id,
            name,
            description,
            type,
        });
        await loadChannels(selectedWorkspace.workspace_id);
    };

    const handleUpdateWorkspace = async (workspaceId, data) => {
        await api.put(`/workspaces/${workspaceId}`, data);
        await loadWorkspaces();
    };

    const handleDeleteWorkspace = async (workspaceId) => {
        await api.delete(`/workspaces/${workspaceId}`);
        setSelectedWorkspace(null);
        setSelectedWorkspaceRole(null);
        setSelectedChannel(null);
        await loadWorkspaces();
    };

    const handleLeaveWorkspace = async (workspaceId) => {
        await api.post(`/workspaces/${workspaceId}/leave`);
        setSelectedWorkspace(null);
        setSelectedWorkspaceRole(null);
        setSelectedChannel(null);
        await loadWorkspaces();
    };

    // Handle channel selection - auto-join public channels if not a member
    const handleSelectChannel = async (channel) => {
        // If user is not a member and it's a public channel, join first
        if (!channel.is_member && channel.type === 'public') {
            try {
                await api.post(`/channels/${channel.channel_id}/join`);
                // Update channel in list to reflect membership
                setChannels(prev => prev.map(ch =>
                    ch.channel_id === channel.channel_id
                        ? { ...ch, is_member: true }
                        : ch
                ));
                showToast(`Joined #${channel.name}`, 'success');
            } catch (error) {
                console.error('Failed to join channel:', error);
                showToast(error.response?.data?.error || 'Failed to join channel', 'error');
                return;
            }
        }
        setSelectedChannel(channel);
        localStorage.setItem('selectedChannelId', channel.channel_id);
    };

    // Handle workspace selection
    const handleSelectWorkspace = (workspace) => {
        setSelectedWorkspace(workspace);
        setSelectedWorkspaceRole(workspace.role);
        setSelectedChannel(null); // Clear channel when switching workspace
        localStorage.setItem('selectedWorkspaceId', workspace.workspace_id);
        localStorage.removeItem('selectedChannelId'); // Clear saved channel
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (workspaces.length === 0) {
        return (
            <>
                <ToastContainer toasts={toasts} removeToast={removeToast} />

                <div className="dashboard-empty">
                    <h2>Welcome to Slack Clone!</h2>
                    <p>Create your first workspace or join an existing one</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowCreateWorkspace(true)}
                        >
                            ➕ Create Workspace
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowJoinWorkspace(true)}
                        >
                            🔗 Join Workspace
                        </button>
                    </div>
                    <button
                        className="btn btn-text"
                        onClick={handleLogout}
                        style={{ marginTop: '2rem' }}
                    >
                        Logout
                    </button>
                </div>

                {/* Modals */}
                <CreateWorkspaceModal
                    isOpen={showCreateWorkspace}
                    onClose={() => setShowCreateWorkspace(false)}
                    onCreate={handleCreateWorkspace}
                    showToast={showToast}
                />
                <JoinWorkspaceModal
                    isOpen={showJoinWorkspace}
                    onClose={() => setShowJoinWorkspace(false)}
                    onJoin={handleJoinWorkspace}
                    showToast={showToast}
                />
            </>
        );
    }

    return (
        <>
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            <div className="dashboard">
                <Sidebar
                    user={user}
                    userRole={selectedWorkspaceRole}
                    workspaces={workspaces}
                    selectedWorkspace={selectedWorkspace}
                    channels={channels}
                    selectedChannel={selectedChannel}
                    onSelectWorkspace={handleSelectWorkspace}
                    onSelectChannel={handleSelectChannel}
                    onOpenCreateWorkspace={() => setShowCreateWorkspace(true)}
                    onOpenJoinWorkspace={() => setShowJoinWorkspace(true)}
                    onOpenCreateChannel={() => setShowCreateChannel(true)}
                    onOpenWorkspaceSettings={() => setShowWorkspaceSettings(true)}
                    onLogout={handleLogout}
                />

                <div className="dashboard-content">
                    <div className="dashboard-header">
                        <div className="header-title">
                            {selectedChannel && (
                                <span>{selectedChannel.type === 'private' ? '🔒' : '#'} {selectedChannel.name}</span>
                            )}
                        </div>
                        <div className="header-actions">
                        </div>
                    </div>

                    <div className="dashboard-main">
                        {selectedChannel ? (
                            <Channel
                                channel={selectedChannel}
                                workspace={selectedWorkspace}
                                user={user}
                                onOpenSearch={() => setShowSearch(true)}
                                showToast={showToast}
                                onChannelLeave={(channelId) => {
                                    // If user left the currently selected channel, clear selection
                                    if (selectedChannel?.channel_id === channelId) {
                                        setSelectedChannel(null);
                                    }
                                    // Reload channels list
                                    loadChannels(selectedWorkspace?.workspace_id);
                                }}
                            />
                        ) : (
                            <div className="dashboard-placeholder">
                                <p>Select a channel to start messaging</p>
                            </div>
                        )}
                    </div>

                    {showSearch && (
                        <Search
                            workspaceId={selectedWorkspace?.workspace_id}
                            onClose={() => setShowSearch(false)}
                        />
                    )}
                </div>
            </div>

            {/* Modals */}
            <CreateWorkspaceModal
                isOpen={showCreateWorkspace}
                onClose={() => setShowCreateWorkspace(false)}
                onCreate={handleCreateWorkspace}
                showToast={showToast}
            />
            <JoinWorkspaceModal
                isOpen={showJoinWorkspace}
                onClose={() => setShowJoinWorkspace(false)}
                onJoin={handleJoinWorkspace}
                showToast={showToast}
            />
            <CreateChannelModal
                isOpen={showCreateChannel}
                onClose={() => setShowCreateChannel(false)}
                onCreate={handleCreateChannel}
                showToast={showToast}
            />
            {selectedWorkspace && (
                <WorkspaceSettings
                    isOpen={showWorkspaceSettings}
                    workspace={selectedWorkspace}
                    userRole={selectedWorkspaceRole}
                    onClose={() => setShowWorkspaceSettings(false)}
                    onUpdate={handleUpdateWorkspace}
                    onDelete={handleDeleteWorkspace}
                    onLeave={handleLeaveWorkspace}
                    showToast={showToast}
                />
            )}
        </>
    );
}

export default Dashboard;
