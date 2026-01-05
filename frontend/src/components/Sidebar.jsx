import { useState } from 'react';
import '../styles/Sidebar.css';

function Sidebar({
    user,
    userRole,
    workspaces,
    selectedWorkspace,
    channels,
    selectedChannel,
    onSelectWorkspace,
    onSelectChannel,
    onOpenCreateWorkspace,
    onOpenJoinWorkspace,
    onOpenCreateChannel,
    onOpenWorkspaceSettings,
    onLogout,
}) {
    const isAdmin = userRole === 'admin';
    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="workspace-selector" onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}>
                    <span className="workspace-name">{selectedWorkspace?.name || 'Select Workspace'}</span>
                    <span className="dropdown-icon">▼</span>
                </div>

                {selectedWorkspace && (
                    <button
                        className="icon-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenWorkspaceSettings();
                        }}
                        title="Workspace Settings"
                        style={{ marginLeft: '0.5rem' }}
                    >
                        ⚙️
                    </button>
                )}

                {showWorkspaceMenu && (
                    <div className="workspace-menu">
                        {workspaces.map((ws) => (
                            <div
                                key={ws.workspace_id}
                                className={`workspace-item ${ws.workspace_id === selectedWorkspace?.workspace_id ? 'active' : ''}`}
                                onClick={() => {
                                    onSelectWorkspace(ws);
                                    setShowWorkspaceMenu(false);
                                }}
                            >
                                {ws.name}
                            </div>
                        ))}
                        <div className="workspace-item create" onClick={() => {
                            onOpenCreateWorkspace();
                            setShowWorkspaceMenu(false);
                        }}>
                            + Create Workspace
                        </div>
                        <div className="workspace-item create" onClick={() => {
                            onOpenJoinWorkspace();
                            setShowWorkspaceMenu(false);
                        }}>
                            🔗 Join Workspace
                        </div>
                    </div>
                )}
            </div>

            <div className="sidebar-content">
                <div className="channels-section">
                    <div className="section-header">
                        <span>Channels</span>
                        {isAdmin && (
                            <button className="icon-btn" onClick={onOpenCreateChannel} title="Create channel">
                                +
                            </button>
                        )}
                    </div>

                    <div className="channels-list">
                        {channels.filter(ch => ch.type === 'public').map((channel) => (
                            <div
                                key={channel.channel_id}
                                className={`channel-item ${channel.channel_id === selectedChannel?.channel_id ? 'active' : ''}`}
                                onClick={() => onSelectChannel(channel)}
                            >
                                <span className="channel-icon">#</span>
                                <span className="channel-name">{channel.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="channels-section">
                    <div className="section-header">
                        <span>Private Channels</span>
                    </div>

                    <div className="channels-list">
                        {channels.filter(ch => ch.type === 'private').map((channel) => (
                            <div
                                key={channel.channel_id}
                                className={`channel-item ${channel.channel_id === selectedChannel?.channel_id ? 'active' : ''}`}
                                onClick={() => onSelectChannel(channel)}
                            >
                                <span className="channel-icon">🔒</span>
                                <span className="channel-name">{channel.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="sidebar-footer">
                <div className="user-info">
                    <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
                    <div className="user-details">
                        <div className="user-name">{user?.name}</div>
                        <div className="user-email">{user?.email}</div>
                    </div>
                </div>
                <div className="sidebar-actions">
                    <button className="btn btn-secondary btn-sm" onClick={onLogout}>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
