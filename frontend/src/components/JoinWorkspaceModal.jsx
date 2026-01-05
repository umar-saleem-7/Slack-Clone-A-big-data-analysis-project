import { useState } from 'react';
import Modal from './Modal';

function JoinWorkspaceModal({ isOpen, onClose, onJoin, showToast }) {
    const [workspaceId, setWorkspaceId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onJoin(workspaceId.trim());
            showToast('Successfully joined workspace!', 'success');
            setWorkspaceId('');
            onClose();
        } catch (error) {
            showToast(error.response?.data?.error || 'Failed to join workspace. Check the workspace ID.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Join Workspace" size="medium">
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Workspace ID *</label>
                    <input
                        type="text"
                        value={workspaceId}
                        onChange={(e) => setWorkspaceId(e.target.value)}
                        required
                        placeholder="Enter workspace ID"
                        autoFocus
                    />
                    <p className="help-text">Ask your team admin for the workspace ID</p>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Joining...' : 'Join Workspace'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default JoinWorkspaceModal;
