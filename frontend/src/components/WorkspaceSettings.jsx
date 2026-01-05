import { useState } from 'react';
import Modal from './Modal';
import './WorkspaceSettings.css';

function WorkspaceSettings({ isOpen, workspace, userRole, onClose, onUpdate, onDelete, onLeave, showToast }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(workspace.name);
    const [description, setDescription] = useState(workspace.description || '');

    const isAdmin = userRole === 'admin';

    const handleCopyId = () => {
        navigator.clipboard.writeText(workspace.workspace_id);
        showToast('Workspace ID copied to clipboard!', 'success');
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await onUpdate(workspace.workspace_id, { name, description });
            showToast('Workspace updated successfully!', 'success');
            setIsEditing(false);
        } catch (error) {
            showToast('Failed to update workspace', 'error');
        }
    };

    const handleDelete = async () => {
        if (deleteConfirm !== workspace.name) {
            showToast('Workspace name does not match', 'error');
            return;
        }

        try {
            setIsDeleting(true);
            await onDelete(workspace.workspace_id);
            showToast('Workspace deleted successfully', 'success');
            onClose();
        } catch (error) {
            showToast('Failed to delete workspace', 'error');
            setIsDeleting(false);
        }
    };

    const handleLeave = async () => {
        if (!window.confirm('Are you sure you want to leave this workspace?')) {
            return;
        }

        try {
            await onLeave(workspace.workspace_id);
            showToast('Left workspace successfully', 'success');
            onClose();
        } catch (error) {
            showToast('Failed to leave workspace', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Workspace Settings" size="medium">
            <div className="workspace-settings">
                {/* Workspace Info */}
                <div className="settings-section">
                    <h3>Workspace Information</h3>

                    {isEditing ? (
                        <form onSubmit={handleUpdate}>
                            <div className="form-group">
                                <label>Workspace Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    minLength={3}
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <div className="info-item">
                                <label>Name:</label>
                                <span>{workspace.name}</span>
                            </div>
                            <div className="info-item">
                                <label>Description:</label>
                                <span>{workspace.description || 'No description'}</span>
                            </div>
                            <div className="info-item">
                                <label>Your Role:</label>
                                <span className={`role-badge role-${userRole}`}>{userRole}</span>
                            </div>
                            {isAdmin && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>
                                    Edit Workspace
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Workspace ID */}
                <div className="settings-section">
                    <h3>Workspace ID</h3>
                    <div className="workspace-id-box">
                        <code>{workspace.workspace_id}</code>
                        <button className="btn btn-secondary btn-sm" onClick={handleCopyId}>
                            📋 Copy
                        </button>
                    </div>
                    <p className="help-text">Share this ID with team members to invite them</p>
                </div>

                {/* Danger Zone */}
                <div className="settings-section danger-zone">
                    <h3>Danger Zone</h3>

                    {isAdmin ? (
                        <div className="danger-action">
                            <div>
                                <strong>Delete Workspace</strong>
                                <p>Permanently delete this workspace and all its data</p>
                            </div>
                            {!isDeleting ? (
                                <button
                                    className="btn btn-danger"
                                    onClick={() => setIsDeleting(true)}
                                >
                                    Delete Workspace
                                </button>
                            ) : (
                                <div className="delete-confirm">
                                    <p>Type <strong>{workspace.name}</strong> to confirm:</p>
                                    <input
                                        type="text"
                                        value={deleteConfirm}
                                        onChange={(e) => setDeleteConfirm(e.target.value)}
                                        placeholder="Workspace name"
                                    />
                                    <div className="delete-actions">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setIsDeleting(false);
                                                setDeleteConfirm('');
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={handleDelete}
                                            disabled={deleteConfirm !== workspace.name}
                                        >
                                            Delete Forever
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="danger-action">
                            <div>
                                <strong>Leave Workspace</strong>
                                <p>Remove yourself from this workspace</p>
                            </div>
                            <button className="btn btn-danger" onClick={handleLeave}>
                                Leave Workspace
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export default WorkspaceSettings;
