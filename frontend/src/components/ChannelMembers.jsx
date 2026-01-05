import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../services/api';
import './ChannelMembers.css';

function ChannelMembers({ isOpen, channel, workspace, currentUserId, isAdmin, onClose, showToast }) {
    const [members, setMembers] = useState([]);
    const [workspaceMembers, setWorkspaceMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [channelCreatorId, setChannelCreatorId] = useState(null);

    useEffect(() => {
        if (isOpen && channel) {
            loadMembers();
            if (channel.type === 'private') {
                loadWorkspaceMembers();
            }
            // Track channel creator
            setChannelCreatorId(channel.created_by);
        }
    }, [isOpen, channel]);

    const loadMembers = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/channels/${channel.channel_id}/members`);
            setMembers(response.data.members || []);
        } catch (error) {
            console.error('Failed to load channel members:', error);
            showToast('Failed to load members', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadWorkspaceMembers = async () => {
        try {
            const response = await api.get(`/workspaces/${workspace.workspace_id}/members`);
            setWorkspaceMembers(response.data.members || []);
        } catch (error) {
            console.error('Failed to load workspace members:', error);
        }
    };

    const handleInvite = async (userId) => {
        try {
            await api.post(`/channels/${channel.channel_id}/members`, { userId });
            showToast('Member added!', 'success');
            loadMembers();
            setShowInvite(false);
        } catch (error) {
            showToast(error.response?.data?.error || 'Failed to add member', 'error');
        }
    };

    const handleRemove = async (userId) => {
        if (!window.confirm('Remove this member from the channel?')) return;

        try {
            await api.delete(`/channels/${channel.channel_id}/members/${userId}`);
            showToast('Member removed', 'success');
            loadMembers();
        } catch (error) {
            showToast(error.response?.data?.error || 'Failed to remove member', 'error');
        }
    };

    if (!isOpen) return null;

    // Check if current user can manage members (admin or channel creator)
    const canManageMembers = isAdmin || currentUserId === channelCreatorId;

    // Get users who can be invited (workspace members not in channel)
    const invitableUsers = workspaceMembers.filter(
        wm => !members.find(m => m.user_id === wm.user_id)
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${channel.type === 'private' ? '🔒' : '#'} ${channel.name} - Members`} size="medium">
            <div className="channel-members">
                {/* Current Members */}
                <div className="members-section">
                    <div className="section-header">
                        <h3>Members ({members.length})</h3>
                        <div className="section-actions">
                            {channel.type === 'private' && canManageMembers && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setShowInvite(!showInvite)}
                                >
                                    {showInvite ? 'Cancel' : '+ Invite'}
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading...</div>
                    ) : (
                        <div className="members-list">
                            {members.map(member => (
                                <div key={member.user_id} className="member-item">
                                    <div className="member-avatar">
                                        {member.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="member-info">
                                        <span className="member-name">
                                            {member.name}
                                            {member.user_id === currentUserId && ' (You)'}
                                            {member.user_id === channelCreatorId && ' 👑'}
                                        </span>
                                        <span className="member-email">{member.email}</span>
                                    </div>
                                    {canManageMembers && member.user_id !== currentUserId && member.user_id !== channelCreatorId && (
                                        <button
                                            className="btn btn-text btn-sm btn-danger-text"
                                            onClick={() => handleRemove(member.user_id)}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Invite Section for Private Channels */}
                {showInvite && channel.type === 'private' && (
                    <div className="invite-section">
                        <h3>Invite Members</h3>
                        {invitableUsers.length === 0 ? (
                            <p className="empty-text">All workspace members are already in this channel</p>
                        ) : (
                            <div className="members-list">
                                {invitableUsers.map(user => (
                                    <div key={user.user_id} className="member-item">
                                        <div className="member-avatar">
                                            {user.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="member-info">
                                            <span className="member-name">{user.name}</span>
                                            <span className="member-email">{user.email}</span>
                                        </div>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleInvite(user.user_id)}
                                        >
                                            Add
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default ChannelMembers;

